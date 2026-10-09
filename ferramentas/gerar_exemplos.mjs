// Gera js/exemplos.js: textos já cifrados para os botões de exemplo da tela.
// Os codificadores são os mesmos dos testes (testes/codificadores.mjs).
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as E from '../testes/codificadores.mjs';

const alfabeto = 'MQWERTYUIOPASDFGHJKLZXCVBN';
const itens = [
  { id: 'base64', rotulo: 'Base64', texto: E.b64('Deixei a chave embaixo do vaso azul da varanda. Entre pela porta dos fundos e não acenda a luz.') },
  { id: 'cesar', rotulo: 'César', texto: E.caesar('The treasure is buried under the oldest oak tree, twenty steps north of the river. Come alone and bring a shovel.', 11) },
  { id: 'vigenere', rotulo: 'Vigenère', texto: E.vigenere('Ninguém desconfia do velho relojoeiro, mas é ele quem guarda o mapa dentro do relógio da praça. Procure atrás do ponteiro das horas quando o sino tocar doze vezes.', 'SOL') },
  { id: 'substituicao', rotulo: 'Alfabeto embaralhado', texto: E.subst('Every cipher has a weakness, because language leaves fingerprints everywhere. Count the letters, look for the common words, and slowly the hidden message begins to appear out of the noise.', alfabeto) },
  { id: 'morse', rotulo: 'Morse', texto: E.morse('socorro estamos na ilha') },
  { id: 'cadeia', rotulo: 'Três camadas', texto: E.b64(E.hex(E.caesar('Meet me where the road ends and the lake begins, and tell nobody.', 13))) },
  { id: 'xor', rotulo: 'XOR', texto: E.xor('The meeting has been moved to the library. Come before sunrise and use the side entrance.', 'lua').toString('hex') },
  { id: 'hash', rotulo: 'Hash (não tem volta)', texto: createHash('md5').update('senha').digest('hex') },
];
const corpo = `// GERADO por ferramentas/gerar_exemplos.mjs. Não editar à mão.\nexport const EXEMPLOS = ${JSON.stringify(itens, null, 2)};\n`;
writeFileSync(new URL('../js/exemplos.js', import.meta.url), corpo);
console.log('exemplos:', itens.length);
