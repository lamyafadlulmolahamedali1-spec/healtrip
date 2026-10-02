# API v1

Base path `/api/v1`. The machine-readable contract is at `/api/v1/openapi.json`
and the browsable version is the API page in the interface.

## Three rules that hold everywhere

1. Every request body is validated by a schema before anything runs. A field of
   the wrong type is rejected with the reason, by the API and not by the client.
2. The language model never reaches the database. It emits a tool name and
   arguments; the tool layer validates and executes them.
3. Every response carries `locale` and `direction`, and every human-readable
   string comes from `locales/*.json` rather than from a literal in the code.

## Language

`Accept-Language: ar` or `en`, or `?lang=`, or a `language` field in the body,
in that order of precedence. The response repeats the decision:

```json
{ "locale": "ar", "direction": "rtl", "type": "question", "question": { "text": "..." } }
```

Clinical logic is identical in both languages. The same rule fires, the same
question is selected and the same candidate is ranked first; only the wording
changes. The evaluation suite carries Arabic and English versions of the same
case to keep that true.

## Endpoints

### Meta
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | status, storage mode, AI mode, knowledge counts, supported languages |
| GET | `/readiness` | the ten clinical readiness gates and what is still open |
| GET | `/evaluation` | runs the clinical and agent suites, returns measured metrics |
| GET | `/openapi.json` | this contract |
| GET | `/locales/{code}` | the locale bundle the interface uses |

### Assessments
| Method | Path | Purpose |
|---|---|---|
| POST | `/assessments` | open an assessment; the safety gate runs first and may end the turn |
| POST | `/assessments/{id}/answers` | answer a question or add free text; returns the next best question or the summary |
| GET | `/assessments/{id}` | structured summary |
| GET | `/assessments/{id}/fhir` | FHIR R4 bundle |
| GET | `/assessments/{id}/evaluations` | what a clinician may consider, why, and how to prepare |
| GET | `/assessments/{id}/report?lang=` | printable bilingual clinical navigation summary |
| DELETE | `/assessments/{id}` | delete the assessment and its content |

```bash
curl -X POST localhost:4000/api/v1/assessments \
  -H 'content-type: application/json' -H 'accept-language: ar' \
  -d '{"message":"عندي ألم في الصدر مع تعرق"}'
```

```json
{
  "locale": "ar",
  "direction": "rtl",
  "assessment_id": "…",
  "type": "emergency",
  "urgency": "emergency",
  "redFlags": [{ "id": "acute_coronary", "source": { "publisher": "NICE (UK)" } }],
  "message": "اطلبي تقييمًا طبيًا طارئًا فورًا…"
}
```

The model cannot reach around this. `type: "emergency"` is produced by the rule
engine before any wording layer runs.

### Agent
| Method | Path | Purpose |
|---|---|---|
| POST | `/agent/chat` | one agent turn with its tool calls and execution trace |
| GET | `/agent/tools` | the catalog the agent is restricted to |

### Tools, callable directly
`POST /tools/check-safety`, `/tools/search-doctors`, `/tools/search-hospitals`,
`/tools/verify-doctor`, `/tools/clinical-evidence`, `/tools/relevant-specialty`.

Same schemas, same services, same typed results as the agent uses. Useful for
testing and for any client that wants the data without the wording layer.

```bash
curl -X POST localhost:4000/api/v1/tools/search-doctors \
  -H 'content-type: application/json' -d '{"specialty":"Cardiology","city":"Tokyo"}'
```

```json
{ "source": "provider_database", "status": "no_match", "count": 0, "results": [] }
```

`no_match` is a first-class answer. Nothing downstream is allowed to fill the gap.

### Directory and evidence
`GET /doctors`, `/doctors/{id}`, `/doctors/{id}/license`, `/hospitals`,
`/provider-sources`, `/evidence`, `/evidence/{id}`, `/knowledge/conditions`,
`/knowledge/red-flags`.

## Errors

Every error returns a translated message and a stable key, so a client can
localise or branch on the key without parsing prose.

```json
{ "locale": "ar", "direction": "rtl",
  "error": "هذا التقييم غير موجود. ابدئي تقييمًا جديدًا.",
  "error_key": "errors.assessmentNotFound" }
```

## Versioning

`/api/v1` is frozen in shape. The pre-v1 routes still respond for the current
interface, and will be removed once every client speaks v1. Technical
identifiers are never translated: paths, field names, tool names, `assessment_id`,
`FHIR`, `JWT` stay as they are in both languages.
