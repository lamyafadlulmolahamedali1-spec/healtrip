'use strict';

/**
 * Provider importer.
 *
 * Takes a file exported from a licensing authority under a data agreement and
 * turns it into HealTrip provider records. A record is only written with
 * license_status "verified" when the authority, the licence number, the source
 * URL and the verification timestamp are all present. Anything short of that is
 * written as "unverified" and the interface shows its provenance instead of a
 * badge. There is no code path that verifies a provider from anything else.
 *
 *   node src/providers/importer.js --file gmc-export.json --authority GMC --dry-run
 *   node src/providers/importer.js --file scfhs-export.csv --authority SCFHS
 *
 * Accepted input: JSON array, or CSV with a header row. Column names are mapped
 * below; anything unmapped is ignored rather than guessed at.
 */

const fs = require('fs');
const path = require('path');

const AUTHORITIES = {
  GMC: { name: 'General Medical Council', country: 'United Kingdom', register: 'https://www.gmc-uk.org/registration-and-licensing/our-registers' },
  SCFHS: { name: 'Saudi Commission for Health Specialties', country: 'Saudi Arabia', register: 'https://scfhs.org.sa/en' },
  DHA: { name: 'Dubai Health Authority', country: 'United Arab Emirates', register: 'https://www.dha.gov.ae/' },
  DOH: { name: 'Department of Health Abu Dhabi', country: 'United Arab Emirates', register: 'https://www.doh.gov.ae/' },
  SMC: { name: 'Sudan Medical Council', country: 'Sudan', register: null },
};

const FIELD_MAP = {
  reference_number: 'license_number',
  registration_number: 'license_number',
  licence_number: 'license_number',
  license_number: 'license_number',
  name: 'full_name',
  full_name: 'full_name',
  given_name: 'given_name',
  family_name: 'family_name',
  specialty: 'specialty',
  speciality: 'specialty',
  sub_specialty: 'subspecialty',
  subspecialty: 'subspecialty',
  qualifications: 'qualifications',
  registration_status: 'license_status_raw',
  status: 'license_status_raw',
  city: 'city',
  country: 'country',
  organisation: 'organization',
  organization: 'organization',
  languages: 'languages',
  profile_url: 'registry_profile_url',
  email: 'contact_email',
};

const ACTIVE = new Set(['registered with licence to practise', 'active', 'registered', 'valid', 'licensed']);

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  return lines.filter(Boolean).map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] || '').trim()]));
  });
}

function normalise(row, authorityCode) {
  const authority = AUTHORITIES[authorityCode];
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const field = FIELD_MAP[String(key).trim().toLowerCase()];
    if (field) out[field] = value;
  }
  if (!out.full_name && (out.given_name || out.family_name)) {
    out.full_name = `${out.given_name || ''} ${out.family_name || ''}`.trim();
  }
  if (typeof out.languages === 'string') {
    out.languages = out.languages.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
  }

  const statusRaw = String(out.license_status_raw || '').toLowerCase();
  const active = ACTIVE.has(statusRaw) || statusRaw.includes('licence to practise');
  const verifiable = Boolean(out.license_number && out.full_name && authority && active);

  return {
    id: `${authorityCode.toLowerCase()}-${out.license_number || Math.random().toString(36).slice(2, 10)}`,
    full_name: out.full_name || null,
    specialty: out.specialty || null,
    subspecialty: out.subspecialty || null,
    qualifications: out.qualifications || null,
    licensing_authority: verifiable ? authorityCode : null,
    license_number: out.license_number || null,
    license_status: verifiable ? 'verified' : 'unverified',
    country: out.country || authority?.country || null,
    city: out.city || null,
    languages: Array.isArray(out.languages) ? out.languages : [],
    telemedicine: false,
    organization: out.organization || null,
    // Contact details are only carried when the export itself supplies them and
    // the agreement allows publication. Nothing is inferred or looked up.
    contact_email: out.contact_email || null,
    contact_source: out.contact_email ? `${authorityCode} export` : null,
    registry_profile_url: out.registry_profile_url || authority?.register || null,
    source: verifiable ? `${authorityCode} register` : `${authorityCode} export, incomplete record`,
    source_url: authority?.register || null,
    verified_at: verifiable ? new Date().toISOString() : null,
    certificates: [],
    consultation_modes: [],
    years_experience: null,
  };
}

function validate(record) {
  const problems = [];
  if (!record.full_name) problems.push('no name');
  if (!record.specialty) problems.push('no specialty');
  if (record.license_status === 'verified') {
    if (!record.licensing_authority) problems.push('verified without an authority');
    if (!record.license_number) problems.push('verified without a licence number');
    if (!record.source_url) problems.push('verified without a source URL');
    if (!record.verified_at) problems.push('verified without a timestamp');
  }
  return problems;
}

async function run(argv) {
  const args = Object.fromEntries(
    argv.filter((a) => a.startsWith('--')).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    })
  );
  const fileIndex = argv.indexOf('--file');
  const file = args.file === true ? argv[fileIndex + 1] : args.file;
  const authIndex = argv.indexOf('--authority');
  const authority = (args.authority === true ? argv[authIndex + 1] : args.authority || 'GMC').toUpperCase();
  const dryRun = Boolean(args['dry-run']);

  if (!file || !AUTHORITIES[authority]) {
    console.error(`Usage: node src/providers/importer.js --file <export.json|csv> --authority <${Object.keys(AUTHORITIES).join('|')}> [--dry-run]`);
    process.exitCode = 2;
    return;
  }

  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const rows = file.endsWith('.csv') ? parseCsv(raw) : JSON.parse(raw);
  const records = rows.map((r) => normalise(r, authority));

  const rejected = [];
  const accepted = [];
  for (const rec of records) {
    const problems = validate(rec);
    if (problems.length) rejected.push({ id: rec.id, problems });
    else accepted.push(rec);
  }

  const verified = accepted.filter((r) => r.license_status === 'verified').length;
  console.log(`\n${authority} import: ${rows.length} rows in, ${accepted.length} accepted, ${rejected.length} rejected`);
  console.log(`  verified:   ${verified}`);
  console.log(`  unverified: ${accepted.length - verified} (shown with provenance, never with a badge)`);
  if (rejected.length) console.log('  rejected:', JSON.stringify(rejected.slice(0, 5)));

  if (dryRun || !process.env.DATABASE_URL) {
    console.log(dryRun ? '\nDry run, nothing written.' : '\nDATABASE_URL is not set, nothing written. Re-run with a database to persist.');
    return { accepted, rejected };
  }

  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  for (const r of accepted) {
    await pool.query(
      `insert into doctors (id, full_name, specialty, subspecialty, qualifications, licensing_authority, license_number,
        license_status, country, city, languages, telemedicine, organization, source, source_url, verified_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       on conflict (id) do update set license_status = excluded.license_status, verified_at = excluded.verified_at,
        specialty = excluded.specialty, organization = excluded.organization`,
      [r.id, r.full_name, r.specialty, r.subspecialty, r.qualifications, r.licensing_authority, r.license_number,
       r.license_status, r.country, r.city, r.languages, r.telemedicine, r.organization, r.source, r.source_url, r.verified_at]
    );
  }
  await pool.end();
  console.log(`\nWrote ${accepted.length} records.`);
  return { accepted, rejected };
}

if (require.main === module) run(process.argv.slice(2));

module.exports = { normalise, validate, parseCsv, AUTHORITIES, run };
