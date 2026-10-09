// Codificações e representações: o que tem volta exata, sem chave.
//
// Cada item: { id, nome, grupo: 'codificacao', tenta(estado, ctx) }
// `tenta` devolve uma lista de { estado, detalhe } (vazia se o formato não
// bate) e pode ser assíncrona. `estrito` marca decodificação que só funciona
// quando o formato é exato (Base64, hex...): o motor dá a elas uma folga
// para o passo intermediário não ser descartado por parecer lixo.

import { bytesDe, bytesDeLatin1, estadoDeBytes } from './texto.js';

function limpo(t) {
  return t.replace(/\s+/g, '');
}

/** Bytes que viram resultado: binário curto demais é ruído, não passo intermediário. */
function deBytes(bytes, detalhe, { minBin = 6, exigeTexto = false } = {}) {
  if (!bytes.length) return [];
  const estado = estadoDeBytes(bytes);
  if (estado.bin && (exigeTexto || bytes.length < minBin)) return [];
  return [{ estado, detalhe, estrito: true }];
}

function deTexto(texto, detalhe, estrito = false) {
  return [{ estado: { texto, bin: false }, detalhe, estrito }];
}

// ---------- Base64 / Base32 / Base58 / Base85 ----------

function base64Bytes(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (t.length % 4 === 1) return null;
  while (t.length % 4) t += '=';
  try {
    return bytesDeLatin1(atob(t));
  } catch {
    return null;
  }
}

const base64 = {
  id: 'base64',
  nome: 'Base64',
  grupo: 'codificacao',
  tenta(estado) {
    const s = limpo(estado.texto);
    if (s.length < 8) return [];
    const padrao = /^[A-Za-z0-9+/]+={0,2}$/.test(s);
    const seguro = /^[A-Za-z0-9\-_]+={0,2}$/.test(s);
    if (!padrao && !seguro) return [];
    const b = base64Bytes(s);
    if (!b) return [];
    // palavra comum que por acaso é Base64 válido: só segue se o resultado for texto
    const pareceBase64 = /[0-9+/=_-]/.test(s) || s.length >= 24;
    return deBytes(b, padrao ? 'alfabeto padrão' : 'alfabeto de URL', { exigeTexto: !pareceBase64 });
  },
};

const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32 = {
  id: 'base32',
  nome: 'Base32',
  grupo: 'codificacao',
  tenta(estado) {
    const s = limpo(estado.texto).toUpperCase();
    if (s.length < 8 || !/^[A-Z2-7]+=*$/.test(s)) return [];
    const dados = s.replace(/=+$/, '');
    let bits = 0, acc = 0;
    const out = [];
    for (const ch of dados) {
      acc = (acc << 5) | A32.indexOf(ch);
      bits += 5;
      if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); acc &= (1 << bits) - 1; }
    }
    const temDigito = /[2-7]/.test(s) || s.includes('=');
    return deBytes(Uint8Array.from(out), 'RFC 4648', { exigeTexto: !temDigito });
  },
};

const A58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const base58 = {
  id: 'base58',
  nome: 'Base58',
  grupo: 'codificacao',
  tenta(estado) {
    const s = limpo(estado.texto);
    if (s.length < 8 || s.length > 4000 || ![...s].every((c) => A58.includes(c))) return [];
    let n = 0n;
    for (const c of s) n = n * 58n + BigInt(A58.indexOf(c));
    const bytes = [];
    while (n > 0n) { bytes.push(Number(n & 255n)); n >>= 8n; }
    for (const c of s) { if (c === '1') bytes.push(0); else break; }
    bytes.reverse();
    return deBytes(Uint8Array.from(bytes), 'alfabeto Bitcoin', { exigeTexto: !/[0-9]/.test(s) });
  },
};

