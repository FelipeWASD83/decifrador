@echo off
rem Abre o Decifrador: sobe um servidorzinho na porta 4344 e abre o navegador.
rem Fecha esta janela preta quando terminar.
rem (Aberto direto do arquivo, o navegador nao deixa carregar os scripts.)
cd /d "%~dp0"
start "" "http://127.0.0.1:4344/"
python -m http.server 4344 --bind 127.0.0.1
