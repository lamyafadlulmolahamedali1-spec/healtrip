# Production Runbook

## Local

```bash
cp .env.example .env
docker compose up --build
```

Web: `http://localhost:3000`
API: `http://localhost:4000/health`

## Required production environment

- strong random `JWT_SECRET`
- managed PostgreSQL/pgvector
- private object storage for uploads
- HTTPS reverse proxy
- restricted CORS origin
- secret manager for model keys
- backups + restore test
- monitoring and alerting
- centralized audit retention
- production rate limiting

## AI providers

`AI_MODE=demo` is deterministic and requires no key.

`AI_MODE=openai` uses the configured OpenAI model.

`AI_MODE=gemini` uses the configured Gemini model.

The clinical engine remains deterministic; the cloud model is a language layer and must not be allowed to determine emergency routing or invent provider/evidence facts.

## Data safety

Medical documents are sensitive data. Configure private storage, encryption, access control, retention and deletion procedures before accepting real patient documents.
