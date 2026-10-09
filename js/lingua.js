// Quanto um texto "faz sentido" em português ou inglês. Sem DOM.
//
// Duas medidas, somadas:
//   - quadrigramas: a probabilidade média de cada trecho de 4 letras seguidas
//     (o que pega "parece língua" mesmo sem espaço nem palavra inteira);
//   - cobertura: quanto do texto se encaixa em palavras comuns da língua.
// As tabelas vêm de js/dados/modelos.js (gerado por ferramentas/gerar_modelos.py).

import { META, MODELOS } from './dados/modelos.js';
import { letras, fracaoImprimivel, semAcento } from './texto.js';

export const LINGUAS = ['pt', 'en'];
export const NOME_LINGUA = { pt: 'português', en: 'inglês' };

const CURTAS = {
  pt: new Set('DE DA DO EM UM NO NA SE EU ME TE AO OS AS OU JA AI SO TU TA HA IR VI'.split(' ')),
  en: new Set('OF TO IN IS IT ON AT AS BE BY HE WE OR AN IF MY ME NO SO UP DO GO US AM'.split(' ')),
};

function valor(ch) {
  return META.alfabeto.indexOf(ch);
}

function criarModelo(lingua) {
  const m = MODELOS[lingua];
  const lo = META.lo;
  const passo = META.passo;
  const N4 = 26 * 26 * 26 * 26;
  const tri = new Float32Array(26 * 26 * 26).fill(lo);
  const bi = new Float32Array(26 * 26).fill(lo);
  for (let i = 0; i < tri.length; i++) {
    const v = valor(m.triVals[i]);
    if (v > 0) tri[i] = lo + passo * v;
  }
  for (let i = 0; i < bi.length; i++) {
    const v = valor(m.biVals[i]);
    if (v > 0) bi[i] = lo + passo * v;
  }
  const quad = new Float32Array(N4);
  // O que a tabela esparsa não tem vem de trigramas e bigramas (com um castigo
  // por ser estimativa), para um quadrigrama raro não zerar o texto inteiro.
  for (let a = 0; a < 26; a++) {
    for (let b = 0; b < 26; b++) {
      for (let c = 0; c < 26; c++) {
        for (let d = 0; d < 26; d++) {
          const est = tri[(a * 26 + b) * 26 + c] + tri[(b * 26 + c) * 26 + d] - bi[b * 26 + c] - 1.2;
          quad[((a * 26 + b) * 26 + c) * 26 + d] = Math.max(lo, Math.min(-3, est));
        }
      }
    }
  }
  const chaves = m.quadChaves;
  for (let i = 0, k = 0; i < chaves.length; i += 4, k++) {
    const idx =
      (((chaves.charCodeAt(i) - 65) * 26 + (chaves.charCodeAt(i + 1) - 65)) * 26 +
        (chaves.charCodeAt(i + 2) - 65)) * 26 + (chaves.charCodeAt(i + 3) - 65);
    quad[idx] = lo + passo * valor(m.quadVals[k]);
  }

  const palavras = new Set();
  for (const p of m.palavras.split(' ')) {
    const w = letras(p);
    if (w.length >= 3 || CURTAS[lingua].has(w)) palavras.add(w);
  }
  for (const w of CURTAS[lingua]) palavras.add(w);

  return {
    quad,
    palavras,
    unigramas: m.unigramas,
    mediaLingua: m.mediaLingua,
    mediaAleat: m.mediaAleat,
  };
}

const modelos = {};
for (const l of LINGUAS) modelos[l] = criarModelo(l);

export function frequenciaLetras(lingua) {
  return modelos[lingua].unigramas;
}

export function tabelaQuad(lingua) {
  return modelos[lingua].quad;
}

/** Média do log da probabilidade dos quadrigramas de uma sequência A-Z. */
export function quadMedio(L, lingua) {
  const n = L.length - 3;
  if (n < 1) return modelos[lingua].mediaAleat;
  const q = modelos[lingua].quad;
  let s = 0;
  let a = L.charCodeAt(0) - 65;
  let b = L.charCodeAt(1) - 65;
  let c = L.charCodeAt(2) - 65;
  for (let i = 3; i < L.length; i++) {
    const d = L.charCodeAt(i) - 65;
    s += q[((a * 26 + b) * 26 + c) * 26 + d];
    a = b; b = c; c = d;
  }
  return s / n;
}

function normalizarMedia(media, lingua) {
  const m = modelos[lingua];
  return Math.max(0, Math.min(1, (media - m.mediaAleat) / (m.mediaLingua - m.mediaAleat)));
}

/** 0 a 1: o quanto a sequência A-Z parece a língua, pelo melhor dos dois idiomas. */
export function ngramNota(L) {
  if (L.length < 4) return 0;
  let melhor = 0;
  for (const l of LINGUAS) melhor = Math.max(melhor, normalizarMedia(quadMedio(L, l), l));
  return melhor;
}

