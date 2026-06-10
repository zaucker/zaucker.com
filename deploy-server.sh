#!/bin/bash
set -euo pipefail
# Ship the calendar service to the server and restart it.
# Excludes node_modules/dist/.cache (rebuilt remotely) and config.local.json
# (the secret feed URLs live only on the server).
rsync -avr --delete \
  --exclude node_modules --exclude dist --exclude .cache --exclude config.local.json \
  server/ zaucker@web-volki-01-adm:calendar/
# Build and restart the rootless (systemd --user) service. Source nvm to get the
# user-space node/npm; set XDG_RUNTIME_DIR so `systemctl --user` works over ssh.
ssh zaucker@web-volki-01-adm '
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
  export XDG_RUNTIME_DIR="/run/user/$(id -u)"
  cd ~/calendar && npm ci && npm run build && systemctl --user restart zaucker-calendar
'
