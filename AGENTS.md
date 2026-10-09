# AGENTS.md: decifrador

As regras deste projeto estão em **`CLAUDE.md`**, nesta mesma pasta. Ler antes
de mexer em qualquer coisa.

Resumo do que não pode ser esquecido:

- Sem dependência e sem rede: CSP com `connect-src 'none'` e **sem `style=""`
  inline** (no JS, `el.style.setProperty` ou classe). Nada vai para `localStorage`.
- `js/dados/modelos.js` e `js/exemplos.js` são **gerados** (`ferramentas/gerar_modelos.py`,
  `ferramentas/gerar_exemplos.mjs`): não editar à mão.
- Frase de `ferramentas/sementes.py` não pode aparecer em `testes/`.
- O site não promete decifrar "qualquer código": hash e criptografia moderna só
  recebem aviso.
- Teste: `node --test "testes/*.test.js"`. Rodar: `abrir.bat` → :4344.
