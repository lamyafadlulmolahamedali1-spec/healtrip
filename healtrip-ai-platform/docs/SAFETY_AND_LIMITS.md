# Safety and limits

## What the system refuses to do

- Name a diagnosis. Output is always framed as compatibility with reported information.
- Continue an interview after a red-flag rule fires.
- Recommend a specific investigation as something the person should obtain. Investigations are shown as what a clinician may consider, with the reason.
- Present a provider as licence-verified when no licensing authority has been queried.
- Let the language model introduce a condition, test, medicine or clinician that is not in the data it was handed.

## The red-flag rules

Ten rules, in `backend/src/clinical/knowledge.js`, matched against the raw text of every turn plus symptom combinations. They cover suspected cardiac chest pain, stroke, sepsis, thunderclap headache, anaphylaxis, cauda equina, significant bleeding, pregnancy-related abdominal pain, fever in a very young infant, and disclosed thoughts of self-harm.

The self-harm rule is handled differently from the rest. It does not produce a triage level or a differential. It stops the assessment and points the person to human support, because a symptom checker is the wrong instrument for that conversation.

## Negation and intent

Two refinements sit between the raw text and the rules.

Negation scope: everything from a negator ("no", "not", "without", "لا", "بدون")
up to the next clause boundary is removed before matching, so "no chest pain and
no sweating, only a sore throat" does not fire the chest rule. Phrases that are
themselves negations of clinical importance are protected first: "cannot control
my bladder", "the inhaler is not working", "لا أتحكم", "ما بينفع". Without that
protection the negation handling would delete the very words that matter.

Intent for self-harm: unambiguous wording fires on its own. "I hurt myself" is
usually an injury, so it only routes to human support alongside an intent word
("want", "thinking about", "أريد", "أفكر"). Both directions are tested.

## Known weaknesses

Negation handling is shallow: it covers the common written forms and nothing
cleverer. A negation spread across clauses, or expressed indirectly, will be
missed, and the rule will fire when it should not.

Phrase matching is literal outside the concept groups. A red flag described in wording the rules do not contain will be missed, which is the single most important reason this is not a clinical tool. Real deployment needs a trained safety classifier layered on top of these rules, evaluated on held-out cases, with the rules kept as a floor rather than replaced.

The knowledge base covers 15 candidate explanations across common presentations. Anything outside it produces an empty shortlist, which the system reports honestly instead of guessing.

Scoring weights were set by hand for plausible behaviour, not fitted to outcome data.

Age, sex, pregnancy status and comorbidity are only partially captured. A production version needs these as first-class state, since they change both the shortlist and the urgency.

## Before this could be used with real patients

Clinician review of every entry in the knowledge base. A safety classifier with published evaluation. A held-out case set scored by clinicians. Authentication, consent capture, data-retention policy and encryption at rest. Regulatory assessment in each jurisdiction, since software of this kind is regulated as a medical device in many of them. None of that exists here.
