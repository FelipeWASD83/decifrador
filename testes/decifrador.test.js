// node --test "testes/*.test.js"
// Os textos de teste NÃO são os do treino dos modelos (ferramentas/sementes.py):
// se fossem, o teste só provaria que o modelo decorou a frase.

import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';

import { decifrar, detectarAvisos, METODOS, LIMITES } from '../js/motor.js';
import { pontuar, segmentar } from '../js/lingua.js';
import { letras } from '../js/texto.js';
import { EXEMPLOS } from '../js/exemplos.js';
import * as E from './codificadores.mjs';

const EN = 'The museum opens at nine on weekdays, but the north entrance stays closed until the workers finish painting the long corridor, so visitors should use the garden gate and ask the guard for directions.';
const PT = 'O museu abre às nove nos dias de semana, mas a entrada do norte fica fechada até os operários terminarem de pintar o corredor comprido, então os visitantes devem usar o portão do jardim e pedir informação ao guarda.';
const CURTO = 'Bring the red book to the station on Friday evening';
const ALFABETO = 'ZEBRASCDFGHIJKLMNOPQTUVWXY';

function mesmasLetras(a, b) {
  return letras(a) === letras(b);
}

async function resolve(entrada, opcoes) {
  const r = await decifrar(entrada, opcoes);
  assert.ok(r.melhor, `nada decifrado para: ${entrada.slice(0, 60)}`);
  assert.ok(r.melhor.nota >= LIMITES.decifrado, `nota baixa (${r.melhor.nota.toFixed(2)}) para: ${entrada.slice(0, 60)}`);
  return r;
}

test('a nota separa língua de lixo', () => {
  for (const t of ['Meet me at the old bridge tomorrow at midnight', 'Encontro amanhã na praia, não conte a ninguém', 'ATTACKATDAWN']) {
    assert.ok(pontuar(t).nota > 0.6, t);
  }
  for (const t of ['Uryyb jbeyq', 'XJKQZ VBNMW PLRTY HGFDS QWXZV', 'TWVldCBtZSBhdCBtaWRuaWdodA==', 'zzzzqqqq xxxx jjjjj']) {
    assert.ok(pontuar(t).nota < 0.2, t);
  }
  assert.equal(pontuar('Hello world').lingua, 'en');
  assert.equal(pontuar('Vamos nos encontrar às oito').lingua, 'pt');
});

test('segmentar separa palavras de texto sem espaço', () => {
  assert.equal(segmentar('ENCONTROAMANHANAPRAIA', 'pt').join(' '), 'ENCONTRO AMANHA NA PRAIA');
  assert.equal(segmentar('ATTACKATDAWN', 'en').join(' '), 'ATTACK AT DAWN');
});

test('Base64, hexa, binário, decimal e octal', async () => {
  assert.equal((await resolve(E.b64(PT))).melhor.estado.texto, PT);
  assert.equal((await resolve(E.hex(EN))).melhor.estado.texto, EN);
  assert.equal((await resolve(E.bin('Good morning my friend'))).melhor.estado.texto, 'Good morning my friend');
  assert.equal((await resolve(E.dec('Good morning my friend'))).melhor.estado.texto, 'Good morning my friend');
  const oct = [...Buffer.from('Good morning my friend')].map((b) => b.toString(8)).join(' ');
  assert.equal((await resolve(oct)).melhor.estado.texto, 'Good morning my friend');
});

test('URL, entidades HTML e escapes', async () => {
  const url = encodeURIComponent('Nos vemos na estação às oito da noite').replace(/%20/g, '%20');
  assert.equal((await resolve(url)).melhor.estado.texto, 'Nos vemos na estação às oito da noite');
  const ent = [...'Meet me at the harbour tonight'].map((c) => `&#${c.charCodeAt(0)};`).join('');
  assert.equal((await resolve(ent)).melhor.estado.texto, 'Meet me at the harbour tonight');
  const esc = [...'Meet me at the harbour tonight'].map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  assert.equal((await resolve(esc)).melhor.estado.texto, 'Meet me at the harbour tonight');
});