const base85 = {
  id: 'base85',
  nome: 'Base85 (ASCII85)',
  grupo: 'codificacao',
  tenta(estado) {
    let s = estado.texto.trim();
    const delimitado = /^<~[\s\S]*~>$/.test(s);
    if (delimitado) s = s.slice(2, -2);
    s = s.replace(/\s+/g, '');
    if (s.length < 10 || !/^[!-uz]+$/.test(s)) return [];
    const simbolos = (s.match(/[^A-Za-z0-9]/g) ?? []).length;
    if (!delimitado && simbolos / s.length < 0.1) return [];
    const out = [];
    let grupo = [];
    const solta = (g, extra) => {
      let v = 0;
      for (let i = 0; i < 5; i++) v = v * 85 + (i < g.length ? g[i] : 84);
      const b = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
      out.push(...b.slice(0, 4 - extra));
    };
    for (const ch of s) {
      if (ch === 'z' && grupo.length === 0) { out.push(0, 0, 0, 0); continue; }
      grupo.push(ch.charCodeAt(0) - 33);
      if (grupo.length === 5) { solta(grupo, 0); grupo = []; }
    }
    if (grupo.length === 1) return [];
    if (grupo.length) solta(grupo, 5 - grupo.length);
    return deBytes(Uint8Array.from(out), delimitado ? 'com <~ ~>' : 'sem delimitador', { exigeTexto: true });
  },
};

// ---------- hex, binário, octal, decimal ----------

const hex = {
  id: 'hex',
  nome: 'Hexadecimal',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto.trim();
    if (!/^(?:(?:0x|\\x|%)?[0-9a-f]{2}[\s:,;.-]*)+$/i.test(t)) return [];
    const pares = t.replace(/0x|\\x|%/gi, '').match(/[0-9a-f]{2}/gi);
    const digitos = t.replace(/0x|\\x|%/gi, '').replace(/[^0-9a-f]/gi, '').length;
    if (!pares || digitos % 2 || pares.length < 3) return [];
    return deBytes(Uint8Array.from(pares.map((p) => parseInt(p, 16))), 'bytes em hexa');
  },
};

const binario = {
  id: 'binario',
  nome: 'Binário (ASCII)',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto.trim();
    if (!/^[01\s]+$/.test(t) || t.length < 16) return [];
    const toks = t.split(/\s+/);
    let bytes;
    if (toks.length > 1 && toks.every((x) => x.length === 8 || x.length === 7)) {
      bytes = toks.map((x) => parseInt(x, 2));
    } else {
      const s = limpo(t);
      if (s.length % 8) return [];
      bytes = s.match(/.{8}/g).map((x) => parseInt(x, 2));
    }
    return deBytes(Uint8Array.from(bytes), 'grupos de 8 bits', { exigeTexto: true });
  },
};

const octal = {
  id: 'octal',
  nome: 'Octal',
  grupo: 'codificacao',
  tenta(estado) {
    const toks = estado.texto.trim().split(/[\s,;]+/);
    if (toks.length < 3 || !toks.every((x) => /^[0-7]{1,3}$/.test(x))) return [];
    const v = toks.map((x) => parseInt(x, 8));
    if (v.some((x) => x > 255) || !toks.some((x) => x.length === 3)) return [];
    return deBytes(Uint8Array.from(v), 'octal', { exigeTexto: true });
  },
};

const decimal = {
  id: 'decimal',
  nome: 'Decimal (ASCII)',
  grupo: 'codificacao',
  tenta(estado) {
    const toks = estado.texto.trim().split(/[\s,;]+/);
    if (toks.length < 3 || !toks.every((x) => /^\d{1,3}$/.test(x))) return [];
    const v = toks.map(Number);
    if (v.some((x) => x > 255) || v.every((x) => x <= 26)) return [];
    return deBytes(Uint8Array.from(v), 'números de 0 a 255', { exigeTexto: true });
  },
};

