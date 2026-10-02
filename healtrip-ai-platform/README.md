# HealTrip

An AI patient decision assistant. A person describes symptoms in Arabic or
English, by voice or by typing. HealTrip screens for red flags before anything
else, asks only the questions that change the answer, explains what the symptoms
are compatible with, tells them what a clinician may evaluate next and why, helps
them prepare for the appointment, and points them at the right kind of clinician
from a provider database.

It does not diagnose, does not prescribe, and is not cleared for clinical use.

---

## 0. Two experiences, on purpose

The public site is for patients and contains no engineering vocabulary: no API,
no database, no agent, no scores. Everything a reviewer wants to inspect lives
at `/technical.html`, reachable from a single discreet link in the footer.

```
patient site            technical console
  Home                    architecture and request path
  About                   agent tools and a live probe with its trace
  How it works            measured evaluation suites
  Assessment              clinical readiness gates
  AI Assistant            safety rules and the source register
  My Profile              endpoints and schemas
  Doctors
  Hospitals
```

`npm run test:ui` fails the build if an engineering term appears on the landing
page or an API tab returns to the navigation.

## 1. Why it exists

Most symptom checkers answer one question: what might this be. The answer that
actually helps is the second one: what would tell these possibilities apart, what
might the doctor look at, and what should I have ready when I get there. HealTrip
is built around that second question, with the clinical logic outside the
language model so it can be read, tested and corrected.

## 2. Architecture

```
                         browser · 7 static pages · no build step
                                        │
                                   nginx :3000
                                        │  same-origin /api
                                        ▼
                            Express API  ·  /api/v1
                                        │
   ┌────────────────────────────────────┼────────────────────────────────────┐
   │                                    │                                    │
   ▼                                    ▼                                    ▼
i18n middleware               clinical engine                      agent orchestrator
Accept-Language               safety gate (15 rules)               plans tool calls
locale envelope               question engine (25)                 executes them
translated errors             differential (28)                    builds the trace
                              evaluations (25)                     claim screen
   │                                    │                                    │
   └────────────────────────────────────┼────────────────────────────────────┘
                                        ▼
                                    store.js
                          PostgreSQL 16  ·  in-memory fallback
```

## 3. Request flow

```
patient text or speech
        │
        ▼
schema validation (zod)
        │
        ▼
safety gate ── literal phrase ─┐
        │      symptom combo ──┼── match ─▶ stop · emergency advice · cite the rule
        │      concept group ──┘
     no match
        ▼
symptom extraction · negation scope · structured patient state
        ▼
next-best-question engine  ── returns the question and its information gain
        ▼
answer applied · state updated · loop until MAX_QUESTIONS or no useful question
        ▼
differential: support / contradiction / missing counts
        ▼
evidence verification: a candidate with no registered source is dropped
        ▼
possible evaluations: what a clinician may consider, why, how to prepare
        ▼
care pathway · specialty · provider search · FHIR · printable report · audit
```

## 4. The agent

The model phrases things. It does not set urgency, choose the next question,
rank a candidate, name a clinician, or touch the database.

```
user message
     │
     ▼
check_safety_rules            always first, cannot be reordered
     │
     ├── emergency or support ─▶ stop, route, cite
     │
     ▼
tool plan ─▶ schema validation ─▶ service ─▶ PostgreSQL ─▶ typed result
     │
     ▼
answer composed from tool results only ─▶ claim screen ─▶ execution trace
```

Eight tools: `check_safety_rules`, `search_doctors`, `search_hospitals`,
`verify_doctor`, `get_provider_details`, `get_clinical_evidence`,
`get_possible_evaluations`, `find_relevant_specialty`.

Every trace step exposes execution metadata only: tool name, argument schema,
status, result count, source, duration, timestamp. No model reasoning.

## 5. Anti-hallucination

Four independent barriers, any one of which stops a fabricated provider:

1. The model has no SQL, no credentials and no table access.
2. Arguments are validated by a schema; `{"specialty": 123}` never reaches a service.
3. The answer is composed from tool results, not model memory. `status: "no_match"`
   is a real answer and the agent says so.
4. The claim screen replaces any wording matching diagnosis or prescription
   patterns with the deterministic text.

Every provider record carries `source`, `source_url`, `licensing_authority`,
`license_status` and `verified_at`. A verified badge requires all four; the
importer refuses to write anything else, and the suite fails the build if a demo
record is ever marked verified.

## 6. Clinical evaluation guidance

After the questions, the person is told what a clinician may consider, the
clinical question each evaluation answers, what to expect, and what to prepare.
Three rules: nothing is an order, nothing appears without a registered source and
a candidate that actually fits at 40% or better, and **no cost is ever estimated**
(`cost_estimate` is always null). A red flag suppresses the section entirely.
See `docs/CLINICAL_EVALUATIONS.md`.

## 7. Bilingual by architecture