test('Morse, A1Z26, Bacon, Políbio, NATO e braile', async () => {
  assert.ok(mesmasLetras((await resolve(E.morse('send help to the harbour'))).melhor.estado.texto, 'sendhelptotheharbour'));
  const a1 = [...'meetmeatthebridge'].map((c) => c.charCodeAt(0) - 96).join(' ');
  assert.ok(mesmasLetras((await resolve(a1)).melhor.estado.texto, 'meetmeatthebridge'));
  const bacon = [...'attackatdawnnow'].map((c) => (c.charCodeAt(0) - 97).toString(2).padStart(5, '0').replace(/0/g, 'a').replace(/1/g, 'b')).join(' ');
  assert.ok(mesmasLetras((await resolve(bacon)).melhor.estado.texto, 'attackatdawnnow'));
  const quadrado = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
  const poli = [...'meetmeatthebridge'].map((c) => { const i = quadrado.indexOf(c.toUpperCase()); return `${Math.floor(i / 5) + 1}${(i % 5) + 1}`; }).join(' ');
  assert.ok(mesmasLetras((await resolve(poli)).melhor.estado.texto, 'meetmeatthebridge'));
  const nato = 'Mike Echo Echo Tango Mike Echo Alfa Tango Tango Hotel Echo Bravo Romeo India Delta Golf Echo';
  assert.ok(mesmasLetras((await resolve(nato)).melhor.estado.texto, 'meetmeatthebridge'));
  const braile = [...'meet me at the bridge'].map((c) => (c === ' ' ? '⠀' : String.fromCharCode(0x2800 + ({ a: 1, b: 3, c: 9, d: 25, e: 17, f: 11, g: 27, h: 19, i: 10, j: 26, k: 5, l: 7, m: 13, n: 29, o: 21, p: 15, q: 31, r: 23, s: 14, t: 30, u: 37, v: 39, w: 58, x: 45, y: 61, z: 53 })[c]))).join('');
  assert.ok(mesmasLetras((await resolve(braile)).melhor.estado.texto, 'meetmeatthebridge'));
});

test('ROT13, César e ROT47, em inglês e português', async () => {
  assert.equal((await resolve(E.caesar(EN, 13))).melhor.estado.texto, EN);
  assert.equal((await resolve(E.caesar(PT, 9))).melhor.estado.texto, PT);
  assert.equal((await resolve(E.caesar(CURTO, 3))).melhor.estado.texto, CURTO);
  assert.equal((await resolve(E.rot47(CURTO))).melhor.estado.texto, CURTO);
});

test('Atbash e afim', async () => {
  const atbash = (s) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); });
  assert.equal((await resolve(atbash(EN))).melhor.estado.texto, EN);
  const afim = (s) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + ((5 * (c.charCodeAt(0) - b) + 8) % 26)); });
  assert.equal((await resolve(afim(EN))).melhor.estado.texto, EN);
});

test('Vigenère acha o tamanho da chave e a chave', async () => {
  const r = await resolve(E.vigenere(EN, 'ORANGE'));
  assert.equal(r.melhor.estado.texto, EN);
  assert.match(r.melhor.caminho[0].detalhe, /ORANGE/);
  assert.equal((await resolve(E.vigenere(PT, 'BANCO'))).melhor.estado.texto, PT);
});

test('substituição simples (alfabeto embaralhado)', async () => {
  const cifrado = E.subst(EN, ALFABETO);
  const r = await resolve(cifrado);
  const acertos = [...letras(r.melhor.estado.texto)].filter((c, i) => c === letras(EN)[i]).length;
  assert.ok(acertos / letras(EN).length > 0.93, `acertou só ${acertos} de ${letras(EN).length} letras`);
});

test('cerca de trilhos e transposição por colunas', async () => {
  assert.equal((await resolve(E.rail(CURTO, 3))).melhor.estado.texto, CURTO);
  const col = E.colunar(letras(EN), 'ZEBRAS');
  assert.equal(letras((await resolve(col)).melhor.estado.texto), letras(EN));
});

