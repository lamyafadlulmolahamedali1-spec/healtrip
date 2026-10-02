# Deployment

## Local, the short way

```bash
./start.sh          # API plus interface on http://localhost:4000
```

The API serves `frontend/` as static files, so there is one process and one
origin. Running a separate static server is supported but not needed, and is the
usual cause of a page that renders with no data behind it.

## Local, with Docker

```bash
cp .env.example .env
docker compose up --build
# site  http://localhost:3000
# api   http://localhost:4000/health
```

## A single server

Any host running Docker works. On a fresh Ubuntu box:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
git clone <your repo> healtrip && cd healtrip
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, set CORS_ORIGIN to your domain
sudo docker compose up --build -d
```

Put a TLS terminator in front of port 3000. With Caddy that is two lines:

```
healtrip.example.com {
  reverse_proxy localhost:3000
}
```

Voice input requires HTTPS on any host other than localhost. Browsers block microphone access on plain HTTP.

## Before going public

- Set `CORS_ORIGIN` to your domain. The default `*` is for local work only.
- Change `POSTGRES_PASSWORD` and do not commit `.env`.
- Do not expose port 4000 publicly. Remove the `ports` block from the `api` service so it is reachable only through the web container.
- Add authentication before any account or history feature stores content across sessions.
- Back up the `dbdata` volume, or move to a managed PostgreSQL instance and point `DATABASE_URL` at it.
- Set a retention policy for the `assessments` table. Nothing in this build expires on its own.

## Database

The schema and seed in `backend/sql` run automatically the first time the `db` volume is created. To re-seed, remove the volume:

```bash
docker compose down -v && docker compose up --build
```

If `DATABASE_URL` is unset or unreachable, the API logs the reason and runs with in-memory storage. Sessions are then lost on restart, which is fine for a demo and wrong for production, so check `/health` and confirm `"storage":"postgres"` after deploying.

## Static hosting

The frontend is static files with no build step. It can be served from any CDN or object store, as long as `/api` reaches the API. If the frontend and API sit on different hosts, set `window.HEALTRIP_API` before `core.js` loads:

```html
<script>window.HEALTRIP_API = 'https://api.healtrip.example.com';</script>
```
