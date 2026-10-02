# Bilingual by architecture

Arabic and English are not a translation layer over an English product. They are
a property of the data, the API and the clinical knowledge base.

## One source of truth

`locales/en.json` and `locales/ar.json` sit at the repository root. The API reads
them through `src/i18n.js`. The interface reads the same files, copied into
`frontend/locales/` by `scripts/build-pages.py` and fetched at runtime, with
`/api/v1/locales/{code}` as a fallback. A string exists once.

Namespaces: `common`, `errors`, `safety`, `assessment`, `agent`, `providers`,
`report`, `evidence`, `patient`, `api`.

## The clinical layer is bilingual at the record level

Not `if (ar) … else …` scattered through the code. Every clinical object carries
both languages:

```js
{
  id: 'headache_character',
  en: 'Is the headache on one side and throbbing, or a band of pressure?',
  ar: 'هل الصداع في جهة واحدة ونابض، أم ضغط كالشريط حول الرأس؟',
  why_en: 'Side and quality are the main features that separate migraine from tension-type headache.',
  why_ar: 'الجهة والطابع هما أهم ما يفرق بين الشقيقة والصداع التوتري.',
}
```

The same holds for symptoms, red-flag rules, candidate explanations, their
discriminating features, the investigations a clinician may consider, and the
care advice.

## Language never changes the clinical decision

```
"My chest feels heavy and I'm sweating."     ->  chest_pain + diaphoresis concept
"صدري تقيل وعندي تعرق شديد."                  ->  chest_pain + diaphoresis concept
                                                        |
                                                 same safety engine
                                                        |
                                                 same decision: emergency
```

There is one safety engine, one question engine and one differential engine. The
evaluation suite carries Arabic and English versions of the same case so a
regression in one language fails the build.

## The API is language aware

`Accept-Language` is negotiated per request, `Content-Language` and `Vary` are
set on the response, and every body carries `locale` and `direction`. Errors are
translated and carry a stable `error_key` so clients can branch without parsing
prose.

## Reports

`GET /api/v1/assessments/{id}/report?lang=ar` renders the full clinical
navigation summary in Arabic with real RTL, right-aligned tables and Arabic
typography; `lang=en` renders the English version with the same structure and
clinical terminology. The person's own browser prints it to PDF, which avoids
shipping an Arabic-capable font stack server side.

## Internal screens too

The evaluation metrics, the readiness gates, the safety rules, the agent
execution trace, the tool catalog and the provider registers all switch with the
same button. The internal surfaces are the ones people usually leave in English.

## What is never translated

Technical identifiers. Paths, field names, tool names, `assessment_id`,
`license_status`, `FHIR`, `PostgreSQL`, `OpenAPI`, `JWT`. Translating an
identifier turns an API into a mess; only human-readable text moves.

## Register

Arabic is written as clinical Arabic, not word-for-word translation. "اطلبي
تقييمًا طبيًا طارئًا فورًا" rather than "اذهبي إلى غرفة الطوارئ". English is
written as professional clinical English: "your symptoms may be compatible with
several explanations", never "you probably have".
