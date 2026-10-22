# The WordPress sites on raibach-cloud-3 (`/opt/raibach/wp`)

This folder is the repo's copy of what runs on the server. The box carries the
same `docker-compose.yml`; the repo is the source of truth, the box mirrors it.

## What runs

| Site | Local port (dev) | Box port | Database | DB user |
|---|---|---|---|---|
| raibach.net | 8082 | **8082** | `dbvzmg3i2l10d6` | `railocal` |
| holtportfolio.com | 8081 | **8081** | `dbauikx8dsba33` | `holtlocal` |

Databases are internal-only (no host ports). Site files are bind-mounted as the
web root. `restart: "no"` everywhere — house rule: a broken boot leaves the port
black, loudly, never a silent fallback.

## Daily operations (from anywhere with the workspace SSH key)

```sh
# zsh: a plain "SSH=..." variable will NOT word-split — use a function:
ssh_box() { ssh -i Keys/hetzner_cloud3 -o UserKnownHostsFile=Keys/known_hosts_hetzner -o StrictHostKeyChecking=accept-new "$@"; }

# status
ssh_box root@188.245.25.26 'cd /opt/raibach/wp && docker compose ps'

# bring raibach.net up / down
ssh_box root@188.245.25.26 'cd /opt/raibach/wp && docker compose up -d rai-db rai-wp'
ssh_box root@188.245.25.26 'cd /opt/raibach/wp && docker compose stop rai-wp'

# logs (raw, honest)
ssh_box root@188.245.25.26 'cd /opt/raibach/wp && docker compose logs --tail 50 rai-wp'

# wp-cli against the live copy
ssh_box root@188.245.25.26 'cd /opt/raibach/wp && docker compose --profile cli run --rm rai-cli wp option get siteurl'
```

## Caddy (TLS / reverse proxy)

- Source of truth: `product/raibach-cloud-3/wp/Caddyfile` → box:
  `/opt/raibach/wp/caddy/Caddyfile`, mounted as the DIRECTORY `/etc/caddy`.
- **Why a directory mount:** a single-file bind mount freezes at the inode it
  had when the container started; rsync replaces files (new inode), so the
  container keeps reading the old bytes and a reload silently reads stale
  config. Bitten 2026-10-11 (holt certs never requested). Never mount the
  single file again.
- Live blocks: `raibach.net` (+ `www` redirect) · `john.holtportfolio.com`
  (the site) · `holtportfolio.com` and `www.holtportfolio.com`,
  `www.john.holtportfolio.com` → 301 to john. Certs issue automatically.
- Edit cycle — copy up, then reload (reload validates; on failure the running
  config stays):

```sh
rsync -a -e "ssh -i Keys/hetzner_cloud3 -o UserKnownHostsFile=Keys/known_hosts_hetzner -o StrictHostKeyChecking=accept-new" \
  product/raibach-cloud-3/wp/Caddyfile root@188.245.25.26:/opt/raibach/wp/caddy/Caddyfile
ssh_box root@188.245.25.26 'cd /opt/raibach/wp && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile'
```

## URL switches (the two-phase move)

Phase 1 — serve by IP (before DNS points here):

```sh
docker compose --profile cli run --rm rai-cli \
  wp search-replace 'http://localhost:8082' 'http://188.245.25.26:8082' \
  && docker compose --profile cli run --rm rai-cli \
  wp option update siteurl 'http://188.245.25.26:8082' \
  && docker compose --profile cli run --rm rai-cli \
  wp option update home 'http://188.245.25.26:8082'
```

Phase 2 — after the DNS flip (the real address):

```sh
docker compose --profile cli run --rm rai-cli \
  wp search-replace 'http://188.245.25.26:8082' 'https://raibach.net'
# siteurl/home follow the same replace; TLS is Caddy's job (later block)
```

## Moving a fresh database copy to the box

```sh
# from the workspace (dump the LOCAL copy — note the table prefix vmj_ belongs
# to the DB, no flags needed):
docker compose -f wordpress/_stack/docker-compose.yml exec -T rai-db \
  sh -c 'mysqldump --no-tablespaces --user=railocal --password=railocal dbvzmg3i2l10d6' \
  > wordpress/_stack/dumps/raibach-$(date +%F).sql

# pipe into the box's mysql:
ssh_box root@188.245.25.26 'cd /opt/raibach/wp && docker compose exec -T rai-db \
  mysql --user=railocal --password=railocal dbvzmg3i2l10d6' \
  < wordpress/_stack/dumps/raibach-$(date +%F).sql
```
