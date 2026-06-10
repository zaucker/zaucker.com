# Calendar service — one-time setup (rootless, systemd --user)

Runs as a **user** service for `zaucker` on `web-volki-01-adm` (no sudo), using
the user-space (nvm) Node. nginx on **proxy-volki-01** routes `/api` to it.

## 0. Prerequisites (on web-volki-01-adm, as zaucker)

Node installed via nvm, with a default alias so the service can find it:

```bash
. ~/.nvm/nvm.sh
nvm install --lts
nvm alias default 'lts/*'
```

Let the user service keep running without an active login (one-time; may need an
admin if it asks for auth):

```bash
loginctl enable-linger zaucker
```

## 1. Ship the service

From the repo on your workstation:

```bash
./deploy-server.sh
```

First run will fail at `systemctl --user restart` because the unit isn't
installed yet — that's expected. It still rsynced + built the code in
`~/calendar/`.

## 2. Put the real feed URLs on the server (NOT committed)

The secret `.ics` URLs live only on the server:

```bash
cp ~/calendar/config.example.json ~/calendar/config.local.json
# edit ~/calendar/config.local.json and paste the real Airbnb + traum URLs
```

(`deploy-server.sh` excludes `config.local.json`, so redeploys never overwrite it.)

## 3. Install + start the user unit (one-time)

```bash
mkdir -p ~/.config/systemd/user
cp ~/calendar/deploy/zaucker-calendar.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now zaucker-calendar
systemctl --user status zaucker-calendar     # should be active (running)
```

Verify locally on the host:

```bash
curl -s http://localhost:4317/api/availability/4_zi_dg | head
```

The unit binds `HOST=0.0.0.0:4317` so proxy-volki-01 can reach it across the
network. (Optionally firewall 4317 to proxy-volki-01 only.)

## 4. nginx on proxy-volki-01

Add to the `zaucker.com` server block, **above** the static-site location so it
takes precedence:

```nginx
location /api/ {
    proxy_pass http://web-volki-01:4317;   # the address proxy-volki-01 reaches web-volki-01 on
    proxy_set_header Host $host;
    proxy_read_timeout 30s;
}
```

Then `nginx -t && systemctl reload nginx` (on proxy-volki-01).

## 5. Verify end-to-end

```bash
curl -s https://zaucker.com/api/availability/4_zi_dg | head
```

## Redeploys

Just `./deploy-server.sh` (rsync + `npm ci` + build + `systemctl --user restart`).
