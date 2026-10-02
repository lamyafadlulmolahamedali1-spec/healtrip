# Where HealTrip sits next to the symptom checkers people already use

## The honest position first

HealTrip cannot be called better than Ada or Isabel, and this repository will
not say that it is. Those products have years of clinical curation, regulatory
work and published evaluation behind them. A superiority claim needs a head-to-head
benchmark on the same case set, scored by clinicians who do not know which system
produced which answer. That study does not exist for HealTrip. Until it does, the
claim would be marketing, and in health software marketing that outruns evidence
is the failure mode to avoid.

What can be said is what HealTrip is built to do differently, and that difference
is deliberate.

## The design difference

A conventional symptom checker answers one question: what might this be. The
output is a ranked list of conditions and an urgency level.

HealTrip answers a second question that the first one leaves open: what would
tell these possibilities apart, and why would a clinician ask for it. Every
screen is organised around that:

| | Conventional flow | HealTrip |
|---|---|---|
| Questions | Fixed or lightly branched questionnaire | Chosen each turn by how much the answer would re-rank the possibilities still in contention, with the score returned to the client as `informationGain` |
| Why a question was asked | Not shown | Shown next to every question, in the person's language |
| Output | Ranked conditions, percentages | Possibilities with what supports them, what argues against, what is still unknown, and what a clinician may evaluate to separate them |
| Numbers | Probability-like percentages | Compatibility with the information reported, stated as such on every screen, because the calibration data for a probability does not exist here |
| Sources | Usually absent from the patient view | Every possibility carries a published source, and a candidate with no registered source is dropped before display |
| Model's role | Often the whole system | Wording only. Urgency, question choice and candidate ranking are deterministic and readable in `clinical/engine.js` |
| Safety | Internal | Fifteen rules published at `/api/knowledge/red-flags` and rendered on the evidence page |
| Providers | Directory or none | Records carry an authority, a licence number, a source URL and a verification timestamp, or they are shown as unverified |
| Evaluation | Published selectively | The suite runs live at `/api/evaluation`, and the readiness gates at `/api/readiness` report what is still open |

## What genuinely raises the ceiling here

1. **The safety gate matches concepts, not only phrases.** Fifteen rules carry
   both literal phrasing and concept groups, so "my chest feels heavy and I am
   sweating a lot" fires the same rule as the textbook wording, in Arabic and
   English. Nine paraphrase cases and five deliberately ordinary presentations
   guard both directions in the suite.
2. **The question engine is inspectable.** The reason each question was chosen is
   a number the client receives, not a black box.
3. **Nothing reaches the screen ungrounded.** Structural verification drops
   unsourced candidates; textual verification replaces model output that matches
   diagnosis or prescription patterns with the deterministic text.
4. **The readiness gates are part of the product.** The system reports that it is
   not clinically ready, in the interface, with the reason for each open gate.

## What Ada and Isabel have that HealTrip does not

Clinical curation at a far larger scale, published validation, regulatory
standing, years of real-world use, and a knowledge base that covers presentations
far beyond the 28 in this build. Those are not small gaps, and closing them is
the work the ten gates describe.

## What a fair comparison would need

A set of several hundred vignettes with clinician-assigned reference answers, run
blind through each system, scored on safety routing, appropriate referral, the
quality of the discriminating information offered, and the rate of unsupported
statements. Report the results whichever way they come out.
