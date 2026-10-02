# HealTrip AI/Data Catalog

| Asset | Role | Deployment rule |
|---|---|---|
| MedGemma | medical language/multimodal foundation model | model-license and intended-use review required |
| MedSigLIP | medical image representation/retrieval | model-license and intended-use review required |
| PrimeKG | clinical knowledge graph | verify dataset license separately from MIT code license |
| MIMIC-IV | real de-identified clinical research data | credentialed research use only under current PhysioNet DUA; keep outside patient production DB |
| Synthea | synthetic patient generation | development/testing; Apache-2.0 |
| NICE/WHO/CDC/NHS | clinical/public-health evidence | store metadata/citations; ingest only under current reuse/licensing terms |
| GMC/SCFHS | provider verification sources | use official/authorized feeds or permitted imports; do not scrape or invent data |

Every production source should have an owner, license, version, retrieval date, content hash where appropriate, review date, intended use, and rollback path.
