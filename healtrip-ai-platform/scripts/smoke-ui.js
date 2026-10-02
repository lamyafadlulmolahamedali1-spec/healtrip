#!/usr/bin/env node
/**
 * End-to-end smoke test over HTTP.
 *
 * Loads the real pages from the running service and walks a full assessment, so
 * a broken connection fails loudly here instead of quietly in front of a patient.
 *
 *   node scripts/smoke-ui.js
 */

const B = process.env.HEALTRIP_API || 'http://localhost:4000';
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const TECHNICAL_WORDS = [
  'api', 'openapi', 'postgres', 'fhir', 'tool calling', 'information gain', 'differential',
  'endpoint', 'orchestrator', 'readiness gate', 'provider database', 'clinical engine', 'json',
];

(async () => {
  const pages = ['/index.html', '/about.html', '/how-it-works.html', '/assessment.html', '/chat.html',
    '/patient.html', '/network.html', '/hospitals.html', '/technical.html'];
  for (const p of pages) {
    const r = await fetch(B + p);
    check(`page ${p} loads`, r.ok, `status ${r.status}`);
  }

  const landing = await (await fetch(`${B}/index.html`)).text();
  const body = landing.toLowerCase();
  const leaks = TECHNICAL_WORDS.filter((w) => body.includes(w));
  check('landing page has no engineering vocabulary', leaks.length === 0, leaks.join(', '));
  check('no API tab in the navigation', !/<nav class="nav">[\s\S]*?>API</.test(landing));

  // the failure a person actually hit: saying hello and being interrogated
  const greeting = await (await fetch(`${B}/api/v1/assessments`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hi' }),
  })).json();
  check('a greeting is greeted, not questioned', greeting.type === 'clarify', greeting.type);
  check('the greeting offers examples to start from', (greeting.examples || []).length > 0);

  const greetingAr = await (await fetch(`${B}/api/v1/assessments`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'ar' }, body: JSON.stringify({ message: 'مرحبا' }),
  })).json();
  check('the Arabic greeting is answered in Arabic', greetingAr.type === 'clarify' && /أهلًا/.test(greetingAr.message));

  const assistantGreeting = await (await fetch(`${B}/api/v1/agent/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hi' }),
  })).json();
  check('the assistant greets back', assistantGreeting.type === 'conversation', assistantGreeting.type);

  const health = await (await fetch(`${B}/api/v1/health`)).json();
  check('service answers', health.status === 'ok', `storage ${health.storage}`);

  const start = await (await fetch(`${B}/api/v1/assessments`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'I have had a headache for three days, mostly in the morning' }),
  })).json();
  check('assessment opens', Boolean(start.assessment_id) && start.type === 'question', start.type);

  let turn = start;
  let asked = 0;
  while (turn.type === 'question' && asked < 10) {
    asked += 1;
    turn = await (await fetch(`${B}/api/v1/assessments/${start.assessment_id}/answers`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question_id: turn.question.id, value: turn.question.options[0].value }),
    })).json();
  }
  check('questions adapt and the assessment completes', turn.type === 'summary', `${asked} questions`);
  check('summary carries possible explanations', (turn.summary?.differential || []).length > 0);

  const evals = await (await fetch(`${B}/api/v1/assessments/${start.assessment_id}/evaluations`)).json();
  check('evaluation guidance is returned', evals.status === 'ok' || evals.status === 'no_supported_evaluation', evals.status);
  check('no cost is ever estimated', (evals.evaluations || []).every((e) => e.cost_estimate === null));

  const doctors = await (await fetch(`${B}/api/v1/doctors?specialty=${encodeURIComponent(turn.summary.specialty)}`)).json();
  check('care options load', typeof doctors.count === 'number', `${doctors.count} found`);

  const ar = await (await fetch(`${B}/api/v1/assessments`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'ar' },
    body: JSON.stringify({ message: 'عندي ألم في البطن منذ يومين' }),
  })).json();
  check('Arabic works end to end', ar.locale === 'ar' && ar.direction === 'rtl' && Boolean(ar.question));

  const emergency = await (await fetch(`${B}/api/v1/assessments`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'My chest feels heavy and I am sweating heavily' }),
  })).json();
  check('safety still interrupts everything', emergency.type === 'emergency');

  const passed = results.filter(Boolean).length;
  console.log(`\nUI smoke: ${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
})();
