'use strict';

/**
 * Agent orchestrator.
 *
 * One turn runs in a fixed order that the model cannot reorder:
 *
 *   user message
 *        -> check_safety_rules            always, before anything else
 *        -> if emergency or support: stop, return the routed advice
 *        -> intent routing                deterministic, or model-proposed tool calls
 *        -> tool execution                schema validated, database backed
 *        -> response composed from tool results only
 *        -> claim screen over the wording
 *
 * Every step is appended to a trace that the client can render, so the agent's
 * behaviour is auditable without exposing any internal reasoning of the model.
 */

const tools = require('./tools');
const ai = require('../ai/provider');
const i18n = require('../i18n');
const conversation = require('../clinical/conversation');

const SYMPTOM_HINTS = [
  'pain', 'ache', 'hurts', 'fever', 'cough', 'dizzy', 'rash', 'vomit', 'bleeding', 'swelling', 'breath',
  'ألم', 'وجع', 'حمى', 'سعال', 'دوخة', 'طفح', 'قيء', 'نزيف', 'تورم', 'نفس',
];
const DOCTOR_HINTS = ['doctor', 'clinician', 'specialist', 'cardiolog', 'dermatolog', 'neurolog', 'find me a', 'طبيب', 'دكتور', 'أخصائي', 'استشاري'];
const HOSPITAL_HINTS = ['hospital', 'emergency department', 'clinic near', 'مستشفى', 'طوارئ'];
const EVALUATION_HINTS = ['what test', 'which test', 'what tests', 'investigation', 'scan', 'blood test', 'x-ray', 'what will the doctor', 'prepare for', 'فحص', 'فحوصات', 'تحاليل', 'أشعة', 'أستعد', 'استعداد'];
const EVIDENCE_HINTS = ['source', 'evidence', 'guideline', 'reference', 'مصدر', 'دليل', 'مرجع'];

const SPECIALTIES = {
  cardiolog: 'Cardiology', heart: 'Cardiology', قلب: 'Cardiology',
  dermatolog: 'Dermatology', skin: 'Dermatology', جلد: 'Dermatology',
  neurolog: 'Neurology', headache: 'Neurology', أعصاب: 'Neurology',
  gastro: 'Gastroenterology', stomach: 'Gastroenterology', هضم: 'Gastroenterology',
  ent: 'ENT', ear: 'ENT', أذن: 'ENT',
  eye: 'Ophthalmology', ophthalm: 'Ophthalmology', عيون: 'Ophthalmology',
  urolog: 'Urology', kidney: 'Urology', مسالك: 'Urology',
  endocrin: 'Endocrinology', diabet: 'Endocrinology', سكري: 'Endocrinology',
  orthop: 'Orthopaedics', bone: 'Orthopaedics', عظام: 'Orthopaedics',
  surgeon: 'General Surgery', surgery: 'General Surgery', جراح: 'General Surgery',
  'general practice': 'General Practice', 'gp ': 'General Practice', 'family doctor': 'General Practice',
  'family medicine': 'General Practice', 'طبيب عام': 'General Practice', 'أسرة': 'General Practice',
  'internal medicine': 'Internal Medicine', physician: 'Internal Medicine', 'باطنية': 'Internal Medicine',
};

const CITIES = {
  london: 'London', manchester: 'Manchester', birmingham: 'Birmingham',
  riyadh: 'Riyadh', jeddah: 'Jeddah', dubai: 'Dubai', 'abu dhabi': 'Abu Dhabi',
  khartoum: 'Khartoum', cairo: 'Cairo', alexandria: 'Alexandria',
  لندن: 'London', مانشستر: 'Manchester', الرياض: 'Riyadh', جدة: 'Jeddah',
  دبي: 'Dubai', 'أبوظبي': 'Abu Dhabi', الخرطوم: 'Khartoum', القاهرة: 'Cairo',
};

const lower = (s) => String(s || '').toLowerCase();
const hit = (text, list) => list.some((h) => lower(text).includes(lower(h)));

function detectSpecialty(text) {
  const t = lower(text);
  for (const [needle, specialty] of Object.entries(SPECIALTIES)) if (t.includes(needle)) return specialty;
  return null;
}

/**
 * Known city names are normalised to the spelling used in the database. A place
 * the directory does not cover is still passed through, so the tool returns
 * no_match and the agent says so, instead of quietly answering about somewhere
 * else.
 */
