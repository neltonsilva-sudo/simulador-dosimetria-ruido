#!/bin/bash
# Publica o simulador no GitHub Pages com versão carimbada em todos os módulos (fura o cache do navegador).
# uso: ./publicar.sh "mensagem do commit"
set -e
cd "$(dirname "$0")"
node stamp.mjs
git add -A
git commit -q -m "${1:-Atualização do simulador}" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" || true
git push -q
echo "publicado: https://neltonsilva-sudo.github.io/simulador-dosimetria-ruido/"
