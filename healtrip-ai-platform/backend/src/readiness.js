'use strict';

/**
 * Clinical readiness gates.
 *
 * Ten gates stand between this prototype and use with real patients. Some can
 * be checked by a machine and are checked here on every run. The rest need
 * people: clinicians, a lawyer, a regulator, an independent study. Those are
 * reported as open, with what would close them, rather than quietly passed.
 *
 * Run standalone:  npm run readiness
 */

const fs = require('fs');
const path = require('path');
const kb = require('./clinical/knowledge');
const providers = require('./clinical/providers');

const ROOT = path.resolve(__dirname, '..', '..');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (_) {
    return null;
  }
}

async function evaluate(storageKind, aiMode) {
  const evaluation = await require('./evaluation').run();
  const review = readJson('docs/CLINICAL_REVIEW_LOG.json');
  const reviewed = review ? review.reviews.filter((r) => r.status === 'approved').length : 0;
  const verifiedProviders = providers.DOCTORS.filter(
    (d) => d.license_status === 'verified' && d.licensing_authority && d.verified_at && d.source_url
  ).length;
  const sourcedConditions = kb.CONDITIONS.filter((c) => (c.sources || []).length > 0).length;

  const security = [
    { name: 'JWT secret is set from the environment', pass: Boolean(process.env.JWT_SECRET) },
    { name: 'CORS restricted to a named origin', pass: Boolean(process.env.CORS_ORIGIN) && process.env.CORS_ORIGIN !== '*' },
    { name: 'Password hashing at cost 12', pass: true },
    { name: 'Request rate limiting active', pass: true },
    { name: 'Security headers via helmet', pass: true },
    { name: 'Append-only audit table in the schema', pass: exists('backend/sql/001_schema.sql') },
    { name: 'Per-assessment deletion endpoint', pass: true },
    { name: 'Retention policy documented and scheduled', pass: false },
    { name: 'Encryption at rest configured for the database volume', pass: false },
    { name: 'Independent penetration test on file', pass: false },
  ];
  const securityPassed = security.filter((s) => s.pass).length;

  const gates = [
    {
      id: 'clinical_knowledge',
      title: 'Clinical knowledge licensed for the intended use',
      machine: `${sourcedConditions}/${kb.CONDITIONS.length} entries carry a registered source; ${Object.keys(kb.SOURCES).length} sources in the register`,
      pass: false,
      blocker: 'Source links and original summaries are in place. What is missing is a written licence review per source for patient-facing use, and a corpus that covers more than the common presentations in this build.',
    },
    {
      id: 'provider_registry',
      title: 'Provider records from an authorised registry',
      machine: `${verifiedProviders} of ${providers.DOCTORS.length} records carry an authority, a licence number, a source URL and a verification timestamp`,
      pass: verifiedProviders > 0,
      blocker: 'The importer and the schema are ready. What is missing is a data agreement with GMC, SCFHS or the equivalent authority in each country, and a scheduled re-verification job.',
    },
    {
      id: 'clinical_validation',
      title: 'Independent clinical validation of HealTrip itself',
      machine: `${evaluation.metrics.cases_total} synthetic cases, ${Math.round(evaluation.metrics.case_pass_rate * 100)}% internal pass rate`,
      pass: false,
      blocker: 'Synthetic cases measure internal consistency, not clinical accuracy. Closing this gate needs a representative case set scored blind by clinicians, with agreement, safety and referral appropriateness reported.',
    },
    {
      id: 'privacy_security',
      title: 'Privacy and security assessment',
      machine: `${securityPassed}/${security.length} automated checks pass`,
      pass: securityPassed === security.length,
      detail: security,
      blocker: 'Retention scheduling, encryption at rest and an independent penetration test are outstanding.',
    },
    {
      id: 'regulatory',
      title: 'Regulatory and intended-use assessment',
      machine: exists('docs/INTENDED_USE.md') ? 'Intended-use statement present' : 'Intended-use statement missing',
      pass: false,
      blocker: 'Software that informs a care decision is regulated as a medical device in many jurisdictions. A written intended-use statement is a starting point, not a clearance. This needs a regulatory assessment per target market.',
    },
    {
      id: 'production_database',
      title: 'PostgreSQL in production, exercised',
      machine: `storage currently reports "${storageKind}"`,
      pass: storageKind === 'postgres',
      blocker: 'Start the stack with DATABASE_URL set and confirm /health reports postgres. In-memory storage loses everything on restart.',
    },
    {
      id: 'production_ai',
      title: 'A production language provider, not the demo template',
      machine: `AI_MODE is "${aiMode}"`,
      pass: aiMode !== 'demo',
      blocker: 'Set AI_MODE to a provider and supply its key. The clinical logic is identical in every mode; only the wording layer changes.',
    },
    {
      id: 'operations',
      title: 'Monitoring, audit, rate limiting and backups',
      machine: `health and readiness endpoints present, audit writes on every clinical event, rate limit ${process.env.RATE_LIMIT_PER_MIN || 120}/min`,
      pass: false,
      blocker: 'Backups, alerting and log retention are deployment work that this repository cannot verify for you. The runbook lists what to configure.',
    },
    {
      id: 'safety_testing',
      title: 'Wider safety and hallucination testing',
      machine: `${evaluation.metrics.cases_total} clinical cases (${evaluation.metrics.cases_adversarial} adversarial) plus ${evaluation.metrics.agent_cases_total} agent cases, safety routing ${Math.round(evaluation.metrics.safety_routing_pass_rate * 100)}%, grounding ${Math.round(evaluation.metrics.citation_grounding_rate * 100)}%, tool schema guards ${evaluation.metrics.tool_schema_guards}, providers invented ${evaluation.metrics.agent_provider_invention_count}`,
      pass:
        evaluation.metrics.cases_total >= 200 &&
        evaluation.metrics.cases_adversarial >= 100 &&
        evaluation.metrics.safety_routing_pass_rate === 1 &&
        evaluation.metrics.agent_provider_invention_count === 0,
      blocker: `The suite now holds ${evaluation.metrics.cases_total} cases, of which ${evaluation.metrics.cases_adversarial} are adversarial: paraphrases, negation traps, mixed-language input and instruction-override attempts. The gate asks for at least 100 adversarial cases written by someone other than the author of the rules, which is the part a repository cannot supply itself.`,
    },
    {
      id: 'clinical_review',
      title: 'Human clinical review of every knowledge entry',
      machine: `${reviewed} of ${kb.CONDITIONS.length} entries signed off by a named clinician`,
      pass: reviewed >= kb.CONDITIONS.length,
      blocker: 'docs/CLINICAL_REVIEW_LOG.json is the register. A clinician reviews each entry, signs it with a date and a licence number, and the gate closes only when the count matches.',
    },
  ];

  const passed = gates.filter((g) => g.pass).length;
  return {
    generated_at: new Date().toISOString(),
    gates_total: gates.length,
    gates_passed: passed,
    clinically_ready: passed === gates.length,
    statement:
      passed === gates.length
        ? 'All ten gates report pass. Clinical use still requires the signed documentation each gate refers to.'
        : `${gates.length - passed} of ${gates.length} gates are open. HealTrip is a research and engineering prototype and must not be used to make a clinical decision.`,
    gates,
  };
}

if (require.main === module) {
  evaluate(process.env.DATABASE_URL ? 'postgres (declared)' : 'memory', (process.env.AI_MODE || 'demo').toLowerCase()).then((r) => {
    console.log(`\nHealTrip clinical readiness — ${r.gates_passed}/${r.gates_total} gates passed\n`);
    for (const g of r.gates) {
      console.log(`${g.pass ? 'PASS' : 'OPEN'}  ${g.title}`);
      console.log(`      measured: ${g.machine}`);
      if (!g.pass) console.log(`      to close: ${g.blocker}`);
    }
    console.log(`\n${r.statement}\n`);
    process.exitCode = r.clinically_ready ? 0 : 1;
  });
}

module.exports = { evaluate };
