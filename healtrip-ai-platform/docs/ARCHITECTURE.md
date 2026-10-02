# Architecture

## Principle

The clinical logic lives outside the language model. A model that is swapped, downgraded, or unavailable changes the wording of an answer and nothing else. Urgency, question selection, candidate ranking and provider facts are all deterministic and inspectable.

## Request path

```
browser (static, nginx)
   |  same-origin /api, proxied
   v
Express API
   |
   +-- rate limit, helmet, CORS, zod validation
   |
   +-- store.js ............ PostgreSQL if DATABASE_URL resolves, else in-memory
   |
   +-- clinical/engine.js
   |      ingestText()      symptom extraction + red-flag screen
   |      applyAnswer()     state update, urgency accumulation
   |      scoreCandidates() support / contradiction / missing
   |      nextQuestion()    information-gain style selection
   |      buildDifferential() drops candidates with no registered source
   |      carePathway()     urgency floor from red flags and top candidate
   |      toFhirBundle()    FHIR R4 export
   |
   +-- ai/provider.js ...... demo | anthropic | openai, then verify()
   |
   +-- clinical/providers.js  doctor and hospital search, licence metadata
```

## Why the question engine is not a questionnaire

`nextQuestion()` scores every unanswered, applicable question by how much its options would move the candidates that are currently live. A question that separates two candidates still in contention outranks one that does not, and general context questions are deliberately weighted down so they land later. The score is returned to the client as `informationGain`, so the selection is auditable rather than magic.

## Why compatibility is not a percentage of disease

`scoreCandidates()` produces a raw score from reported features and answered questions, then normalises against the top candidate. A candidate is only considered at all when the person reported a feature it explains, so follow-up answers re-rank candidates but never conjure one out of nothing. The number shown is compatibility with the information given, and the interface says so on every screen where it appears. Turning it into a probability would require calibration against outcome data this project does not have.

## Urgency

Only a red-flag rule can reach the emergency level. A high-acuity top candidate raises the floor by one level, no further. This keeps "call an ambulance" attached to explicit written rules rather than to a score.

## Evidence verification

Two checks, in series:

1. Structural. A candidate with no entry in the source register never reaches the response. Dropped candidates are returned in `droppedClaims` so failures are visible rather than silent.
2. Textual. Model output is screened for diagnosis and prescription patterns, and for length. Anything that fails is replaced by the deterministic template.

## Data model

Patient-entered content lives in one place, `assessments.state`, and is removable with a single DELETE. The audit table records what the system did, not what the person said.

## Scaling this further

The parts most worth building next, in order: accounts and longitudinal history; a licence importer for one jurisdiction; retrieval over a licensed guideline corpus to replace the hand-written summaries in `knowledge.js`; a clinician review pass over the knowledge base; and a held-out case set scored by clinicians rather than by the engine's own expectations.
