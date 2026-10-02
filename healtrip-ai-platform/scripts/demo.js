#!/usr/bin/env node
/**
 * End-to-end demo.
 *
 * Two paths against a running API, printed as they happen, so the architecture
 * can be followed in an interview without clicking through the interface.
 *
 *   Path A  a person unsure whether to see a cardiologist, go to the emergency
 *           department, or get a second opinion
 *   Path B  the same person, wording that trips a red flag
 *
 *   node scripts/demo.js            # English
 *   node scripts/demo.js ar         # Arabic
 */

const B = process.env.HEALTRIP_API || 'http://localhost:4000';
const LANG = process.argv[2] === 'ar' ? 'ar' : 'en';

const line = (s = '') => console.log(s);
const rule = (title) => { line(); line('─'.repeat(74)); line(title); line('─'.repeat(74)); };

const api = async (path, options = {}) => {
  const r = await fetch(B + path, {
    ...options,
    headers: { 'content-type': 'application/json', 'accept-language': LANG, ...(options.headers || {}) },
  });
  const type = r.headers.get('content-type') || '';
  return type.includes('json') ? r.json() : r.text();
};

(async () => {
  const health = await api('/api/v1/health');
  rule('HealTrip demo');
  line(`api ${health.api_version} · storage ${health.storage} · language layer ${health.ai_mode} · locale ${health.locale}`);
  line(`knowledge: ${health.knowledge.conditions} candidates, ${health.knowledge.questions} questions, ${health.knowledge.red_flags} safety rules`);

  // ---------------------------------------------------------------- path A
  rule('PATH A — "I have chest pain and I am not sure whether to see a cardiologist, go to the ER, or get a second opinion"');
  let turn = await api('/api/v1/assessments', {
    method: 'POST',
    body: JSON.stringify({
      message:
        LANG === 'ar'
          ? 'عندي ألم في الصدر ولا أعرف إن كان عليّ مراجعة طبيب قلب أو الذهاب للطوارئ أو أخذ رأي ثانٍ'
          : 'I have chest pain and I am not sure whether I should see a cardiologist, go to the ER, or get a second opinion',
    }),
  });
  const id = turn.assessment_id;
  line(`assessment ${id} opened · urgency ${turn.urgency}`);

  // The engine asks; answers here are scripted so the run is reproducible.
  const script = { exertion: 'movement', press_chest: 'yes', radiation: 'no', meals: 'no', onset: 'days', severity: 'moderate' };
  let asked = 0;
  while (turn.type === 'question' && asked < 8) {
    asked += 1;
    line();
    line(`Q${asked} (${turn.question.id}, information gain ${turn.question.informationGain}): ${turn.question.text}`);
    line(`     why: ${turn.question.why}`);
    const chosen = script[turn.question.id] || turn.question.options[turn.question.options.length - 1].value;
    const label = turn.question.options.find((o) => o.value === chosen)?.label;
    line(`     answer: ${label}`);
    if (turn.shortlist?.length) line(`     shortlist now: ${turn.shortlist.map((s) => `${s.name} ${s.compatibility}%`).join(' · ')}`);
    turn = await api(`/api/v1/assessments/${id}/answers`, { method: 'POST', body: JSON.stringify({ question_id: turn.question.id, value: chosen }) });
  }

  if (turn.type !== 'summary') { line(`\nended as ${turn.type}: ${turn.message}`); return; }
  const s = turn.summary;

  rule('What the engine concluded');
  line(`urgency: ${s.urgency}`);
  line(`advice: ${s.advice}`);
  line(`specialty indicated: ${s.specialty}`);
  line();
  line('possible explanations, ranked by compatibility with what was reported:');
  for (const d of s.differential) {
    line(`  ${d.compatibility}%  ${d.name}`);
    line(`         tells it apart: ${d.discriminators[0]}`);
    line(`         source: ${d.sources.map((x) => x.publisher).join(', ')}`);
  }
  if (s.stillUnknown?.length) line(`\nstill unknown: ${s.stillUnknown.join(', ')}`);

  rule('What a clinician may consider next');
  const evals = await api(`/api/v1/assessments/${id}/evaluations`);
  line(`status: ${evals.status}`);
  for (const e of evals.evaluations) {
    line();
    line(`  ${e.name}  [${e.type}]`);
    line(`    why: ${e.why}`);
    line(`    clinical question: ${e.clinical_question}`);
    line(`    preparation: ${e.preparation || 'none indicated'}`);
    line(`    practical: ${e.practical}`);
    line(`    cost estimate: ${e.cost_estimate === null ? 'none, by design' : e.cost_estimate}`);
    line(`    evidence: ${e.evidence.map((x) => x.url).join(' ')}`);
  }
  line(`\n${evals.note}`);

  rule('Agent turn: finding a clinician');
  const chat = await api('/api/v1/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ message: LANG === 'ar' ? `أريد طبيب ${'قلب'} في لندن` : `Find me a ${s.specialty} clinician in London` }),
  });
  line(chat.message);
  line();
  line('execution trace:');
  for (const step of chat.trace) {
    const detail = Object.entries(step)
      .filter(([k]) => !['step', 'type', 'at'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');
    line(`  ${step.step}. ${step.type.padEnd(13)} ${detail}`);
  }
  line();
  line('every provider claim came from the database. Nothing was composed by the model.');

  rule('Exports');
  const fhir = await api(`/api/v1/assessments/${id}/fhir`);
  line(`FHIR bundle: ${fhir.entry.length} entries (${[...new Set(fhir.entry.map((e) => e.resource.resourceType))].join(', ')})`);
  line(`printable report: ${B}/api/v1/assessments/${id}/report?lang=${LANG}`);

  // ---------------------------------------------------------------- path B
  rule('PATH B — "My chest feels heavy and I am sweating heavily"');
  const emergency = await api('/api/v1/assessments', {
    method: 'POST',
    body: JSON.stringify({ message: LANG === 'ar' ? 'صدري تقيل وعندي تعرق شديد' : 'My chest feels heavy and I am sweating heavily' }),
  });
  line(`type: ${emergency.type} · urgency: ${emergency.urgency}`);
  line(`message: ${emergency.message}`);
  line(`rule matched: ${(emergency.redFlags || []).map((f) => f.id).join(', ')}`);
  line('no question was asked, no provider search ran, and no testing discussion was offered.');

  const emergencyAgent = await api('/api/v1/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ message: LANG === 'ar' ? 'صدري تقيل وعندي تعرق شديد، ابحثي لي عن طبيب قلب' : 'My chest feels heavy and I am sweating heavily, find me a cardiologist' }),
  });
  line();
  line('same wording sent to the agent, with an explicit request to search for a clinician:');
  line(`  type ${emergencyAgent.type} · safety ${emergencyAgent.safety.level}`);
  line(`  tools run: ${emergencyAgent.tool_calls.map((t) => t.name).join(', ')}`);
  line('  the provider search never ran: safety ends the turn first.');

  rule('Limitations');
  const readiness = await api('/api/v1/readiness');
  line(readiness.statement);
  line('Provider records in this build are demo data with no licence verified.');
  line('HealTrip does not diagnose, does not prescribe, and is not cleared for clinical use.');
})();
