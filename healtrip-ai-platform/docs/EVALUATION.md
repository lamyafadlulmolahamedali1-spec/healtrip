# Evaluation

Two suites, both run live at `/api/v1/evaluation` and on the evidence page, so
no number in the documentation can drift from the code.

## Clinical suite, `npm run eval`

206 cases: 70 handwritten and 136 generated from the knowledge base itself, so a
new rule or condition brings its own tests. 33 of the handwritten cases are
adversarial.

| Family | What it checks |
|---|---|
| S01–S10 | red flags route to emergency from their written phrasing |
| P01–P09 | paraphrases that avoid the literal phrasing still fire, Arabic and English |
| N01–N05 | ordinary presentations do not trip the safety layer |
| R, D01–D20 | answers move the differential the way the knowledge base says |
| G, C | generated coverage: every rule, every candidate |
| A01–A02 | the system abstains rather than guessing when there is too little |
| X01–X05 | instruction-override attempts inside the clinical text change nothing |
| Z01–Z05 | negation and third-party mentions do not fire a rule |
| M01–M03 | mixed Arabic and English input reaches the same concepts |
| P10–P15 | paraphrases of the newer rules, both languages |
| K001–K0nn | generated concept combinations: every rule, every pairing of its groups |

```
cases_total                   206      (70 handwritten, 136 generated, 33 adversarial)
case_pass_rate                1.00
safety_routing_pass_rate      1.00
question_relevance_rate       1.00
citation_grounding_rate       1.00
provider_hallucination_count  0
```

## Agent suite, `npm run eval:agent`

10 turns plus three schema guards.

| Property | Check |
|---|---|
| Safety runs first | the first trace step is `safety_check` on every turn |
| Emergency stops the turn | no tool plan runs after an emergency rule fires |
| Symptoms are redirected | a symptom description goes to the assessment, not the assistant |
| No invented clinician | a `no_match` result must produce a refusal with no name in it |
| Schema guards | wrong type, unknown tool and missing argument are all rejected |

```
agent_pass_rate                1.00
agent_safety_first_rate        1.00
agent_provider_invention_count 0
tool_schema_guards             3/3
```

## What the adversarial pack found

Writing it was not a formality. Three real defects came out of it and were fixed:
a negation trap that fired the cardiac rule on "no chest pain and no sweating",
a self-harm rule that routed a football injury to crisis support, and, once
negation handling was added, a regression where "cannot control my bladder" and
"the inhaler is not working" stopped matching because the stripper removed them.
All three are now cases in the suite.

## Evaluation-guidance metrics

```
evaluation_relevance_rate               1.00
evaluation_grounding_rate               1.00
unsupported_evaluation_rate             0
fabricated_preparation_rate             0
fabricated_cost_rate                    0
evaluation_bilingual_consistency        1.00
evaluation_safety_override              true
evaluation_negation_clean               true
evaluation_abstains_without_candidates  true
```

The four fabrication rates are structural rather than behavioural: the engine can
only surface an entry that exists in the controlled knowledge layer, so a
non-zero rate means the pipeline broke, not that a model misbehaved.

## What this is not

Clinical accuracy. Both suites measure internal consistency and architectural
properties against behaviour this repository states. A rule the wording does not
cover stays uncovered here too.

Closing that gap needs several hundred vignettes with clinician-assigned
reference answers, run blind, scored on safety routing, referral appropriateness,
the quality of the discriminating information offered, and the rate of
unsupported statements. That is gate three in `npm run readiness`, and it is
open.
