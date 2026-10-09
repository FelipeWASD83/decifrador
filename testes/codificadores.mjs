// Codificadores só para os testes (o site só decifra).
export const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
export const hex = (s) => Buffer.from(s, 'utf8').toString('hex');
export const caesar = (s, k) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + ((c.charCodeAt(0) - b + k) % 26 + 26) % 26); });
export function vigenere(s, key) { let i = 0; return s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; const k = key.toUpperCase().charCodeAt(i++ % key.length) - 65; return String.fromCharCode(b + (c.charCodeAt(0) - b + k) % 26); }); }
export function subst(s, alfabeto) { return s.replace(/[a-z]/gi, (c) => { const up = c <= 'Z'; const r = alfabeto[c.toUpperCase().charCodeAt(0) - 65]; return up ? r : r.toLowerCase(); }); }
export function xor(s, key) { const b = Buffer.from(s, 'utf8'); const k = Buffer.from(key); return Buffer.from(b.map((x, i) => x ^ k[i % k.length])); }
export function rail(s, r) { const n = s.length, ciclo = 2 * (r - 1); const tr = [...s].map((_, i) => { const p = i % ciclo; return p < r ? p : ciclo - p; }); const ord = [...s].map((_, i) => i).sort((a, b) => tr[a] - tr[b] || a - b); return ord.map((i) => s[i]).join(''); }
export function colunar(s, key) { const k = key.length; const cols = Array.from({ length: k }, () => ''); [...s].forEach((c, i) => { cols[i % k] += c; }); const ordem = [...key].map((c, i) => [c, i]).sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]).map((x) => x[1]); return ordem.map((i) => cols[i]).join(''); }
export const morse = (s) => { const M = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' }; return s.toUpperCase().split(' ').map((w) => [...w].map((c) => M[c]).join(' ')).join(' / '); };
export const bin = (s) => [...Buffer.from(s)].map((b) => b.toString(2).padStart(8, '0')).join(' ');
export const dec = (s) => [...Buffer.from(s)].join(' ');
export const rot47 = (s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + (c.charCodeAt(0) - 33 + 47) % 94));
