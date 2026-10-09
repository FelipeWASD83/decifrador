# Decifrador

Cole um texto cifrado e o site testa dezenas de codificações e cifras, uma
dentro da outra, até sair algo que faça sentido em português ou inglês.

## Como usar

1. Dois cliques em `abrir.bat` (abre http://127.0.0.1:4344/; deixe a janela preta aberta).
2. Cole o texto e aperte **[ DECIFRAR ]** (ou Ctrl+Enter). Os botões de exemplo mostram o que ele sabe fazer.
3. À direita da fita aparece a resposta, o caminho que ele seguiu (ex.: Base64 → hexa → ROT13) e a confiança.
4. Se achar o resultado estranho, abra **outras hipóteses**: com texto curto uma cifra pode ter mais de uma leitura.
5. Sabe a chave? Abra **Sei uma chave ou palavra-chave** antes de decifrar.

## O que ele não faz

AES, RSA, PGP e hash (MD5, SHA, bcrypt) não têm como ser quebrados por tentativa.
O site reconhece esses formatos e avisa, em vez de inventar uma resposta.

Nada do que você cola sai do navegador nem fica guardado.

## Para quem for mexer

Ver `CLAUDE.md`. Testes: `node --test "testes/*.test.js"`.
