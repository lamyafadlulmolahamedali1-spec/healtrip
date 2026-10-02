# Security

## What is in place

| Control | Implementation |
|---|---|
| Authentication | JWT, signed with `JWT_SECRET`, 7-day default expiry |
| Password storage | bcrypt, cost 12 |
| Input validation | zod schemas on every write endpoint and every tool argument |
| Transport headers | helmet, with `crossOriginResourcePolicy` set for the media |
| CORS | `CORS_ORIGIN`, which must be set to a domain in production |
| Rate limiting | per-IP, `RATE_LIMIT_PER_MIN`, default 180 |
| Audit | append-only `audit_events`, written for every clinical event, tool call and export |
| Data deletion | `DELETE /api/v1/assessments/{id}` removes the content |
| Model isolation | the language model has no database access, no credentials and no SQL |
| Upload handling | size limits and controlled extraction; nothing is treated as verified until confirmed |

## Prompt injection

The model can only emit a tool name and arguments. A tool it does not know is
rejected, an argument of the wrong type is rejected, and every tool is read-only
against the data it touches. Text inside a document or a message therefore cannot
reach a query. The worst case is a wasted tool call, which is recorded in the
audit table.

## What is outstanding

Retention scheduling, encryption at rest on the database volume, an independent
penetration test, alerting, log retention, and secret management beyond the
environment file. `npm run readiness` reports these as the privacy and security
gate, currently 5 of 10 automated checks passing.

## Before going public

Set `CORS_ORIGIN` to your domain, change `POSTGRES_PASSWORD` and `JWT_SECRET`,
remove the published port on the API service so it is reachable only through the
web container, and confirm `/api/v1/health` reports `"storage":"postgres"`.
