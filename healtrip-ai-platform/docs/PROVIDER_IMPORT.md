# Importing clinicians from a licensing authority

## The rule this enforces

A provider record is only shown as verified when four fields are present
together: the authority, the licence number, the source URL, and the timestamp
of the check. The importer refuses to write a verified record without all four,
and the evaluation suite fails the build if a demo record is ever marked
verified. There is no other path to a verification badge.

## Running it

```bash
# see what would be written, without touching the database
node src/providers/importer.js --file gmc-export.json --authority GMC --dry-run

# write to the database
DATABASE_URL=postgres://... node src/providers/importer.js --file gmc-export.csv --authority GMC
```

Authorities recognised by the importer: GMC (United Kingdom), SCFHS (Saudi
Arabia), DHA and DOH (United Arab Emirates), SMC (Sudan).

## Input format

A JSON array, or a CSV with a header row. Recognised columns:

| Column in the export | Field written |
|---|---|
| reference_number, registration_number, licence_number | license_number |
| name, or given_name plus family_name | full_name |
| specialty, speciality | specialty |
| sub_specialty | subspecialty |
| qualifications | qualifications |
| registration_status, status | drives verified or unverified |
| city, country, organisation | location and employer |
| languages (semicolon separated) | languages |
| profile_url | registry_profile_url |
| email | contact_email, with contact_source recorded |

Unmapped columns are ignored rather than guessed at. A row missing a name or a
specialty is rejected and reported, not written with blanks.

## Getting the export

This is a legal step before it is a technical one. Each authority publishes its
own terms, and bulk use is a data licence question rather than a scraping
question.

| Authority | Country | Register |
|---|---|---|
| GMC | United Kingdom | https://www.gmc-uk.org/registration-and-licensing/our-registers |
| SCFHS | Saudi Arabia | https://scfhs.org.sa/en |
| DHA | United Arab Emirates | https://www.dha.gov.ae/ |
| DOH Abu Dhabi | United Arab Emirates | https://www.doh.gov.ae/ |

Start with one country. The schema already carries a per-record authority, so
adding a second does not change the data model.

## Contact details

Email and photograph are not taken from a register. They are written only when
the organisation supplies them and permits publication, and the interface shows
where they came from. A record with no permitted email says so rather than
leaving the field blank.

## Re-verification

A licence status is a snapshot. Schedule a re-check at least every 90 days. The
badge wording uses verified_at, so a stale check is visible to the person
reading it rather than hidden behind a tick.
