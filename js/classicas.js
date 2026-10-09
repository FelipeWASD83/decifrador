// Cifras clássicas e XOR: o que dá para quebrar sem a chave, só pela
// estatística da língua.
//
// Mesma forma dos codecs: { id, nome, grupo: 'cifra', pesado?, tenta(estado, ctx) }.

import {
  mapearLetras, aleatorio, bytesDe, estadoDeBytes, fracaoAscii,
} from './texto.js';
import {
  LINGUAS, quadMedio, tabelaQuad, frequenciaLetras, ngramNota, pontuar,
} from './lingua.js';

const A = 65;

/** Só A-Z, sem tirar acento: as cifras clássicas deixam "á" e "ç" como estão, então não contam como letra. */
const letras = (s) => s.replace(/[^A-Za-z]/g, '').toUpperCase();

/** Nota rápida para escolher entre muitas tentativas da mesma cifra. */
function notaRapida(texto) {
  const L = letras(texto);
  if (L.length <= 60) return pontuar(texto).nota;
  return ngramNota(L);
}

function melhores(lista, n) {
  return lista.sort((a, b) => b.nota - a.nota).slice(0, n);
}

function saida(texto, detalhe) {
  return { estado: { texto, bin: false }, detalhe, estrito: false };
}

function temLetras(estado, minimo) {
  return !estado.bin && letras(estado.texto).length >= minimo;
}

// ---------- César, Atbash, Afim ----------

const cesar = {
  id: 'cesar',
  nome: 'Cifra de César',
  grupo: 'cifra',
  tenta(estado) {
    if (!temLetras(estado, 4)) return [];
    const t = estado.texto;
    const cands = [];
    for (let k = 1; k < 26; k++) {
      const r = mapearLetras(t, (_, c) => c - k);
      cands.push({ k, r, nota: notaRapida(r) });
    }
    return melhores(cands, 3).map(({ k, r }) =>
      saida(r, k === 13 ? 'ROT13' : `deslocamento de ${k} letras`));
  },
};

const atbash = {
  id: 'atbash',
  nome: 'Atbash (alfabeto invertido)',
  grupo: 'cifra',
  tenta(estado) {
    if (!temLetras(estado, 4)) return [];
    return [saida(mapearLetras(estado.texto, (_, c) => 25 - c), 'A↔Z, B↔Y...')];
  },
};

const INVERSOS = { 1: 1, 3: 9, 5: 21, 7: 15, 9: 3, 11: 19, 15: 7, 17: 23, 19: 11, 21: 5, 23: 17, 25: 25 };

const afim = {
  id: 'afim',
  nome: 'Cifra afim',
  grupo: 'cifra',
  tenta(estado) {
    if (!temLetras(estado, 10)) return [];
    const t = estado.texto;
    const cands = [];
    for (const [a, inv] of Object.entries(INVERSOS)) {
      for (let b = 0; b < 26; b++) {
        if (a === '1') continue;
        const r = mapearLetras(t, (_, c) => inv * (c - b));
        cands.push({ a, b, r, nota: notaRapida(r) });
      }
    }
    return melhores(cands, 2).map(({ a, b, r }) => saida(r, `a = ${a}, b = ${b}`));
  },
};

// ---------- Vigenère e Beaufort ----------

function indiceCoincidencia(col) {
  const cont = new Array(26).fill(0);
  for (const c of col) cont[c]++;
  const n = col.length;
  if (n < 2) return 0;
  let s = 0;
  for (const x of cont) s += x * (x - 1);
  return s / (n * (n - 1));
}

function dividirColunas(codes, m) {
  const cols = Array.from({ length: m }, () => []);
  codes.forEach((c, i) => cols[i % m].push(c));
  return cols;
}

function decifrarPoli(codes, chave, modo) {
  const m = chave.length;
  let s = '';
  for (let i = 0; i < codes.length; i++) {
    const k = chave[i % m];
    const p = modo === 'vigenere' ? codes[i] - k : k - codes[i];
    s += String.fromCharCode(A + ((p % 26) + 26) % 26);
  }
  return s;
}