/** Peso de uma palavra na cobertura: palavra curta sozinha prova pouco (texto aleatório acha "de", "um"). */
function pesoPalavra(l) {
  return l >= 4 ? l : l === 3 ? l * 0.8 : l * 0.35;
}

/** Cobertura por palavras: letras que cabem em palavras conhecidas, com peso por tamanho. */
function coberturaToken(T, lingua) {
  const n = T.length;
  const set = modelos[lingua].palavras;
  const melhor = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    let m = melhor[i - 1];
    const maxL = Math.min(18, i);
    for (let l = 2; l <= maxL; l++) {
      if (set.has(T.slice(i - l, i))) {
        const v = melhor[i - l] + pesoPalavra(l);
        if (v > m) m = v;
      }
    }
    melhor[i] = m;
  }
  return melhor[n];
}

/** Palavras separadas por espaço (ou pontuação): o texto já vem "tokenizado". */
function tokens(texto) {
  return semAcento(texto).toUpperCase().match(/[A-Z]+/g) ?? [];
}

function coberturaTotal(texto, lingua) {
  const ts = tokens(texto);
  let total = 0;
  let cob = 0;
  for (const t of ts) {
    total += t.length;
    cob += coberturaToken(t, lingua);
  }
  return total ? cob / total : 0;
}

/**
 * Nota de 0 a 1 de quanto `texto` parece uma língua, mais a língua provável.
 * Texto curto demais não tem como ganhar nota alta com segurança: a nota
 * já sai achatada e `letrasContadas` deixa a tela avisar.
 */
export function pontuar(texto) {
  const L = letras(texto);
  const imp = fracaoImprimivel(texto);
  if (L.length < 3) return { nota: 0, lingua: 'pt', ngram: 0, cobertura: 0, letras: L.length };

  // "xxxxx" e "abcdefgh" têm cara de língua para quadrigrama e não são texto
  let sequencial = 0;
  for (let i = 0; i + 1 < L.length; i++) if (L.charCodeAt(i + 1) - L.charCodeAt(i) === 1) sequencial++;
  const fatorLixo = (new Set(L).size < 4 && L.length >= 6 ? 0.1 : 1) * (sequencial / (L.length - 1) > 0.4 ? 0.2 : 1);

  let melhor = { nota: -1 };
  for (const lingua of LINGUAS) {
    const ng = L.length >= 4 ? normalizarMedia(quadMedio(L, lingua), lingua) : 0;
    const cob = coberturaTotal(texto, lingua);
    const cobN = Math.max(0, Math.min(1, (cob - 0.15) / 0.7));
    let nota = L.length >= 4 ? 0.35 * ng + 0.65 * cobN : 0.7 * cobN;
    // texto com cara de língua (ngram alto) mas sem palavra de verdade é lixo otimizado
    nota = Math.min(nota, 0.2 + cobN);
    // quase só letras de verdade? texto cheio de símbolo e número perde nota
    const naoEspaco = texto.replace(/\s/g, '').length || 1;
    const fatorLetras = Math.min(1, L.length / naoEspaco + 0.25);
    nota *= fatorLetras;
    // texto curto: ngram e cobertura enganam fácil
    if (L.length < 8) nota *= 0.8 + 0.2 * (L.length / 8);
    nota *= Math.max(0, 1 - (1 - imp) * 2);
    nota *= fatorLixo;
    if (nota > melhor.nota) melhor = { nota, lingua, ngram: ng, cobertura: cob, letras: L.length };
  }
  return melhor;
}

/**
 * Parte uma sequência A-Z sem espaço em palavras (programação dinâmica pelo
 * maior número de letras cobertas). Devolve uma lista de pedaços.
 */
export function segmentar(L, lingua) {
  const n = L.length;
  const set = modelos[lingua].palavras;
  const melhor = new Float64Array(n + 1);
  const volta = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    melhor[i] = melhor[i - 1] - 0.6; // letra solta custa
    volta[i] = 1;
    const maxL = Math.min(18, i);
    for (let l = 2; l <= maxL; l++) {
      if (set.has(L.slice(i - l, i))) {
        const v = melhor[i - l] + l * l * 0.5;
        if (v > melhor[i]) { melhor[i] = v; volta[i] = l; }
      }
    }
  }
  const pedacos = [];
  for (let i = n; i > 0; i -= volta[i]) pedacos.push(L.slice(i - volta[i], i));
  pedacos.reverse();
  // junta letras soltas vizinhas num pedaço só
  const out = [];
  let solto = '';
  for (const p of pedacos) {
    if (p.length === 1 && !set.has(p)) { solto += p; continue; }
    if (solto) { out.push(solto); solto = ''; }
    out.push(p);
  }
  if (solto) out.push(solto);
  return out;
}