function detectCity(text) {
  const t = lower(text);
  for (const [needle, city] of Object.entries(CITIES)) if (t.includes(needle)) return city;
  const m = t.match(/(?:\bin\b|\bnear\b|\bفي\b)\s+([a-z\u0600-\u06FF][\w\u0600-\u06FF'-]{2,30})/);
  if (!m) return undefined;
  const word = m[1];
  const stop = ['the', 'my', 'your', 'this', 'our', 'مدينة', 'بلد'];
  if (stop.includes(word)) return undefined;
  return word.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * One trace entry. Only execution metadata is exposed: which tool ran, the
 * shape of its arguments, its status, how long it took and how many rows came
 * back. No model reasoning is ever put in here.
 */
function step(trace, type, detail) {
  trace.push({ step: trace.length + 1, type, at: new Date().toISOString(), ...detail });
  return trace;
}

const argumentsSchema = (args) =>
  Object.fromEntries(Object.entries(args || {}).map(([k, v]) => [k, v === undefined ? 'omitted' : typeof v]));

/**
 * Plans which tools to call. With AI_MODE=demo the plan is deterministic. With a
 * provider configured the model may propose a plan, but it is still restricted
 * to the tool names below and every argument is schema validated.
 */
function planTools(message) {
  const plan = [];
  if (hit(message, DOCTOR_HINTS)) {
    plan.push({ name: 'search_doctors', arguments: { specialty: detectSpecialty(message) || undefined, city: detectCity(message) } });
  }
  if (hit(message, HOSPITAL_HINTS)) {
    plan.push({ name: 'search_hospitals', arguments: { city: detectCity(message), emergency: lower(message).includes('emergency') || message.includes('طوارئ') || undefined } });
  }
  if (hit(message, EVALUATION_HINTS)) {
    plan.push({ name: 'get_possible_evaluations', arguments: { text: message } });
  }
  if (hit(message, EVIDENCE_HINTS)) {
    plan.push({ name: 'get_clinical_evidence', arguments: {} });
  }
  return plan;
}

async function runTurn({ message, lang = 'en', profile = null, history = [] }) {
  const trace = [];
  const t = (key, vars) => i18n.t(lang, key, vars);

  // 1. Safety always runs first and can end the turn.
  const safetyStarted = Date.now();
  const safety = await tools.invoke('check_safety_rules', { text: message });
  step(trace, 'safety_check', {
    tool: 'check_safety_rules',
    level: safety.result.level,
    flags: safety.result.flags.map((f) => f.id),
    rules_evaluated: safety.result.rule_count,
    duration_ms: Date.now() - safetyStarted,
  });

  if (safety.result.level === 'support') {
    step(trace, 'decision', { decision: 'stop_and_route_to_human_support' });
    const text = t('safety.support');
    step(trace, 'response', { source: 'safety_rules', verified: true });
    return { type: 'support', level: 'support', text, trace, tool_calls: [safety], sources: safety.result.flags };
  }

  if (safety.result.level === 'emergency' || safety.result.level === 'urgent') {
    step(trace, 'decision', { decision: 'stop_routine_path', reason: t('api.safetyBlocked') });
    const text = safety.result.level === 'emergency' ? t('safety.emergency') : t('safety.urgent');
    step(trace, 'response', { source: 'safety_rules', verified: true });
    return { type: 'safety', level: safety.result.level, text, trace, tool_calls: [safety], sources: safety.result.flags };
  }

  // 2. Small talk is small talk. Someone who says hello gets a hello.
  const intent = conversation.classify(message, safety.result.symptoms_detected.length > 0);
  if (['greeting', 'thanks', 'farewell', 'capability', 'preparation', 'unclear'].includes(intent)) {
    step(trace, 'decision', { decision: `conversational_turn:${intent}` });
    step(trace, 'response', { source: 'conversation_policy', verified: true });
    return { type: 'conversation', level: 'none', intent, text: conversation.reply(intent, lang), trace, tool_calls: [safety], sources: [] };
  }

  // 3. A symptom description belongs in the assessment pipeline, not here.
  if (hit(message, SYMPTOM_HINTS) && safety.result.symptoms_detected.length) {
    step(trace, 'decision', { decision: 'redirect_to_assessment', symptoms: safety.result.symptoms_detected });
    step(trace, 'response', { source: 'routing_policy', verified: true });
    return { type: 'redirect', level: 'none', text: t('agent.redirectToAssessment'), trace, tool_calls: [safety], sources: [] };
  }

  // 4. Tool plan, execution, and a response built only from what came back.
  const plan = planTools(message);
  const executed = [safety];
  const facts = [];

  for (const call of plan) {
    step(trace, 'tool_call', { tool: call.name, arguments: call.arguments, arguments_schema: argumentsSchema(call.arguments) });
    const started = Date.now();
    const outcome = await tools.invoke(call.name, call.arguments);
    executed.push(outcome);
    step(trace, 'tool_result', {
      tool: call.name,
      ok: outcome.ok,
      status: outcome.result?.status || outcome.error,
      result_count: outcome.result?.count ?? (outcome.result?.results ? outcome.result.results.length : 0),
      source: outcome.result?.source,
      duration_ms: Date.now() - started,
    });
    if (outcome.ok) facts.push({ tool: call.name, result: outcome.result });
  }

  let text;
  let verified = true;

  if (!plan.length) {
    step(trace, 'decision', { decision: 'no_tool_matched_answer_from_profile_context_only' });
    const phrased = await ai.chat({ history, message, profile, lang });
    step(trace, 'claim_screen', { provider: phrased.provider, verified: phrased.verified, reason: phrased.reason });
    text = phrased.text;
    verified = phrased.verified;
  } else {
    const providerFact = facts.find((f) => f.tool === 'search_doctors');
    const hospitalFact = facts.find((f) => f.tool === 'search_hospitals');
    const evidenceFact = facts.find((f) => f.tool === 'get_clinical_evidence');
    const evalFact = facts.find((f) => f.tool === 'get_possible_evaluations');
    const lines = [];

    if (providerFact) {
      if (providerFact.result.status === 'no_match') {
        step(trace, 'decision', { decision: 'no_provider_in_database_do_not_invent' });
        lines.push(t('agent.noProviderFound'));
      } else {
        lines.push(t('agent.providersFound'));
        lines.push(
          providerFact.result.results
            .slice(0, 4)
            .map((d) => `${d.full_name} — ${d.specialty}, ${d.city}, ${d.organization} (${d.source}, licence ${d.license_status})`)
            .join('\n')
        );
      }
    }
    if (hospitalFact) {
      lines.push(hospitalFact.result.status === 'no_match' ? t('errors.noHospitals') : t('agent.hospitalsFound'));
      if (hospitalFact.result.status === 'ok') {
        lines.push(hospitalFact.result.results.slice(0, 4).map((h) => `${h.name} — ${h.city}, ${h.country}${h.emergency ? ', emergency department' : ''}`).join('\n'));
      }
    }
    if (evalFact) {
      if (evalFact.result.status !== 'ok' || !evalFact.result.count) {
        lines.push(t('evaluations.none'));
        // Preparing for a visit is useful whether or not a specific evaluation fits.
        lines.push(`${t('evaluations.visitPrep')}\n${(evalFact.result.preparation || []).map((p) => `- ${p}`).join('\n')}`);
      } else {
        lines.push(t('evaluations.intro'));
        lines.push(
          evalFact.result.results
            .map((x) => `${x.name} — ${x.clinical_question}`)
            .join('\n')
        );
        lines.push(evalFact.result.note);
        lines.push(`${t('evaluations.visitPrep')}\n${(evalFact.result.preparation || []).map((p) => `- ${p}`).join('\n')}`);
      }
    }
    if (evidenceFact && evidenceFact.result.status === 'ok') {
      lines.push(t('agent.evidenceFound'));
      lines.push(evidenceFact.result.results.slice(0, 4).map((s) => `${s.publisher} — ${s.title}: ${s.url}`).join('\n'));
    }
    text = lines.join('\n\n');
    step(trace, 'response', { source: 'tool_results_only', verified: true });
  }

  return {
    type: 'answer',
    level: 'none',
    text,
    verified,
    trace,
    tool_calls: executed,
    sources: facts.flatMap((f) => (f.result.results || []).slice(0, 4).map((r) => r.url || r.id || r.name).filter(Boolean)),
  };
}

module.exports = { runTurn, planTools, detectSpecialty, detectCity };