function melhorChaveColuna(col, modo, freq) {
  let melhor = 0, menor = Infinity;
  for (let k = 0; k < 26; k++) {
    const cont = new Array(26).fill(0);
    for (const c of col) cont[(((modo === 'vigenere' ? c - k : k - c) % 26) + 26) % 26]++;
    let chi = 0;
    for (let i = 0; i < 26; i++) {
      const esp = freq[i] * col.length;
      chi += ((cont[i] - esp) ** 2) / (esp || 1e-9);
    }
    if (chi < menor) { menor = chi; melhor = k; }
  }
  return melhor;
}

function tamanhosProvaveis(codes) {
  const n = codes.length;
  const maxM = Math.max(3, Math.min(30, Math.floor(n / 10)));
  const ics = [];
  for (let m = 2; m <= maxM; m++) {
    const cols = dividirColunas(codes, m);
    ics.push({ m, ic: cols.reduce((s, c) => s + indiceCoincidencia(c), 0) / m });
  }
  if (!ics.length) return [];
  const maior = Math.max(...ics.map((x) => x.ic));
  const bons = ics.filter((x) => x.ic >= Math.max(0.05, maior * 0.85)).sort((a, b) => a.m - b.m);
  const escolhidos = [];
  for (const b of bons) {
    if (escolhidos.some((e) => b.m % e === 0)) continue;
    escolhidos.push(b.m);
    if (escolhidos.length === 3) break;
  }
  return escolhidos;
}

function refinarChave(codes, chave, modo, lingua) {
  let melhor = quadMedio(decifrarPoli(codes, chave, modo), lingua);
  const k = chave.slice();
  for (let volta = 0; volta < 3; volta++) {
    let mudou = false;
    for (let j = 0; j < k.length; j++) {
      const orig = k[j];
      let melhorK = orig;
      for (let x = 0; x < 26; x++) {
        if (x === orig) continue;
        k[j] = x;
        const s = quadMedio(decifrarPoli(codes, k, modo), lingua);
        if (s > melhor + 1e-9) { melhor = s; melhorK = x; mudou = true; }
      }
      k[j] = melhorK;
    }
    if (!mudou) break;
  }
  return k;
}

function quebrarPoli(estado, modo) {
  if (!temLetras(estado, 24)) return [];
  const L = letras(estado.texto);
  const amostra = L.slice(0, 1500);
  const codes = [...amostra].map((c) => c.charCodeAt(0) - A);
  const tamanhos = tamanhosProvaveis(codes);
  const cands = [];
  for (const m of tamanhos) {
    for (const lingua of LINGUAS) {
      const cols = dividirColunas(codes, m);
      const freq = frequenciaLetras(lingua);
      let chave = cols.map((c) => melhorChaveColuna(c, modo, freq));
      chave = refinarChave(codes, chave, modo, lingua);
      const todos = [...L].map((c) => c.charCodeAt(0) - A);
      const claro = decifrarPoli(todos, chave, modo);
      cands.push({ chave, nota: ngramNota(claro) });
    }
  }
  const unicos = new Map();
  for (const c of cands) {
    const nome = c.chave.map((k) => String.fromCharCode(A + k)).join('');
    if (!unicos.has(nome) || unicos.get(nome).nota < c.nota) unicos.set(nome, { ...c, nome });
  }
  return melhores([...unicos.values()], 2).map(({ chave, nome }) => {
    const r = mapearLetras(estado.texto, (i, c) => (modo === 'vigenere' ? c - chave[i % chave.length] : chave[i % chave.length] - c));
    return saida(r, `chave "${nome}" (${chave.length} letras)`);
  });
}

const vigenere = {
  id: 'vigenere',
  nome: 'Vigenère',
  grupo: 'cifra',
  tenta: (estado) => quebrarPoli(estado, 'vigenere'),
};

const beaufort = {
  id: 'beaufort',
  nome: 'Beaufort',
  grupo: 'cifra',
  tenta: (estado) => quebrarPoli(estado, 'beaufort'),
};

// ---------- Transposições ----------

function railDecifrar(s, r) {
  const n = s.length;
  const ciclo = 2 * (r - 1);
  const trilho = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = i % ciclo;
    trilho[i] = p < r ? p : ciclo - p;
  }
  const ordem = Array.from({ length: n }, (_, i) => i).sort((a, b) => trilho[a] - trilho[b] || a - b);
  const out = new Array(n);
  for (let k = 0; k < n; k++) out[ordem[k]] = s[k];
  return out.join('');
}

