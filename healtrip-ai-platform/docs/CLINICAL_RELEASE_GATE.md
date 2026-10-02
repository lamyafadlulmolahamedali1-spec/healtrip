# HealTrip Clinical Release Gate

This release implements the technical controls needed for a clinical-grade development path. It does **not** by itself establish regulatory clearance, clinical validation, or permission to operate as a medical device in any jurisdiction.

## Implemented in this release

- deterministic safety gate runs before model phrasing;
- structured patient profile and patient-entered records;
- separate patient-reported vs verified record status;
- persistent assessments and conversations when PostgreSQL is enabled;
- JWT authentication with bcrypt password hashing;
- audit events and AI tool-call records;
- provider registry metadata with verification status and source provenance;
- evidence source/version/license metadata;
- FHIR R4 assessment export;
- OpenAI/Gemini/demo AI provider abstraction;
- model-output claim screen and deterministic fallback;
- Arabic/English UI and RTL support;
- upload validation for medical PDFs/images;
- pgvector-ready evidence schema;
- synthetic evaluation suite.

## Required before real patient deployment

1. Obtain legal/licensing approval for every model, dataset, guideline and provider feed used in the deployed jurisdiction.
2. Complete clinical validation of the complete HealTrip intended use with qualified clinicians and representative cases.
3. Complete a medical-device/CDS regulatory assessment for each target market.
4. Establish privacy, security, retention, access-control, incident-response and data-subject rights procedures appropriate to the deployment jurisdiction.
5. Replace demo provider records with an authorized registry integration/import and never display unverified records as verified.
6. Establish a controlled clinical evidence ingestion process with versioning, provenance, review and rollback.
7. Run independent safety/red-team evaluation, including false reassurance, emergency misses, language errors, adversarial inputs and hallucination tests.
8. Establish human clinical oversight and a change-control process for models, prompts, rules, evidence and provider data.
9. Deploy PostgreSQL/pgvector with encrypted storage, backups, monitoring, secret management and disaster recovery.
10. Perform penetration testing and production load testing before exposing the service to patients.

## Important data-license notes

- MIMIC-IV is credentialed health data governed by a PhysioNet Data Use Agreement for scientific research. It must not be copied into the production patient database or treated as unrestricted commercial data.
- Synthea generates synthetic records and is Apache-2.0; it is appropriate for development and testing, not proof of clinical effectiveness.
- PrimeKG software is MIT, but its dataset has separate licensing terms; verify the dataset license before redistribution or commercial use.
- MedGemma model weights are under the Health AI Developer Foundations License; repository code is Apache-2.0. Review the current model license and intended-use statement before deployment.
