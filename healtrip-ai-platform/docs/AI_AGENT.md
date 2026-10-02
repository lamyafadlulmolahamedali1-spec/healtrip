# The agent

## What the model is allowed to do

Phrase things. That is the whole job. It does not set urgency, choose the next
question, rank a candidate, name a clinician, or reach a database.

```
user message
     |
     v
check_safety_rules            always first, cannot be skipped or reordered
     |
     +-- emergency or support --> stop, return the routed advice, cite the rule
     |
     v
intent routing                deterministic in demo mode; model-proposed tool
     |                        calls are still restricted to the catalog
     v
tool execution                schema validated, service backed, typed result
     |
     v
response composed from tool results only
     |
     v
claim screen over the wording
```

Each step is appended to a trace the client can render. The trace shows what the
system did, never the model's internal reasoning.

## The catalog

| Tool | Returns |
|---|---|
| `check_safety_rules` | level, matched rules, detected symptoms, rule count |
| `search_doctors` | provider records with source, or `no_match` |
| `search_hospitals` | hospital records with source, or `no_match` |
| `verify_doctor` | licence status and the registers an importer would query |
| `get_provider_details` | one full provider record |
| `get_clinical_evidence` | registered sources, optionally for one candidate |
| `find_relevant_specialty` | the specialty recorded in the knowledge base |
| `get_possible_evaluations` | evidence-supported evaluations a clinician may consider, with the clinical question each answers |

Every result carries `source` and `status`. `status: "no_match"` is a real
answer, and the agent says so rather than filling the gap.

## Why a clinician is never invented

Four independent barriers, any one of which stops it:

1. The model has no SQL, no credentials and no table access.
2. Arguments are validated by a zod schema; `{"specialty": 123}` never reaches a
   service.
3. The composed answer is built from tool results, not from model memory.
4. The claim screen in `ai/provider.js` replaces any wording matching diagnosis
   or prescription patterns with the deterministic text.

`src/agent/evaluation.js` tests this directly: asking for a neurologist in a city
the directory does not cover must produce a refusal with no name in it, in Arabic
and in English.

## Measured

```
agent_cases_total              10
agent_pass_rate                1.00
agent_safety_first_rate        1.00     safety ran first on every turn
agent_provider_invention_count 0
tool_schema_guards             3/3      wrong type, unknown tool, missing argument
```

Run it: `npm run eval:agent`.

## Switching the model on

`AI_MODE=demo` keeps the deterministic planner and the deterministic wording.
Setting `AI_MODE` to a provider lets the model propose the tool plan and phrase
the answer. Nothing else changes: the safety gate, the schemas, the services and
the claim screen are identical in both modes, which is the point of keeping the
clinical logic outside the model.