const railFence = {
  id: 'rail',
  nome: 'Cerca de trilhos (rail fence)',
  grupo: 'cifra',
  tenta(estado) {
    if (!temLetras(estado, 8)) return [];
    const variantes = [['', estado.texto], [' (sem as pontas em branco)', estado.texto.trim()], [' sem espaços', estado.texto.replace(/\s+/g, '')]];
    const cands = [];
    const vistos = new Set();
    for (const [rotulo, s] of variantes) {
      if (vistos.has(s)) continue;
      vistos.add(s);
      for (let r = 2; r <= Math.min(14, Math.floor(s.length / 2)); r++) {
        const t = railDecifrar(s, r);
        cands.push({ r, rotulo, t, nota: notaRapida(t) });
      }
    }
    return melhores(cands, 2).map(({ r, rotulo, t }) => saida(t, `${r} trilhos${rotulo}`));
  },
};

/** Lê o texto cifrado em colunas segundo `ordem` (ordem em que as colunas foram lidas). */
function colunarDecifrar(cod, k, ordem, saidaCodes) {
  const n = cod.length;
  const cheias = Math.floor(n / k);
  const extra = n % k;
  const inicio = new Int32Array(k);
  let pos = 0;
  for (let j = 0; j < k; j++) {
    const c = ordem[j];
    inicio[c] = pos;
    pos += cheias + (c < extra ? 1 : 0);
  }
  for (let i = 0; i < n; i++) {
    const c = i % k;
    saidaCodes[i] = cod[inicio[c] + Math.floor(i / k)];
  }
}

function pontuarCodes(codes, q) {
  const n = codes.length;
  let s = 0;
  for (let i = 3; i < n; i++) s += q[((codes[i - 3] * 26 + codes[i - 2]) * 26 + codes[i - 1]) * 26 + codes[i]];
  return s / Math.max(1, n - 3);
}