const a1z26 = {
  id: 'a1z26',
  nome: 'A1Z26 (número = posição da letra)',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto.trim();
    if (!/^[\d\s,.\-/|]+$/.test(t)) return [];
    const palavras = t.split(/\s*[/|]\s*|\s{3,}/);
    const out = [];
    for (const p of palavras) {
      const toks = p.split(/[\s,.-]+/).filter(Boolean);
      if (!toks.length) continue;
      let w = '';
      for (const x of toks) {
        if (!/^\d{1,2}$/.test(x)) return [];
        const n = Number(x);
        if (n < 1 || n > 26) return [];
        w += String.fromCharCode(64 + n);
      }
      out.push(w);
    }
    const texto = out.join(' ');
    if (texto.replace(/ /g, '').length < 4) return [];
    return deTexto(texto, 'A=1 ... Z=26', true);
  },
};

// ---------- URL, entidades, escapes, quoted-printable ----------

const url = {
  id: 'url',
  nome: 'Percent-encoding (URL)',
  grupo: 'codificacao',
  tenta(estado) {
    if (!/%[0-9a-f]{2}/i.test(estado.texto)) return [];
    const bytes = [];
    const t = estado.texto;
    const enc = new TextEncoder();
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '%' && /^[0-9a-f]{2}$/i.test(t.slice(i + 1, i + 3))) {
        bytes.push(parseInt(t.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(...enc.encode(t[i]));
      }
    }
    return deBytes(Uint8Array.from(bytes), '%XX', { exigeTexto: true });
  },
};

const NOMES_HTML = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  agrave: 'à', atilde: 'ã', otilde: 'õ', acirc: 'â', ecirc: 'ê', ocirc: 'ô',
  ccedil: 'ç', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  Ccedil: 'Ç', Atilde: 'Ã', Otilde: 'Õ', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä',
};

const entidades = {
  id: 'html',
  nome: 'Entidades HTML',
  grupo: 'codificacao',
  tenta(estado) {
    if (!/&#?\w+;/.test(estado.texto)) return [];
    let mudou = false;
    const t = estado.texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, c) => {
      if (c[0] === '#') {
        const n = c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
        if (n > 0 && n < 0x110000) { mudou = true; return String.fromCodePoint(n); }
        return m;
      }
      if (NOMES_HTML[c] !== undefined) { mudou = true; return NOMES_HTML[c]; }
      return m;
    });
    return mudou ? deTexto(t, '&#65; e &amp;', true) : [];
  },
};

const escapes = {
  id: 'escapes',
  nome: 'Escapes \\u, \\x e U+',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto;
    if (!/\\u[0-9a-f]{4}|\\x[0-9a-f]{2}|U\+[0-9a-f]{4,6}|\\u\{[0-9a-f]+\}/i.test(t)) return [];
    const r = t
      .replace(/\\u\{([0-9a-f]+)\}/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/U\+([0-9a-f]{4,6})/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
    return r !== t ? deTexto(r, '\\uXXXX / \\xNN / U+XXXX', true) : [];
  },
};

const quotedPrintable = {
  id: 'qp',
  nome: 'Quoted-printable',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto;
    if (!/=[0-9A-F]{2}/.test(t)) return [];
    const bytes = [];
    const enc = new TextEncoder();
    const s = t.replace(/=\r?\n/g, '');
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) {
        bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(...enc.encode(s[i]));
      }
    }
    return deBytes(Uint8Array.from(bytes), '=XX', { exigeTexto: true });
  },
};

// ---------- Morse, Bacon, Polybius, NATO, braile, leet ----------

const MORSE = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F', '--.': 'G', '....': 'H',
  '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P',
  '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
  '-.--': 'Y', '--..': 'Z', '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
  '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9', '.-.-.-': '.', '--..--': ',',
  '..--..': '?', '.----.': "'", '-.-.--': '!', '-..-.': '/', '-.--.': '(', '-.--.-': ')',
  '---...': ':', '-...-': '=', '.-.-.': '+', '-....-': '-', '.-..-.': '"', '.--.-.': '@',
};

