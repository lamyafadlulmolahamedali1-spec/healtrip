# What a clinician may consider next

The layer that answers the question people actually arrive with: if these are
the possibilities, what would the doctor look at, why, and what should I have
ready.

## The three rules

1. **Nothing is an order.** Every entry is phrased as something a clinician may
   consider after history and examination. The wording is fixed in the knowledge
   file, not left to a model: "may help distinguish", never "you need this test".
2. **Nothing appears unsupported.** An evaluation reaches a person only when one
   of its associated candidates is in the verified differential, that candidate
   fits at 40% compatibility or better, and the entry carries a registered
   source. With no supported entry the system says so rather than listing tests.
3. **No cost is ever estimated.** `cost_estimate` is always null. The practical
   note says cost and availability vary and that the clinic is where to ask.
   A price without a sourced country, facility, test and date is a guess, and a
   guess about money is how a person ends up unprepared.

## What each entry carries

```
id, type                     ecg, laboratory | imaging | bedside test | examination | procedure
name                         en + ar
why                          why a clinician may consider it, in plain language
clinical_question            what it may help evaluate
what_to_expect               what physically happens, non-graphic
preparation                  only where a source supports it; null means none indicated
preparation_status           source_supported | none_indicated
practical                    cost and availability vary; ask the clinic
cost_estimate                always null
relates_to                   the live candidates it bears on, with their compatibility
evidence                     registered sources
confidence                   evidence_supported
priority_score               how it was ordered
```

## Preparation is deliberately narrow

Generic, safe items only: bring previous results, bring the medicine list,
mention allergies, note when symptoms started, tell the team about pregnancy
before an X-ray. Nothing tells a person to fast, to stop or change a medicine,
or to do anything to themselves. Where preparation depends on the individual,
the entry defers to the clinic. The evaluation suite fails if any preparation
string appears that is not in the knowledge file.

## Ordering

Fit first, then safety, then discriminating power:

```
score = 3 × (best linked candidate compatibility)
      + 0.5 × (sum of linked compatibilities)
      + 1.5 if it separates more than one live candidate
      + 2.5 if it is safety relevant AND a linked candidate fits at 50% or more
```

The safety bonus is conditional on fit so that a serious-sounding test tied to a
barely-matching candidate cannot lead the list. Four entries maximum.

## Safety overrides the whole section

If a red-flag rule has fired, the status is `safety_override` and the list is
empty. An emergency is not a testing discussion, and burying "go now" under six
test cards would be the worst possible failure of this layer.

## Emotional framing

The section states plainly that being asked for a test does not by itself mean a
condition has been confirmed, and that clinicians often use tests to tell
possibilities apart, including to rule them out. It does not say "don't worry"
or "everything is fine". Calm and honest, not reassuring by default.

## Where it is exposed

| Surface | Path |
|---|---|
| API | `GET /api/v1/assessments/{id}/evaluations` |
| Agent tool | `get_possible_evaluations` |
| Direct tool | `POST /api/v1/tools/possible-evaluations` |
| Assessment summary | included as `summary.nextEvaluations` |
| Printable report | its own section, English and Arabic |
| Database | `clinical_evaluations`, `clinical_evaluation_links`, `clinical_evaluation_evidence` |

## Measured

```
evaluation_relevance_rate               1.00   every entry tied to a candidate fitting ≥40%
evaluation_grounding_rate               1.00   every entry carries a registered source
unsupported_evaluation_rate             0
fabricated_preparation_rate             0
fabricated_cost_rate                    0
evaluation_bilingual_consistency        1.00   same entries in both languages
evaluation_safety_override              true
evaluation_negation_clean               true   "I do not have chest pain" pulls no cardiac test
evaluation_abstains_without_candidates  true
```

## What this is not

It is not a list of what you will be asked to do, and it is not clinical advice.
Which evaluation is appropriate depends on examination, age, history and prior
probability. The entries here have not been reviewed by a clinician; that is
gate ten in `npm run readiness`, and it is open.