function* permutacoes(k) {
  const a = Array.from({ length: k }, (_, i) => i);
  const c = new Array(k).fill(0);
  yield a.slice();
  let i = 0;
  while (i < k) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      [a[j], a[i]] = [a[i], a[j]];
      yield a.slice();
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

function linguaDoMonte(L) {
  // transposição não muda a contagem de letras: a língua sai do ciphertext
  let melhor = LINGUAS[0], menor = Infinity;
  const cont = new Array(26).fill(0);
  for (const ch of L) cont[ch.charCodeAt(0) - A]++;
  for (const l of LINGUAS) {
    const f = frequenciaLetras(l);
    let chi = 0;
    for (let i = 0; i < 26; i++) chi += ((cont[i] / L.length - f[i]) ** 2) / (f[i] || 1e-6);
    if (chi < menor) { menor = chi; melhor = l; }
  }
  return melhor;
}

const colunar = {
  id: 'colunar',
  nome: 'Transposição por colunas',
  grupo: 'cifra',
  pesado: true,
  tenta(estado) {
    if (!temLetras(estado, 12)) return [];
    const L = letras(estado.texto);
    if (L.length > 1500) return [];
    // só vale a pena se o texto era (quase) só letras
    const visiveis = estado.texto.replace(/\s/g, '').length;
    if (L.length / visiveis < 0.9) return [];
    const cod = Uint8Array.from([...L].map((c) => c.charCodeAt(0) - A));
    const lingua = linguaDoMonte(L);
    const q = tabelaQuad(lingua);
    const kMax = L.length <= 900 ? 8 : 7;
    const saidaCodes = new Uint8Array(cod.length);
    const cands = [];
    for (let k = 2; k <= Math.min(kMax, Math.floor(L.length / 2)); k++) {
      let pior = Infinity;
      const topo = [];
      for (const ordem of permutacoes(k)) {
        colunarDecifrar(cod, k, ordem, saidaCodes);
        const s = pontuarCodes(saidaCodes, q);
        if (topo.length < 2 || s > pior) {
          topo.push({ s, ordem: ordem.slice(), k, texto: String.fromCharCode(...Array.from(saidaCodes, (x) => A + x)) });
          topo.sort((a, b) => b.s - a.s);
          if (topo.length > 2) topo.pop();
          pior = topo[topo.length - 1].s;
        }
      }
      cands.push(...topo);
    }
    // "escítala": mais colunas do que as permutações dão conta, só na ordem natural
    for (let k = kMax + 1; k <= Math.min(40, Math.floor(L.length / 2)); k++) {
      const ordem = Array.from({ length: k }, (_, i) => i);
      colunarDecifrar(cod, k, ordem, saidaCodes);
      cands.push({ s: pontuarCodes(saidaCodes, q), ordem, k, texto: String.fromCharCode(...Array.from(saidaCodes, (x) => A + x)) });
    }
    return cands
      .sort((a, b) => b.s - a.s)
      .slice(0, 2)
      .map(({ k, ordem, texto }) => saida(texto, `${k} colunas, lidas na ordem ${ordem.map((x) => x + 1).join('-')}`));
  },
};

// ---------- Substituição simples (escalada de colina) ----------

function escalar(cod, q, chaveInicial, passosMax = 60) {
  const n = cod.length;
  const chave = Int8Array.from(chaveInicial);
  const presente = new Uint8Array(26);
  for (const c of cod) presente[c] = 1;
  const nota = () => {
    let s = 0;
    let a = chave[cod[0]], b = chave[cod[1]], c = chave[cod[2]];
    for (let i = 3; i < n; i++) {
      const d = chave[cod[i]];
      s += q[((a * 26 + b) * 26 + c) * 26 + d];
      a = b; b = c; c = d;
    }
    return s;
  };
  let melhor = nota();
  for (let passo = 0; passo < passosMax; passo++) {
    let melhorou = false;
    for (let i = 0; i < 25; i++) {
      for (let j = i + 1; j < 26; j++) {
        if (!presente[i] && !presente[j]) continue;
        const t = chave[i]; chave[i] = chave[j]; chave[j] = t;
        const s = nota();
        if (s > melhor + 1e-9) { melhor = s; melhorou = true; } else { chave[j] = chave[i]; chave[i] = t; }
      }
    }
    if (!melhorou) break;
  }
  return { chave, nota: melhor / (n - 3) };
}

function resolverSubstituicao(L, lingua) {
  const amostra = L.slice(0, 700);
  const cod = Uint8Array.from([...amostra].map((c) => c.charCodeAt(0) - A));
  const q = tabelaQuad(lingua);
  const freqLingua = frequenciaLetras(lingua);
  const cont = new Array(26).fill(0);
  for (const c of cod) cont[c]++;
  const cifradas = Array.from({ length: 26 }, (_, i) => i).sort((a, b) => cont[b] - cont[a]);
  const claras = Array.from({ length: 26 }, (_, i) => i).sort((a, b) => freqLingua[b] - freqLingua[a]);
  const inicial = new Int8Array(26);
  cifradas.forEach((c, i) => { inicial[c] = claras[i]; });

  const rand = aleatorio(20260909);
  let melhor = escalar(cod, q, inicial);
  let semMelhora = 0;
  for (let r = 0; r < 30 && semMelhora < 8; r++) {
    const k = Int8Array.from(melhor.chave);
    for (let p = 0; p < 4; p++) {
      const i = Math.floor(rand() * 26), j = Math.floor(rand() * 26);
      const t = k[i]; k[i] = k[j]; k[j] = t;
    }
    const cand = escalar(cod, q, k);
    if (cand.nota > melhor.nota + 1e-6) { melhor = cand; semMelhora = 0; } else semMelhora++;
  }
  return melhor;
}

const substituicao = {
  id: 'substituicao',
  nome: 'Substituição simples (alfabeto embaralhado)',
  grupo: 'cifra',
  pesado: true,
  tenta(estado) {
    if (!temLetras(estado, 80)) return [];
    const visiveis = estado.texto.replace(/\s/g, '');
    const digitos = (visiveis.match(/\d/g) ?? []).length;
    if (digitos / visiveis.length > 0.03) return [];
    const L = letras(estado.texto);
    let melhor = null;
    for (const lingua of LINGUAS) {
      const r = resolverSubstituicao(L, lingua);
      if (!melhor || r.nota > melhor.nota) melhor = { ...r, lingua };
    }
    const chave = melhor.chave;
    const texto = mapearLetras(estado.texto, (_, c) => chave[c]);
    // escalada de colina inventa "língua" em qualquer coisa: só vale com palavras de verdade
    if (pontuar(texto).cobertura < 0.55) return [];
    const alfabeto = [...chave].map((c) => String.fromCharCode(A + c)).join('');
    return [saida(texto, `A-Z vira ${alfabeto}`)];
  },
};

// ---------- XOR ----------

const PESO_BYTE = (() => {
  const w = new Float64Array(256).fill(-0.05);
  const fa = frequenciaLetras('pt');
  const fb = frequenciaLetras('en');
  for (let i = 0; i < 26; i++) {
    const f = (fa[i] + fb[i]) / 2;
    w[97 + i] = f;
    w[65 + i] = f * 0.35;
  }
  w[32] = 0.19;
  w[10] = 0.01; w[13] = 0.0; w[9] = 0.0;
  for (const c of ',.\'-"!?:;()') w[c.charCodeAt(0)] = 0.008;
  for (let d = 48; d <= 57; d++) w[d] = 0.006;
  for (let i = 0; i < 32; i++) if (![9, 10, 13].includes(i)) w[i] = -0.6;
  w[127] = -0.6;
  return w;
})();

function xorSimples(bytes, k) {
  const o = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) o[i] = bytes[i] ^ k;
  return o;
}