const morse = {
  id: 'morse',
  nome: 'Código Morse',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto
      .replace(/[·•]/g, '.').replace(/[–—_−]/g, '-').trim();
    if (!/^[.\-/|\s]+$/.test(t) || !/[.-]/.test(t)) return [];
    const palavras = t.split(/\s*[/|]\s*|\s{3,}/);
    const out = [];
    for (const p of palavras) {
      let w = '';
      for (const sim of p.trim().split(/\s+/)) {
        if (!sim) continue;
        const l = MORSE[sim];
        if (!l) return [];
        w += l;
      }
      out.push(w);
    }
    const texto = out.join(' ').trim();
    return texto.length >= 2 ? deTexto(texto, 'pontos e traços', true) : [];
  },
};

const bacon = {
  id: 'bacon',
  nome: 'Cifra de Bacon',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto.trim();
    if (!/^[abAB\s]+$/.test(t)) return [];
    const s = limpo(t).toUpperCase();
    if (s.length < 15 || s.length % 5) return [];
    const grupos = s.match(/.{5}/g).map((g) => parseInt(g.replace(/A/g, '0').replace(/B/g, '1'), 2));
    const alf26 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const alf24 = 'ABCDEFGHIKLMNOPQRSTUWXYZ'; // I=J e U=V
    const out = [];
    const v26 = grupos.map((g) => alf26[g] ?? '?').join('');
    if (!v26.includes('?')) out.push({ estado: { texto: v26, bin: false }, detalhe: '26 letras', estrito: true });
    const v24 = grupos.map((g) => alf24[g] ?? '?').join('');
    if (!v24.includes('?')) out.push({ estado: { texto: v24, bin: false }, detalhe: '24 letras (I=J, U=V)', estrito: true });
    return out;
  },
};

const QUADRADO = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // I e J juntos
const polybius = {
  id: 'polybius',
  nome: 'Quadrado de Políbio',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto.trim();
    if (!/^[1-5\s,.-]+$/.test(t)) return [];
    const d = t.replace(/[^1-5]/g, '');
    if (d.length < 8 || d.length % 2) return [];
    let r = '';
    for (let i = 0; i < d.length; i += 2) r += QUADRADO[(Number(d[i]) - 1) * 5 + (Number(d[i + 1]) - 1)];
    return deTexto(r, 'quadrado 5×5 (I=J)', true);
  },
};

const NATO = ['alfa', 'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet',
  'juliett', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform',
  'victor', 'whiskey', 'xray', 'x-ray', 'yankee', 'zulu'];
const nato = {
  id: 'nato',
  nome: 'Alfabeto fonético (NATO)',
  grupo: 'codificacao',
  tenta(estado) {
    const toks = estado.texto.toLowerCase().split(/[\s,.;-]+/).filter(Boolean);
    if (toks.length < 4) return [];
    const ok = toks.filter((x) => NATO.includes(x)).length;
    if (ok / toks.length < 0.9) return [];
    return deTexto(toks.filter((x) => NATO.includes(x)).map((x) => x[0].toUpperCase()).join(''), 'inicial de cada palavra', true);
  },
};

const BRAILE = { '⠁': 'a', '⠃': 'b', '⠉': 'c', '⠙': 'd', '⠑': 'e', '⠋': 'f', '⠛': 'g', '⠓': 'h', '⠊': 'i', '⠚': 'j',
  '⠅': 'k', '⠇': 'l', '⠍': 'm', '⠝': 'n', '⠕': 'o', '⠏': 'p', '⠟': 'q', '⠗': 'r', '⠎': 's', '⠞': 't', '⠥': 'u',
  '⠧': 'v', '⠺': 'w', '⠭': 'x', '⠽': 'y', '⠵': 'z', '⠀': ' ' };
const braile = {
  id: 'braile',
  nome: 'Braile',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto;
    if (!/[⠁-⣿]/.test(t)) return [];
    let r = '';
    for (const c of t) {
      if (c === '\n' || c === ' ') r += c;
      else if (BRAILE[c] !== undefined) r += BRAILE[c];
      else return [];
    }
    return deTexto(r, 'letras sem acento', true);
  },
};

