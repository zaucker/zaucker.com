# Calendar service — one-time server setup

1. First deploy populates `~/calendar/` on web-volki-01-adm:
   `./deploy-server.sh`   (will fail at `systemctl restart` until step 3 — that's fine)

2. On the server, create the secret config (NOT committed):
   `cp ~/calendar/config.example.json ~/calendar/config.local.json`
   then edit it and paste the real Airbnb + traum `.ics` URLs per apartment.

3. Install + enable the systemd unit (once):
   `sudo cp ~/calendar/deploy/zaucker-calendar.service /etc/systemd/system/`
   `sudo systemctl daemon-reload`
   `sudo systemctl enable --now zaucker-calendar`

4. Verify: `curl -s localhost:4317/api/availability/4_zi_dg | head`

5. Add a proxy rule so `https://zaucker.com/api/` → `http://localhost:4317`
   (path passed through unchanged — the service serves `/api/...`).

Redeploys after that: just `./deploy-server.sh`.