function xorChave(bytes, chave) {
  const o = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) o[i] = bytes[i] ^ chave[i % chave.length];
  return o;
}

/** Nota de um texto vindo de XOR: a língua das letras mais o quanto é ASCII legível. */
function notaXor(bytes) {
  const t = String.fromCharCode(...bytes.subarray(0, 400));
  const L = letras(t);
  let q = -16;
  if (L.length >= 8) q = Math.max(...LINGUAS.map((l) => quadMedio(L, l)));
  return q + 10 * fracaoAscii(t);
}

/** Depois da chave achada por frequência, ajusta byte a byte pelo texto inteiro (coluna curta erra espaço e maiúscula). */
function refinarXor(b, chave) {
  const k = Uint8Array.from(chave);
  let melhor = notaXor(xorChave(b, k));
  for (let volta = 0; volta < 2; volta++) {
    let mudou = false;
    for (let j = 0; j < k.length; j++) {
      const orig = k[j];
      let melhorK = orig;
      for (let x = 0; x < 256; x++) {
        if (x === orig) continue;
        k[j] = x;
        const s = notaXor(xorChave(b, k));
        if (s > melhor + 1e-9) { melhor = s; melhorK = x; mudou = true; }
      }
      k[j] = melhorK;
    }
    if (!mudou) break;
  }
  return k;
}

function paraCandidato(bytes, detalhe) {
  const e = estadoDeBytes(bytes);
  return { estado: e, detalhe, estrito: false, nota: e.bin ? 0 : pontuar(e.texto).nota };
}

const xorUm = {
  id: 'xor1',
  nome: 'XOR com 1 byte',
  grupo: 'cifra',
  tenta(estado) {
    const b = bytesDe(estado);
    if (b.length < 4) return [];
    const cands = [];
    for (let k = 1; k < 256; k++) {
      const o = xorSimples(b, k);
      if (fracaoAscii(String.fromCharCode(...o.subarray(0, 400))) < 0.9) continue;
      cands.push(paraCandidato(o, `chave 0x${k.toString(16).padStart(2, '0')}`));
    }
    return melhores(cands, 3);
  },
};

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = a[i] ^ b[i];
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

