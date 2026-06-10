#!/bin/bash
set -euo pipefail
# Ship the calendar service to the server and restart it.
# Excludes node_modules/dist/.cache (rebuilt remotely) and config.local.json
# (the secret feed URLs live only on the server).
rsync -avr --delete \
  --exclude node_modules --exclude dist --exclude .cache --exclude config.local.json \
  server/ zaucker@web-volki-01-adm:calendar/
ssh zaucker@web-volki-01-adm 'cd calendar && npm ci && npm run build && sudo systemctl restart zaucker-calendar'
