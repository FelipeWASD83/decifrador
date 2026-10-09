// O motor: testa codificações e cifras, em camadas, até sair texto que faça sentido.
//
// Busca em largura com feixe: cada camada aplica todos os métodos a cada estado
// guardado, dá nota ao que saiu e fica só com os melhores para a camada seguinte.
// Passo de codificação que "fecha certinho" (Base64 que decodifica limpo, hexa...)
// ganha uma folga na ordenação mesmo parecendo lixo, para uma cadeia como
// hexa -> ROT13 -> texto não ser podada no meio do caminho.

import { CODECS } from './codecs.js';
import { CLASSICAS } from './classicas.js';
import { pontuar, segmentar, NOME_LINGUA } from './lingua.js';
import { bytesDe, entropia, latin1DeBytes, letras } from './texto.js';

export const METODOS = [...CODECS, ...CLASSICAS];

export const LIMITES = {
  decifrado: 0.5, // daqui para cima o motor afirma que decifrou
  palpite: 0.25, // abaixo disso nem entra como palpite
  parar: 0.55, // fim de camada com isso já para
  parouJa: 0.9, // no meio da camada, para na hora
  jaLegivel: 0.75,
};

const ROTULO_HASH = [
  [/^[a-f0-9]{32}$/i, 'MD5 (ou NTLM)'],
  [/^[a-f0-9]{40}$/i, 'SHA-1'],
  [/^[a-f0-9]{56}$/i, 'SHA-224'],
  [/^[a-f0-9]{64}$/i, 'SHA-256'],
  [/^[a-f0-9]{96}$/i, 'SHA-384'],
  [/^[a-f0-9]{128}$/i, 'SHA-512'],
  [/^\$2[abxy]?\$\d\d\$[./A-Za-z0-9]{53}$/, 'bcrypt'],
  [/^\$1\$[./A-Za-z0-9]{1,8}\$[./A-Za-z0-9]{22}$/, 'MD5-crypt'],
  [/^\$5\$[^$]+\$[./A-Za-z0-9]{43}$/, 'SHA-256-crypt'],
  [/^\$6\$[^$]+\$[./A-Za-z0-9]{86}$/, 'SHA-512-crypt'],
  [/^\$argon2(id|i|d)\$/, 'Argon2'],
];

/** Coisas que o motor reconhece mas não tem como quebrar. */
export function detectarAvisos(entrada) {
  const t = entrada.trim();
  const avisos = [];
  for (const [re, nome] of ROTULO_HASH) {
    if (re.test(t)) {
      avisos.push({
        tipo: 'hash',
        titulo: `Isso parece um hash ${nome}`,
        texto: 'Hash não é criptografia: foi feito para não ter volta. O único jeito é adivinhar a senha original e comparar, e isso o site não faz.',
      });
      break;
    }
  }
  if (/^U2FsdGVkX1/.test(t.replace(/\s+/g, ''))) {
    avisos.push({
      tipo: 'moderna',
      titulo: 'Isso é um arquivo cifrado com OpenSSL (AES com senha)',
      texto: 'O início "Salted__" mostra isso. Sem a senha não tem como abrir, nem testando tudo. Se você sabe a senha, o OpenSSL abre.',
    });
  }
  if (/-----BEGIN (PGP|RSA|OPENSSH|ENCRYPTED|PRIVATE|PUBLIC)/.test(t) || /^ssh-(rsa|ed25519)\s/.test(t)) {
    avisos.push({
      tipo: 'moderna',
      titulo: 'Isso é chave ou mensagem de criptografia moderna (PGP, RSA ou SSH)',
      texto: 'Esse tipo só abre com a chave privada. Não existe atalho por estatística de língua.',
    });
  }
  return avisos;
}

function previa(estado) {
  if (estado.bin) {
    return [...estado.texto.slice(0, 14)].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ') + ' …';
  }
  const t = estado.texto.replace(/\s+/g, ' ').trim();
  return t.length > 72 ? t.slice(0, 72) + '…' : t;
}