const xorVarios = {
  id: 'xorN',
  nome: 'XOR com chave repetida',
  grupo: 'cifra',
  tenta(estado) {
    const b = bytesDe(estado);
    if (b.length < 24) return [];
    const tamanhos = [];
    for (let t = 2; t <= Math.min(40, Math.floor(b.length / 4)); t++) {
      const blocos = Math.min(24, Math.floor(b.length / t));
      let soma = 0, pares = 0;
      for (let i = 0; i + 1 < blocos; i++) {
        soma += hamming(b.subarray(i * t, (i + 1) * t), b.subarray((i + 1) * t, (i + 2) * t)) / t;
        pares++;
      }
      if (pares) tamanhos.push({ t, d: soma / pares });
    }
    if (!tamanhos.length) return [];
    // múltiplos do período verdadeiro empatam com ele: vale o menor tamanho perto do mínimo
    const dmin = Math.min(...tamanhos.map((x) => x.d));
    const escolhidos = [];
    for (const { t } of tamanhos.filter((x) => x.d <= dmin * 1.1).sort((a, c) => a.t - c.t)) {
      if (escolhidos.some((e) => t % e === 0)) continue;
      escolhidos.push(t);
      if (escolhidos.length === 3) break;
    }
    // chave com metades parecidas (ex.: "secret") engana o Hamming: também vale o dobro e o triplo
    const lista = [];
    for (const t of escolhidos) {
      for (const m of [1, 2, 3]) {
        const alvo = tamanhos.find((x) => x.t === t * m);
        if (alvo && (m === 1 || alvo.d <= dmin * 1.3) && !lista.includes(t * m)) lista.push(t * m);
      }
    }
    const cands = [];
    for (const t of lista) {
      let chave = new Uint8Array(t);
      for (let c = 0; c < t; c++) {
        let melhor = 0, melhorS = -Infinity;
        for (let k = 0; k < 256; k++) {
          let s = 0;
          for (let i = c; i < b.length; i += t) s += PESO_BYTE[b[i] ^ k];
          if (s > melhorS) { melhorS = s; melhor = k; }
        }
        chave[c] = melhor;
      }
      // só vale refinar se a chave por frequência já deu algo com cara de texto (senão é gasto à toa)
      if (notaXor(xorChave(b, chave)) < -2.5) continue;
      chave = refinarXor(b, chave);
      for (let per = 1; per < chave.length; per++) {
        if (chave.length % per === 0 && chave.every((k, i) => k === chave[i % per])) { chave = chave.slice(0, per); break; }
      }
      const leg = [...chave].map((k) => (k >= 32 && k < 127 ? String.fromCharCode(k) : `\\x${k.toString(16).padStart(2, '0')}`)).join('');
      cands.push(paraCandidato(xorChave(b, chave), `chave de ${t} bytes: ${leg}`));
    }
    return melhores(cands, 2);
  },
};

// ---------- Chave conhecida (campo opcional da tela) ----------

function codigosDaChave(chave) {
  return [...letras(chave)].map((c) => c.charCodeAt(0) - A);
}

const comChave = {
  id: 'chave',
  nome: 'Com a chave que você deu',
  grupo: 'cifra',
  tenta(estado, ctx) {
    const chave = (ctx?.chave ?? '').trim();
    if (!chave) return [];
    const out = [];
    const k = codigosDaChave(chave);
    if (k.length && !estado.bin && letras(estado.texto).length >= 4) {
      out.push(saida(mapearLetras(estado.texto, (i, c) => c - k[i % k.length]), `Vigenère com "${chave}"`));
      out.push(saida(mapearLetras(estado.texto, (i, c) => k[i % k.length] - c), `Beaufort com "${chave}"`));
      // autochave: depois da chave, a própria mensagem em claro faz o papel de chave
      const L = letras(estado.texto);
      const claro = [];
      for (let i = 0; i < L.length; i++) {
        const kk = i < k.length ? k[i] : claro[i - k.length];
        claro.push((((L.charCodeAt(i) - A - kk) % 26) + 26) % 26);
      }
      out.push(saida(mapearLetras(estado.texto, (i) => claro[i]), `autochave com "${chave}"`));
    }
    const kb = new TextEncoder().encode(chave);
    out.push(paraCandidato(xorChave(bytesDe(estado), kb), `XOR com "${chave}"`));
    if (/^([0-9a-f]{2})+$/i.test(chave)) {
      const kh = Uint8Array.from(chave.match(/../g).map((x) => parseInt(x, 16)));
      out.push(paraCandidato(xorChave(bytesDe(estado), kh), `XOR com 0x${chave}`));
    }
    return out;
  },
};

export const CLASSICAS = [
  comChave, cesar, atbash, afim, xorUm, xorVarios, vigenere, beaufort, railFence, colunar, substituicao,
];