test('XOR com 1 byte e com chave repetida', async () => {
  assert.equal((await resolve(E.xor(CURTO, [0x2a]).toString('base64'))).melhor.estado.texto, CURTO);
  const r = await resolve(E.xor(EN, 'secret').toString('hex'));
  assert.equal(r.melhor.estado.texto, EN);
});

test('gzip e zlib dentro de Base64', async () => {
  assert.equal((await resolve(gzipSync(Buffer.from(EN)).toString('base64'))).melhor.estado.texto, EN);
  assert.equal((await resolve(deflateSync(Buffer.from(PT)).toString('base64'))).melhor.estado.texto, PT);
});

test('camadas: Base64 de hexa de ROT13, e outras combinações', async () => {
  const tres = await resolve(E.b64(E.hex(E.caesar(CURTO, 13))));
  assert.equal(tres.melhor.estado.texto, CURTO);
  assert.equal(tres.melhor.caminho.length, 3);
  assert.equal((await resolve(E.hex(E.b64(E.caesar(PT, 4))))).melhor.estado.texto, PT);
  assert.equal((await resolve(E.b64(E.xor(EN, 'k3y').toString('hex')))).melhor.estado.texto, EN);
});

test('chave conhecida pelo campo opcional', async () => {
  const cifrado = E.vigenere(CURTO, 'LIMAO');
  const r = await resolve(cifrado, { chave: 'limao' });
  assert.equal(r.melhor.estado.texto, CURTO);
});

test('todo exemplo da tela é decifrado (menos o hash, que é aviso)', async () => {
  for (const ex of EXEMPLOS) {
    const r = await decifrar(ex.texto);
    if (ex.id === 'hash') {
      assert.equal(r.melhor, null);
      assert.equal(r.avisos[0].tipo, 'hash');
    } else {
      assert.ok(r.melhor && r.melhor.nota >= LIMITES.decifrado, `${ex.id}: ${r.melhor?.nota}`);
    }
  }
});

test('hash, OpenSSL e PGP viram aviso, não palpite', async () => {
  for (const h of ['md5', 'sha1', 'sha256', 'sha512']) {
    const r = await decifrar(createHash(h).update('qualquer coisa').digest('hex'));
    assert.equal(r.avisos[0].tipo, 'hash', h);
    assert.equal(r.melhor, null, h);
  }
  assert.equal(detectarAvisos('U2FsdGVkX1+abcdefghijklmnop==')[0].tipo, 'moderna');
  assert.equal(detectarAvisos('-----BEGIN PGP MESSAGE-----\nabc')[0].tipo, 'moderna');
});

test('dado aleatório não vira "decifrado" e avisa que é cifra moderna', async () => {
  const r = await decifrar(randomBytes(96).toString('base64'));
  assert.ok(!r.melhor || r.melhor.nota < LIMITES.decifrado);
  assert.ok(r.avisos.some((a) => a.tipo === 'moderna'));
});

test('letras aleatórias não viram "decifrado"', async () => {
  const sorteio = 'XJKQZVBNMWPLRTYHGFDSQWXZVKJHQZXWVBNMLKJHGFDSAQWERTYUIOPLKJHGZXCVBNMQWRTPSDFGHJKLZXCVBNM';
  const r = await decifrar(sorteio);
  assert.ok(!r.melhor || r.melhor.nota < LIMITES.decifrado, r.melhor && `${r.melhor.nota} ${r.melhor.caminho.map((p) => p.nome)}`);
});

test('texto que já é legível não é "decifrado" de novo', async () => {
  const r = await decifrar(EN);
  assert.equal(r.jaLegivel, true);
  assert.equal(r.melhor, null);
});

test('cancelar interrompe a busca', async () => {
  let n = 0;
  const r = await decifrar(E.vigenere(EN, 'ORANGE'), { cancelado: () => ++n > 3 });
  assert.equal(r.parou, 'cancelado');
});

test('a lista de métodos tem ids únicos e nomes', () => {
  const ids = METODOS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of METODOS) {
    assert.ok(m.nome && ['codificacao', 'cifra'].includes(m.grupo), m.id);
    assert.equal(typeof m.tenta, 'function');
  }
});
