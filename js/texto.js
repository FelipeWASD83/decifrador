// Utilitários de texto e bytes, sem DOM.
//
// Um "estado" é o que o decifrador carrega de um passo para o outro:
//   { texto: string, bin: boolean }
// `bin` = true quando o conteúdo são bytes que não formam texto legível
// (cada caractere do `texto` vale um byte, 0 a 255, como em latin1).

const codificador = new TextEncoder();

export function semAcento(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Só as letras A-Z, em maiúscula, sem acento. */
export function letras(s) {
  return semAcento(s).toUpperCase().replace(/[^A-Z]/g, '');
}

/** Fração de caracteres imprimíveis (controle, U+FFFD e lixo contam contra). */
export function fracaoImprimivel(s) {
  if (!s.length) return 0;
  let ruim = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32 || (c >= 127 && c < 160) || c === 0xfffd) ruim++;
  }
  return 1 - ruim / s.length;
}

/** Fração só de ASCII imprimível (32-126 mais tab e quebras de linha). */
export function fracaoAscii(s) {
  if (!s.length) return 0;
  let ok = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) ok++;
  }
  return ok / s.length;
}

export function bytesDeLatin1(s) {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
  return b;
}

export function latin1DeBytes(b) {
  let s = '';
  const passo = 8192;
  for (let i = 0; i < b.length; i += passo) {
    s += String.fromCharCode.apply(null, b.subarray(i, i + passo));
  }
  return s;
}

/** Os bytes do estado: latin1 se for binário, UTF-8 se for texto. */
export function bytesDe(estado) {
  return estado.bin ? bytesDeLatin1(estado.texto) : codificador.encode(estado.texto);
}

/**
 * Transforma bytes num estado. Tenta UTF-8 estrito; se não der e o conteúdo
 * for quase todo ASCII legível, trata como texto latin1; senão é binário.
 */
export function estadoDeBytes(bytes) {
  try {
    const t = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (fracaoImprimivel(t) >= 0.92) return { texto: t, bin: false };
  } catch { /* não é UTF-8 */ }
  const l = latin1DeBytes(bytes);
  if (fracaoAscii(l) >= 0.92) return { texto: l, bin: false };
  return { texto: l, bin: true };
}

/** Entropia de Shannon em bits por byte (0 a 8). */
export function entropia(bytes) {
  if (!bytes.length) return 0;
  const cont = new Uint32Array(256);
  for (const b of bytes) cont[b]++;
  let h = 0;
  for (let i = 0; i < 256; i++) {
    if (!cont[i]) continue;
    const p = cont[i] / bytes.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Gerador pseudoaleatório com semente (para o resultado ser repetível). */
export function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Aplica `f(indiceDaLetra, codigo0a25)` só nas letras A-Z/a-z, mantendo caixa e o resto. */
export function mapearLetras(texto, f) {
  let n = 0;
  let saida = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c >= 65 && c <= 90) saida += String.fromCharCode(65 + ((f(n++, c - 65) % 26) + 26) % 26);
    else if (c >= 97 && c <= 122) saida += String.fromCharCode(97 + ((f(n++, c - 97) % 26) + 26) % 26);
    else saida += texto[i];
  }
  return saida;
}
