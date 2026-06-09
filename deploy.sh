#! /bin/bash
set -euo pipefail
npm run build
rsync -avr --delete dist/ zaucker@web-volki-01-adm:public_html/zaucker.com/