function folga(estrito, bin) {
  if (!estrito) return 0;
  return bin ? 0.12 : 0.3;
}

const esperar = () => new Promise((r) => setTimeout(r, 0));

/**
 * @param {string} entrada
 * @param {object} opcoes
 * @param {string} [opcoes.chave]          chave que o usuário já sabe (opcional)
 * @param {number} [opcoes.profundidade]   camadas no máximo
 * @param {number} [opcoes.largura]        quantos estados seguem para a próxima camada
 * @param {number} [opcoes.tempoMax]       milissegundos
 * @param {(ev:object)=>void} [opcoes.aoTentar]
 * @param {()=>boolean} [opcoes.cancelado]
 */
export async function decifrar(entrada, opcoes = {}) {
  const {
    chave = '', profundidade = 4, largura = 10, tempoMax = 25000,
    aoTentar = () => {}, cancelado = () => false,
  } = opcoes;
  const inicio = Date.now();
  const limite = inicio + tempoMax;
  const ctx = { chave };

  const avisos = detectarAvisos(entrada);
  const p0 = pontuar(entrada);
  const raiz = { estado: { texto: entrada, bin: false }, caminho: [], nota: p0.nota, rank: p0.nota, lingua: p0.lingua };

  const resultado = {
    entrada, avisos, melhor: null, alternativas: [], jaLegivel: false,
    tentativas: 0, camadas: 0, ms: 0, parou: '', notaEntrada: p0.nota,
  };

  if (p0.nota >= LIMITES.jaLegivel && p0.letras >= 6) {
    resultado.jaLegivel = true;
    resultado.ms = Date.now() - inicio;
    return resultado;
  }

  const visto = new Set([entrada]);
  const todos = [];
  let feixe = [raiz];
  let ultimaPausa = Date.now();

  camadas:
  for (let camada = 1; camada <= profundidade; camada++) {
    resultado.camadas = camada;
    const novos = [];
    for (const st of feixe) {
      const passouPorCifra = st.caminho.some((p) => p.grupo === 'cifra');
      const ultimo = st.caminho[st.caminho.length - 1]?.id;
      for (const m of METODOS) {
        if (cancelado()) { resultado.parou = 'cancelado'; break camadas; }
        if (Date.now() > limite) { resultado.parou = 'tempo'; break camadas; }
        if (m.pesado && passouPorCifra) continue;
        if (m.id === ultimo && ['reverso', 'atbash', 'rot47', 'cesar'].includes(m.id)) continue;

        let saidas = [];
        try {
          saidas = await m.tenta(st.estado, ctx);
        } catch {
          saidas = [];
        }
        if (Date.now() - ultimaPausa > 40) { await esperar(); ultimaPausa = Date.now(); }
        if (!saidas.length) continue;

        let melhorLocal = null;
        for (const s of saidas) {
          const chaveVisto = (s.estado.bin ? 'b:' : 't:') + s.estado.texto;
          if (visto.has(chaveVisto) || (!s.estado.bin && visto.has(s.estado.texto))) continue;
          visto.add(chaveVisto);
          const p = s.estado.bin ? { nota: 0, lingua: st.lingua } : pontuar(s.estado.texto);
          const cand = {
            estado: s.estado,
            caminho: [...st.caminho, { id: m.id, nome: m.nome, grupo: m.grupo, detalhe: s.detalhe }],
            nota: p.nota,
            lingua: p.lingua,
            letras: p.letras ?? 0,
            estrito: !!s.estrito,
            rank: p.nota + folga(s.estrito, s.estado.bin),
          };
          novos.push(cand);
          todos.push(cand);
          if (!melhorLocal || cand.rank > melhorLocal.rank) melhorLocal = cand;
        }
        resultado.tentativas++;
        if (melhorLocal) {
          aoTentar({
            camada,
            id: m.id,
            nome: m.nome,
            grupo: m.grupo,
            detalhe: melhorLocal.caminho[melhorLocal.caminho.length - 1].detalhe,
            nota: melhorLocal.nota,
            previa: previa(melhorLocal.estado),
            bin: melhorLocal.estado.bin,
            estrito: melhorLocal.estrito,
          });
        }
        if (melhorLocal && melhorLocal.nota >= LIMITES.parouJa && melhorLocal.letras >= 8) break camadas;
      }
    }
    novos.sort((a, b) => b.rank - a.rank);
    const topo = todos.reduce((m, c) => (!m || c.nota > m.nota ? c : m), null);
    if (topo && topo.nota >= LIMITES.parar) { resultado.parou = 'achou'; break; }
    feixe = novos.slice(0, largura);
    // decodificação que fechou certinho (Base64, hexa...) segue mesmo parecendo lixo: pode ser só o meio da cadeia
    for (const c of novos.slice(largura)) {
      if (feixe.length >= largura + 4) break;
      if (c.estrito) feixe.push(c);
    }
    if (!feixe.length) { resultado.parou = 'sem-caminho'; break; }
  }
  if (!resultado.parou) resultado.parou = 'camadas';

  // ranking final, sem repetir texto
  const unicos = new Map();
  for (const c of todos.sort((a, b) => b.nota - a.nota)) {
    if (c.estado.bin) continue;
    const k = c.estado.texto;
    if (!unicos.has(k)) unicos.set(k, c);
  }
  const ordenados = [...unicos.values()].filter((c) => c.nota >= LIMITES.palpite);
  // empate técnico: fica o caminho mais curto (menos passos = menos chance de ser coincidência)
  if (ordenados.length) {
    const topo = ordenados[0].nota;
    const quase = ordenados.filter((c) => c.nota >= topo - 0.04);
    quase.sort((a, b) => a.caminho.length - b.caminho.length || b.nota - a.nota);
    const escolhido = quase[0];
    ordenados.splice(ordenados.indexOf(escolhido), 1);
    ordenados.unshift(escolhido);
  }
  resultado.melhor = ordenados[0] ?? null;
  resultado.alternativas = ordenados.slice(1, 7);
  // hash, PGP e afins: palpite fraco só atrapalha o aviso
  if (avisos.length && (!resultado.melhor || resultado.melhor.nota < LIMITES.decifrado)) {
    resultado.melhor = null;
    resultado.alternativas = [];
  }
  for (const c of [resultado.melhor, ...resultado.alternativas]) if (c) c.espacado = espacar(c);

  // nada decifrado: vale avisar se o conteúdo parece aleatório de verdade
  if (!resultado.melhor || resultado.melhor.nota < LIMITES.decifrado) {
    const b = bytesDe({ texto: entrada, bin: false });
    const decodificados = todos.filter((c) => c.estado.bin && c.estado.texto.length >= 32).map((c) => c.estado.texto);
    const candidatos = decodificados.length ? decodificados : [latin1DeBytes(b)];
    // com poucos bytes nem dado aleatório chega a 8 bits: o piso acompanha log2(n)
    const alta = candidatos.some((t) => {
      if (t.length < 48) return false;
      const e = entropia(Uint8Array.from([...t].map((ch) => ch.charCodeAt(0) & 255)));
      return e >= Math.min(7.2, Math.log2(t.length) - 0.45);
    });
    if (alta && !avisos.length) {
      avisos.push({
        tipo: 'moderna',
        titulo: 'O conteúdo parece aleatório demais para ser cifra clássica',
        texto: 'Depois de decodificar, os bytes ficaram com entropia de dado cifrado (AES, ChaCha etc.) ou comprimido. Isso só abre com a chave, e o site não consegue adivinhar.',
      });
    }
  }

  resultado.ms = Date.now() - inicio;
  return resultado;
}

/** Texto sem espaço (típico de transposição e Bacon) com as palavras separadas, só para exibir. */
function espacar(c) {
  const t = c.estado.texto;
  const L = letras(t);
  if (/\s/.test(t.trim()) || L.length < 10 || L.length / t.length < 0.9) return null;
  return segmentar(L, c.lingua).join(' ');
}

export function descreverLingua(l) {
  return NOME_LINGUA[l] ?? l;
}
