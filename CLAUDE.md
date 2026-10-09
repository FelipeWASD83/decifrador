# CLAUDE.md: decifrador

Site que recebe um texto cifrado e testa dezenas de codificações e cifras, em
camadas (até 4), até sair algo que faça sentido em português ou inglês. Tudo
roda no navegador. Criado em 09/10/2026, com tudo delegado.

## O que ele faz (e o que não)

- **Sem chave, com volta exata** (`js/codecs.js`): Base64, Base32, Base58,
  Base85, hexa, binário, octal, decimal, A1Z26, percent-encoding, entidades
  HTML, escapes `\u`/`\x`/`U+`, quoted-printable, Morse, Bacon, Políbio, NATO,
  braile, leetspeak, ROT47, JWT, gzip/zlib, texto ao contrário.
- **Quebradas por estatística** (`js/classicas.js`): César (inclui ROT13),
  Atbash, afim, Vigenère, Beaufort, cerca de trilhos, transposição por colunas
  (até 8 colunas, escítala até 40), substituição simples (escalada de colina com
  quadrigramas), XOR de 1 byte e de chave repetida (Hamming + refino).
- **Campo opcional de chave**: Vigenère, Beaufort, autochave e XOR com a chave
  que o usuário já sabe.
- **Não quebra, e avisa** (`detectarAvisos` em `js/motor.js`): hash (MD5, SHA,
  bcrypt, Argon2...), OpenSSL `Salted__`, PGP/RSA/SSH, e dado com entropia de
  cifra moderna. "Qualquer código" não existe: o site diz isso na tela, de
  propósito. **Não prometer o contrário** em texto nenhum.

## Como funciona

`motor.js` faz busca em largura com feixe (largura 10, até 4 camadas, 25 s no
máximo): aplica todos os métodos a cada estado, dá nota ao que saiu
(`lingua.pontuar`) e segue com os melhores. Decodificação que "fecha certinho"
(`estrito`) ganha folga na ordenação e **sempre segue no feixe**, senão cadeia
como Base64, hexa, XOR é podada no meio. Parou: nota ≥ 0,55 no fim de uma
camada, ou ≥ 0,9 no meio. Empate técnico (0,04) fica com o caminho mais curto.
Cifra pesada (colunar, substituição) só roda se o caminho ainda não passou por
outra cifra.

A nota (`js/lingua.js`, 0 a 1) soma 35 % de quadrigramas e 65 % de cobertura
por palavras comuns, com tetos contra "lixo otimizado" (escalada de colina
inventa cara de língua em qualquer coisa). **Cortes**: 0,5 diz "Decifrado",
0,25 a 0,5 vira "Talvez", 0,75 ou mais na entrada vira "já é legível". Estão em
`LIMITES` no `motor.js`.

## Regras que não se desfazem sem motivo

- **Sem dependência e sem rede.** CSP com `connect-src 'none'`; nada vai para
  `localStorage`. A CSP também **bloqueia `style=""` inline**: no JS use
  `el.style.setProperty` ou classe, nunca atributo de estilo.
- **`js/dados/modelos.js` é gerado**: `python ferramentas/gerar_modelos.py`
  (lê `ferramentas/sementes.py` e corpora locais: prosa em português dos projetos
  `date-sim`, `felipe-sites` etc. e a documentação do Python em inglês). Só
  estatística vai para o arquivo, nunca o texto de origem. Mudou corpus ou
  semente, regenerar e rodar os testes.
- **Os textos de teste não são os do treino.** Frase de `sementes.py` não pode
  entrar em `testes/`, senão o teste só prova que o modelo decorou.
- **Cifras clássicas só enxergam A-Z** (sem tirar acento), igual a quem cifrou;
  a nota é que tira o acento. Trocar isso desalinha a chave do Vigenère em
  texto acentuado.
- O motor roda num **Web Worker de módulo** (`js/worker.js`); `motor.js`,
  `codecs.js`, `classicas.js`, `lingua.js` e `texto.js` não tocam em DOM e são
  testáveis no Node.
- `js/exemplos.js` é gerado por `ferramentas/gerar_exemplos.mjs` (usa os
  codificadores de `testes/codificadores.mjs`).
- Método novo: criar o objeto `{ id, nome, grupo, tenta(estado, ctx) }` em
  `codecs.js` ou `classicas.js`, pôr na lista exportada e escrever o teste. O
  catálogo da tela vem do próprio motor, então a contagem nunca desatualiza.

## Direção visual (fechada em 09/10/2026)

Produto. Referências: Linear (frase de duas cores, mono só em metadado), Igloo
(HUD nos quatro cantos), Produx (colchetes, grotesca leve). Blocos alternando
claro (papel frio), escuro (mesa), claro, escuro, claro (o rodapé conta). Uma
cor de ação só: verde de carimbo. **Elemento único: a fita de tentativas**,
fita de teletipo com furos e uma barra de sentido por linha; o caminho que
venceu ganha o carimbo. Fontes Hanken Grotesk e IBM Plex Mono (Google Fonts).
Fonte do html escala com a tela (17 px a 24 px) para o ultrawide não ficar com
buraco. Descartadas: terminal verde de hacker e papel e tinta (já usado no
`compasso`).

## Como rodar e testar

- `abrir.bat` → http://127.0.0.1:4344/ (não abre por `file://`: módulos e worker).
- `node --test "testes/*.test.js"` (21 testes, uns 3 s).
- `?exemplo=cadeia` (ou `base64`, `cesar`, `vigenere`, `substituicao`, `morse`,
  `xor`, `hash`) abre já com o exemplo rodando.
- **Screenshot em Edge headless com `--virtual-time-budget` distorce
  `Date.now()`** e faz o motor achar que estourou os 25 s ("Parei por tempo").
  Para conferir resultado use o navegador do app ou o Node; o headless serve só
  para o layout.

## Não verificado

Brave e Firefox (testado: Edge headless e o navegador do app), toque no
celular de verdade, e o uso real com texto que o Felipe tenha por aí. Texto
curto (menos de uns 25 letras) em cifra clássica pode ter mais de uma leitura;
a tela mostra as outras hipóteses.