`locales/en.json` and `locales/ar.json` serve the API and the interface, so a
string exists once. Every clinical record carries both languages at the record
level. `Accept-Language` is negotiated per request; every response carries
`locale` and `direction`; errors are translated and carry a stable `error_key`.
Language never changes which rule fires or which candidate ranks first: the
English and Arabic versions of the same case are both in the test suite.
See `docs/BILINGUAL_ARCHITECTURE.md`.

## 8. Database

PostgreSQL 16 is the source of truth. 19 tables across identity, health record,
assessment, assistant, directory, evidence, evaluation guidance and governance.
`audit_events` records what the system did; `ai_tool_calls` records what the agent
invoked. pgvector is optional: the schema applies on a plain PostgreSQL and adds
the embedding column only where the extension installed. See `docs/DATABASE.md`.

## 9. API

35 operations under `/api/v1`, described by OpenAPI 3.1 at
`/api/v1/openapi.json` and browsable at `/docs.html`.

| Area | Routes |
|---|---|
| auth | `POST /auth/register`, `POST /auth/login`, `GET /me` |
| assessments | `POST /assessments`, `POST /assessments/{id}/answers`, `GET /assessments/{id}`, `GET /assessments/{id}/evaluations`, `GET /assessments/{id}/fhir`, `GET /assessments/{id}/report`, `DELETE /assessments/{id}` |
| agent | `POST /agent/chat`, `GET /agent/tools` |
| tools | `check-safety`, `search-doctors`, `search-hospitals`, `verify-doctor`, `clinical-evidence`, `possible-evaluations`, `relevant-specialty` |
| directory | `GET /doctors`, `/doctors/{id}`, `/doctors/{id}/license`, `/hospitals`, `/hospitals/{id}`, `/provider-sources` |
| evidence | `GET /evidence`, `/evidence/{id}`, `/knowledge/conditions`, `/knowledge/red-flags` |
| meta | `GET /health`, `/ready`, `/readiness`, `/evaluation`, `/openapi.json`, `/locales/{code}` |

Full reference in `docs/API.md`.

## 10. Security

JWT with bcrypt at cost 12, helmet, CORS, per-IP rate limiting, zod validation on
every write and every tool argument, append-only audit, per-assessment deletion,
and a global error handler that returns a generic message with a reference id
while the detail goes to the log and the audit table. 29 automated security tests
in `scripts/security-tests.js`. See `docs/SECURITY.md`.

## 11. Error handling

| Failure | Behaviour |
|---|---|
| Language provider unreachable | deterministic text, marked unverified |
| Database unreachable | logged reason, in-memory fallback, visible at `/api/v1/health` |
| Tool unknown or misused | structured refusal with the schema issues |
| No provider match | `no_match`, and the agent says so rather than inventing |
| Invalid request | 4xx with a translated message and a stable key |
| Unexpected error | generic message plus a reference id; no stack trace, no SQL, no credentials, no patient content |

14 failure-mode tests in `scripts/resilience-tests.js`.

## 12. Evaluation

```
npm test              clinical suite + agent suite + resilience
npm run eval          211 clinical cases
npm run eval:agent    16 agent turns + 3 schema guards
npm run test:db       every persistence path against a live database
npm run test:security 29 security tests against a running API
npm run test:ui       17 end-to-end checks over HTTP, including vocabulary leaks
npm run test:resilience 14 failure-mode tests
npm run readiness     the ten clinical readiness gates
```

Measured on this build:

```
cases_total                    211     (75 handwritten, 136 generated, 33 adversarial)
case_pass_rate                 1.00
safety_routing_pass_rate       1.00
question_relevance_rate        1.00
citation_grounding_rate        1.00
provider_hallucination_count   0
agent_cases_total              16
agent_pass_rate                1.00
agent_safety_first_rate        1.00
tool_schema_guards             3/3
evaluation_relevance_rate      1.00
evaluation_grounding_rate      1.00
unsupported_evaluation_rate    0
fabricated_preparation_rate    0
fabricated_cost_rate           0
security                       29/29
resilience                     14/14
ui smoke                       24/24
```

These measure internal consistency and architectural properties, not clinical
accuracy. See `docs/EVALUATION.md`.

## 13. Adversarial testing

33 adversarial cases: paraphrased red flags in both languages, negation traps,
third-party mentions, mixed Arabic and English input, and instruction-override
attempts inside the clinical text. Writing them found three real defects, all
fixed and now permanent cases: a negation trap that fired the cardiac rule on
"no chest pain and no sweating", a self-harm rule that routed a football injury
to crisis support, and a regression where negation handling deleted "cannot
control my bladder".

## 14. Local setup

One command, one port:

```bash
./start.sh
```

Then open **http://localhost:4000**. The API serves the interface itself, so the
site and the data are on the same origin and there is nothing to configure. The
script installs dependencies on first run, waits until the API answers, and
prints the URLs. Ctrl+C stops it.

With Docker instead:

```bash
cp .env.example .env
docker compose up --build       # site on :3000, nginx proxies /api
```

No API key is needed. `AI_MODE=demo` is the default and everything works
without one.

