# Intended use

This statement exists so that the product's scope is written down before anyone
argues about it. It is a starting point for a regulatory assessment, not a
clearance, and nothing in it makes HealTrip a cleared medical device.

## What HealTrip is for

HealTrip is patient-facing software that helps a person describe symptoms,
understand which explanations are compatible with what they reported, learn what
would tell those explanations apart, and reach an appropriate kind of clinician.

## Intended user

An adult describing their own symptoms, or an adult describing symptoms on
behalf of someone in their care, with general literacy in Arabic or English.

## Intended environment

Consumer devices, outside a clinical setting, before or between appointments.
Not for use inside a clinical workflow, not for triage by staff, and not as an
input to a prescribing decision.

## Intended clinical claim

None. HealTrip does not claim to detect, diagnose, prevent, monitor, predict,
prognose or treat any disease. Output is framed as compatibility with the
information the person reported.

## Explicitly out of scope

- Children under 16, where presentation and red flags differ materially
- Pregnancy-specific assessment beyond the single red-flag rule
- Mental health assessment of any kind
- Medicine dosing, interaction checking or prescribing advice
- Interpretation of imaging, ECGs or laboratory values
- Emergency triage as a substitute for an emergency service

## Contraindications

Do not use HealTrip in place of contacting an emergency service. Do not use it
to decide whether to continue, stop or change a prescribed medicine. Do not use
it as the record of record for a clinical decision.

## Residual risks the design accepts

1. Literal phrase matching in the safety rules can miss a red flag described in
   wording the rules do not contain. Mitigation: rules err towards firing, an
   emergency stops the interview, and the limitation is stated in the interface.
2. The knowledge base covers common presentations only. Mitigation: the system
   reports an empty shortlist instead of guessing.
3. A person may read compatibility as probability. Mitigation: the wording is
   fixed in the engine, not left to the language model, and the interface
   repeats the distinction next to every percentage.
4. A language model may phrase something outside the supplied data. Mitigation:
   a claim screen replaces any output matching diagnosis or prescription
   patterns with the deterministic text.

## Regulatory position

In several jurisdictions, software that provides information used to inform a
care decision falls within the medical device definition, depending on its
intended purpose rather than its marketing. Any deployment must be assessed per
market before release. Until that assessment exists, this build is labelled as a
research and engineering prototype in the interface, the README and the footer.