const leet = {
  id: 'leet',
  nome: 'Leetspeak',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto;
    const marcas = (t.match(/[4310578@$!+]/g) ?? []).length;
    const letrasN = (t.match(/[a-z]/gi) ?? []).length;
    if (marcas < 2 || letrasN < 3) return [];
    const base = { 4: 'a', 3: 'e', 0: 'o', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '+': 't' };
    const troca = (um) => t.replace(/[43015 78@$!+]/g, (c) => (c === '1' ? um : c === '!' ? 'i' : base[c] ?? c));
    return [
      { estado: { texto: troca('i'), bin: false }, detalhe: '1 = i', estrito: false },
      { estado: { texto: troca('l'), bin: false }, detalhe: '1 = l', estrito: false },
    ];
  },
};

// ---------- ROT47, reverso, JWT, compressão ----------

const rot47 = {
  id: 'rot47',
  nome: 'ROT47',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto;
    if (t.length < 6) return [];
    const simbolos = (t.match(/[^A-Za-z\s]/g) ?? []).length;
    if (simbolos / t.length < 0.25) return [];
    let r = '';
    for (const c of t) {
      const n = c.charCodeAt(0);
      r += n >= 33 && n <= 126 ? String.fromCharCode(33 + ((n - 33 + 47) % 94)) : c;
    }
    return deTexto(r, 'rotação de 47 no ASCII visível', false);
  },
};

const reverso = {
  id: 'reverso',
  nome: 'Texto ao contrário',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto;
    if (t.length < 6) return [];
    const out = [{ estado: { texto: [...t].reverse().join(''), bin: false }, detalhe: 'letra por letra', estrito: false }];
    if (/\s/.test(t.trim())) {
      out.push({ estado: { texto: t.trim().split(/\s+/).reverse().join(' '), bin: false }, detalhe: 'ordem das palavras', estrito: false });
      out.push({ estado: { texto: t.split(/(\s+)/).map((p) => (/\s/.test(p) ? p : [...p].reverse().join(''))).join(''), bin: false }, detalhe: 'cada palavra ao contrário', estrito: false });
    }
    return out;
  },
};

const jwt = {
  id: 'jwt',
  nome: 'JWT (token com 3 partes)',
  grupo: 'codificacao',
  tenta(estado) {
    const t = estado.texto.trim();
    if (!/^[\w-]{4,}\.[\w-]{4,}\.[\w-]*$/.test(t)) return [];
    const partes = t.split('.').slice(0, 2).map((p) => base64Bytes(p));
    if (partes.some((p) => !p)) return [];
    const dec = new TextDecoder();
    return deTexto(partes.map((p) => dec.decode(p)).join('\n'), 'cabeçalho e conteúdo', true);
  },
};

async function inflar(bytes, formato) {
  const ds = new DecompressionStream(formato);
  const w = ds.writable.getWriter();
  w.write(bytes).catch(() => {});
  w.close().catch(() => {});
  const partes = [];
  const r = ds.readable.getReader();
  let total = 0;
  for (;;) {
    const { value, done } = await r.read();
    if (done) break;
    total += value.length;
    if (total > 20_000_000) throw new Error('grande demais');
    partes.push(value);
  }
  const saida = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { saida.set(p, o); o += p.length; }
  return saida;
}

const compressao = {
  id: 'gzip',
  nome: 'Compressão (gzip / zlib)',
  grupo: 'codificacao',
  async tenta(estado) {
    if (!estado.bin) return [];
    const b = bytesDe(estado);
    if (b.length < 8) return [];
    let formato = null;
    if (b[0] === 0x1f && b[1] === 0x8b) formato = 'gzip';
    else if (b[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(b[1])) formato = 'deflate';
    if (!formato) return [];
    try {
      return deBytes(await inflar(b, formato), formato === 'gzip' ? 'gzip' : 'zlib', { minBin: 1 });
    } catch {
      return [];
    }
  },
};

export const CODECS = [
  hex, base64, base32, base58, base85, binario, octal, decimal, a1z26, url, entidades, escapes,
  quotedPrintable, morse, bacon, polybius, nato, braile, leet, rot47, jwt, compressao, reverso,
];

