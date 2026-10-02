# Provider verification

## Current state

Every provider record shipped in this repository is invented. `license_status` is `unverified`, `licensing_authority` is null, `verified_at` is null, and `source` is `Demo registry`. The interface shows that label instead of a badge, and the evaluation suite fails the build if any demo record is ever marked verified.

## The registers a real importer would use

| Authority | Country | Register | Bulk use |
|---|---|---|---|
| GMC, General Medical Council | United Kingdom | https://www.gmc-uk.org/registration-and-licensing/our-registers | data licence required |
| SCFHS, Saudi Commission for Health Specialties | Saudi Arabia | https://scfhs.org.sa/en | licensed access required |
| DHA, Dubai Health Authority | United Arab Emirates | https://www.dha.gov.ae/ | licensed access required |

Each of these publishes its own terms. Bulk download or redistribution of a register is a licensing question, not a scraping question, and it has to be settled before any of this data enters a product.

## What the importer must write

A record only becomes verified when all of these are present:

```
licensing_authority   the authority code, from the table above
license_number        as issued
license_status        active | lapsed | restricted
verified_at           timestamp of the actual query
source                the authority, not "Demo registry"
source_url            the record the check was made against
```

## Interface rule

The badge is driven by `license_status === 'verified'` together with a non-null `licensing_authority`. Anything else renders the provenance label. There is no code path that displays a verification badge from inferred or model-generated data, and `providerGrounding()` in the evaluation suite exists specifically to keep it that way.

## Re-verification

A licence status is a snapshot. A deployment needs a re-check schedule, at minimum every 90 days, with `verified_at` driving the badge's own wording so the person can see how fresh the check is.