**Do not serve the `frontend` folder on its own port.** The pages load, but every
request for data then has to cross an origin and the API may not be running at
all. If you do it anyway, a banner appears at the top of the page telling you
exactly that.

## 15. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | unset | PostgreSQL connection; without it the API runs in memory |
| `AI_MODE` | `demo` | `demo`, `openai` or `gemini` |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | unset | only for the matching mode |
| `JWT_SECRET` | dev default | must be set in production |
| `JWT_EXPIRES` | `7d` | token lifetime |
| `CORS_ORIGIN` | `*` | set to your domain in production |
| `RATE_LIMIT_PER_MIN` | `180` | per-IP request budget |
| `MAX_QUESTIONS` | `8` | questions before the summary |

## 16. PostgreSQL setup

```bash
createdb healtrip
psql -d healtrip -f backend/sql/001_schema.sql
psql -d healtrip -f backend/sql/002_seed.sql
psql -d healtrip -f backend/sql/003_clinical_evaluations.sql
psql -d healtrip -f backend/sql/004_clinical_evaluations_seed.sql

DATABASE_URL=postgres://user:pass@localhost:5432/healtrip npm start
npm run test:db     # confirms /api/v1/health reports "postgres"
```

`docker compose` applies all four automatically on the first boot.

## 17. Demo

```bash
node scripts/demo.js        # English
node scripts/demo.js ar     # Arabic
```

Path A is the hiring scenario: "I have chest pain and I am not sure whether to
see a cardiologist, go to the ER, or get a second opinion." It prints each
question with its information gain and the reason it was asked, the shortlist
moving after every answer, the possible evaluations with their clinical
questions, the agent turn with its execution trace, and the FHIR and report
exports.

Path B sends "My chest feels heavy and I am sweating heavily", with an explicit
request to find a cardiologist. The safety gate ends the turn: no question is
asked, no provider search runs, no testing discussion appears.

In the interface: `assessment.html` for the console, `chat.html` for the agent
with its trace, `network.html` for the directory, `evidence.html` for the live
metrics and readiness gates, `docs.html` for the API with a live agent probe.

## 18. Limitations

- Phrase and concept matching is literal. A red flag described in wording the
  rules do not contain will be missed. This is the single most important reason
  this is not a clinical tool.
- Negation handling is shallow and covers common written forms only.
- The knowledge base covers 28 common presentations. Outside them the system
  reports an empty shortlist rather than guessing.
- Scoring weights were set by hand for plausible behaviour, not fitted to outcome data.
- Provider records are invented demo data. No licensing authority has been queried.
- Docker has not been run: the build environment has no Docker daemon.
- The interface has not been opened in a real browser. It was driven headlessly
  with jsdom against the live API.
- No clinician has reviewed any knowledge entry.

## 19. Clinical readiness

`npm run readiness`, also at `/api/v1/readiness` and on the evidence page. Ten
gates; the database gate closes when started with `DATABASE_URL`, and nine
remain open with the reason for each. The system says so in its own interface
rather than hiding it.

## 20. Disclaimer

HealTrip is a technical prototype and release candidate. It is **not** a
clinically validated or regulatory-approved medical device, has no clearance in
any jurisdiction, and must not be used to make a clinical decision. Source links
point to public guidance from NICE, the CDC, the NHS, MedlinePlus, HL7 and the
WHO; the knowledge base contains original summaries written for this project and
reproduces no source text.

---

## Repository layout

```
healtrip-ai-platform/
├── docker-compose.yml · .env.example
├── locales/                     en.json · ar.json, read by the API and the interface
├── backend/
│   ├── src/
│   │   ├── server.js            API, auth, rate limit, audit, error handler
│   │   ├── api/v1.js            versioned contract
│   │   ├── openapi.js           OpenAPI 3.1 document
│   │   ├── i18n.js              Accept-Language negotiation
│   │   ├── store.js             PostgreSQL or in-memory, one interface
│   │   ├── readiness.js         the ten clinical readiness gates
│   │   ├── evaluation.js        206 clinical cases and the metrics
│   │   ├── agent/               tools · orchestrator · agent evaluation
│   │   ├── clinical/            knowledge · evaluations · engine · providers
│   │   ├── providers/importer.js  GMC / SCFHS / DHA / DOH / SMC importer
│   │   ├── services/report.js   printable bilingual report
│   │   └── ai/provider.js       demo / OpenAI / Gemini plus the claim screen
│   └── sql/                     001 schema · 002 seed · 003 + 004 evaluations
├── frontend/                    7 pages, no build step
├── scripts/                     build-pages · demo · db-smoke · security · resilience
└── docs/                        16 documents plus the platform walkthrough PDF
```

## Publishing to GitHub

```bash
git init && git add . && git commit -m "HealTrip: AI patient decision assistant"
git branch -M main
git remote add origin git@github.com:<you>/healtrip.git
git push -u origin main
```

`.gitignore` already excludes `node_modules/` and `.env`. The repository contains
no keys and no real credentials: `.env.example` ships placeholders, and the local
database password in `docker-compose.yml` is a documented default to change.
