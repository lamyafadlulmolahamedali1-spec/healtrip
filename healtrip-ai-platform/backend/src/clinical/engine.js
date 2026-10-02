'use strict';

const { SYMPTOMS, RED_FLAGS, CONDITIONS, CONDITION_BY_ID, QUESTIONS, SOURCES } = require('./knowledge');
const ev = require('./evaluations');

const normalise = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Negation scope.
 *
 * "no chest pain and no sweating, only a sore throat" must not match the chest
 * rule. Everything from a negator up to the next clause boundary is removed
 * before matching. This is deliberately shallow: it handles the common written
 * forms and nothing cleverer, and the limitation is stated in SAFETY_AND_LIMITS.
 */
const NEGATORS = ['no ', 'not ', 'never ', 'without ', 'denies ', 'denied ', 'free of ',
  'لا ', 'ليس ', 'بدون ', 'ما عندي ', 'ما في ', 'من غير '];
const BOUNDARIES = [',', '.', ';', ' but ', ' only ', ' just ', ' however ', ' لكن ', ' فقط ', ' إنما '];

/**
 * Some danger phrases are negations themselves: "cannot control my bladder",
 * "the inhaler is not working". These are protected before the stripper runs,
 * otherwise the negation handling would delete the very words that matter.
 */
const PROTECTED = ['cannot control', 'can not control', 'cannot finish', 'cannot speak',
  'cannot stay awake', 'cannot keep', 'cannot stop', 'cannot go on', 'not working',
  'no longer help', 'no longer working', 'not helping', 'never had this before',
  // both the written and the normalised Arabic forms, since normalisation runs first
  'لا أتحكم', 'لا اتحكم', 'لا أستطيع', 'لا استطيع', 'لا يستجيب', 'لا يتوقف',
  'ما بينفع', 'ما عاد أقدر', 'ما عاد اقدر'];

function stripNegated(text) {
  let out = ` ${text} `;
  PROTECTED.forEach((phrase, i) => {
    out = out.split(phrase).join(`\u0001${i}\u0001`);
  });
  for (const neg of NEGATORS) {
    let index = out.indexOf(neg);
    while (index !== -1) {
      const rest = out.slice(index + neg.length);
      const cut = BOUNDARIES.map((b) => rest.indexOf(b)).filter((i) => i !== -1);
      const end = cut.length ? Math.min(...cut) : rest.length;
      out = `${out.slice(0, index)} ${rest.slice(end)}`;
      index = out.indexOf(neg, index);
    }
  }
  PROTECTED.forEach((phrase, i) => {
    out = out.split(`\u0001${i}\u0001`).join(phrase);
  });
  return out;
}

function emptyState() {
  return {
    symptoms: [],
    onset: null,
    duration: null,
    severity: null,
    location: null,
    associatedSymptoms: [],
    medications: [],
    allergies: [],
    medicalHistory: [],
    riskFactors: [],
    redFlags: [],
    unknowns: [],
    answers: [],
    narrative: [],
    careContext: {},
    urgencyScore: 0,
  };
}

/** Free-text symptom extraction, deterministic and inspectable. */
function extractSymptoms(text) {
  const t = stripNegated(normalise(text));
  const found = [];
  for (const [id, s] of Object.entries(SYMPTOMS)) {
    if (s.match.some((m) => t.includes(normalise(m)))) found.push(id);
  }
  return found;
}

/** Safety gate. Runs before any reasoning, on every turn. */
function screenRedFlags(text, state) {
  const t = stripNegated(normalise(text));
  const hits = [];
  for (const rule of RED_FLAGS) {
    // 1. literal phrases as written in the rule
    const textHit = (rule.match || []).some((m) => t.includes(normalise(m)));
    // 2. symptom combinations already extracted into the patient state
    const comboHit = (rule.combos || []).some((combo) => combo.every((s) => state.symptoms.includes(s)));
    // 3. concept groups: every group must contribute a term, in any wording or
    //    order, so a paraphrase the literal phrases miss still fires the rule
    const conceptHit =
      Array.isArray(rule.concepts) &&
      rule.concepts.length > 0 &&
      rule.concepts.every((group) => group.some((term) => t.includes(normalise(term))));
    if (textHit || comboHit || conceptHit) hits.push(rule);
  }
  return hits;
}

function urgencyLabel(score, flags) {
  if (flags.some((f) => f.level === 'emergency')) return 'emergency';
  if (score >= 5 || flags.some((f) => f.level === 'urgent')) return 'urgent';
  if (score >= 2) return 'soon';
  return 'routine';
}

/**
 * Candidate scoring. Produces supporting / contradicting / missing counts.
 * Scores are compatibility with reported information, never probability.
 */
function scoreCandidates(state) {
  const answeredEffects = {};
  for (const a of state.answers) {
    for (const [cid, delta] of Object.entries(a.effects || {})) {
      answeredEffects[cid] = (answeredEffects[cid] || 0) + delta;
    }
  }

  const out = [];
  for (const c of CONDITIONS) {
    let symptomSupport = 0;
    let contradict = 0;
    const matched = [];
    for (const s of state.symptoms) {
      if (c.supports && c.supports[s]) {
        symptomSupport += c.supports[s];
        matched.push(s);
      }
      if (c.opposes && c.opposes[s]) contradict += c.opposes[s];
    }
    // A candidate is only considered when the person actually reported a
    // feature it explains. Answers to follow-up questions re-rank candidates;
    // they never introduce one out of nothing.
    if (symptomSupport <= 0) continue;

    let support = symptomSupport;
    const fromAnswers = answeredEffects[c.id] || 0;
    if (fromAnswers > 0) support += fromAnswers;
    else contradict += Math.abs(fromAnswers);

    const expected = Object.keys(c.supports || {});
    const missing = expected.filter((s) => !state.symptoms.includes(s));
    const raw = support - contradict;
    if (raw <= 0) continue;
    out.push({
      id: c.id,
      support,
      contradict,
      missing: missing.length,
      score: raw,
      specialty: c.specialty,
      urgency: c.urgency,
    });
  }
  out.sort((a, b) => b.score - a.score);
  const max = out.length ? out[0].score : 1;
  const MIN_COMPATIBILITY = 25;
  return out
    .map((c) => ({ ...c, compatibility: Math.round((c.score / max) * 100) }))
    .filter((c) => c.compatibility >= MIN_COMPATIBILITY)
    .slice(0, 4);
}

/**
 * Next-best-question engine.
 * Picks the unanswered applicable question whose options would move the current
 * candidate ranking the most (spread of effects across live candidates).
 */
function nextQuestion(state) {
  const asked = new Set(state.answers.map((a) => a.questionId));
  const live = new Set(scoreCandidates(state).map((c) => c.id));
  let best = null;
  let bestGain = -1;

  for (const q of QUESTIONS) {
    if (asked.has(q.id)) continue;
    if (q.when && !q.when.some((s) => state.symptoms.includes(s))) continue;

    let gain = 0;
    for (const opt of q.options) {
      for (const [cid, delta] of Object.entries(opt.effects || {})) {
        gain += Math.abs(delta) * (live.has(cid) ? 2 : 0.4);
      }
      if (opt.urgency) gain += opt.urgency * 0.8;
      if (opt.flag) gain += 3;
    }
    if (!q.when) gain *= 0.7; // general questions rank below discriminating ones
    if (gain > bestGain) {
      bestGain = gain;
      best = q;
    }
  }
  return best ? { question: best, gain: Number(bestGain.toFixed(2)) } : null;
}

function applyAnswer(state, questionId, value) {
  const q = QUESTIONS.find((x) => x.id === questionId);
  if (!q) return state;
  const opt = q.options.find((o) => o.v === value);
  if (!opt) return state;

  state.answers = state.answers.filter((a) => a.questionId !== questionId);
  state.answers.push({
    questionId,
    field: q.field,
    value,
    label_en: opt.en,
    label_ar: opt.ar,
    effects: opt.effects || {},
  });

  if (q.field && Object.prototype.hasOwnProperty.call(state, q.field)) state[q.field] = value;
  else state.careContext[q.field] = value;

  state.urgencyScore += opt.urgency || 0;
  state.unknowns = refreshUnknowns(state);
  if (opt.flag) {
    const rule = RED_FLAGS.find((r) => r.id === opt.flag);
    if (rule && !state.redFlags.some((f) => f.id === rule.id)) {
      state.redFlags.push({ id: rule.id, level: rule.level, en: rule.en, ar: rule.ar, source: rule.source });
    }
  }
  return state;
}

/** Which of the standing context questions are still unanswered. */
function refreshUnknowns(state) {
  return ['onset', 'severity', 'medications', 'history'].filter(
    (field) => !state.answers.some((a) => a.questionId === field || a.field === field)
  );
}

function ingestText(state, text) {
  const found = extractSymptoms(text);
  for (const s of found) if (!state.symptoms.includes(s)) state.symptoms.push(s);
  state.narrative.push(String(text).slice(0, 1000));
  const flags = screenRedFlags(text, state);
  for (const f of flags) {
    if (!state.redFlags.some((x) => x.id === f.id)) {
      state.redFlags.push({ id: f.id, level: f.level, en: f.en, ar: f.ar, source: f.source });
      state.urgencyScore += f.level === 'emergency' ? 6 : 3;
    }
  }
  state.unknowns = refreshUnknowns(state);
  return state;
}

/**
 * Evidence verification. Any claim in the final explanation must map to a
 * knowledge-base entry and a registered source, otherwise it is dropped.
 */
function buildDifferential(state, lang = 'en') {
  const scored = scoreCandidates(state);
  const verified = [];
  const rejected = [];

  for (const s of scored) {
    const c = CONDITION_BY_ID[s.id];
    if (!c) {
      rejected.push({ id: s.id, reason: 'no knowledge-base entry' });
      continue;
    }
    const sources = (c.sources || []).map((id) => SOURCES[id]).filter(Boolean);
    if (!sources.length) {
      rejected.push({ id: s.id, reason: 'no registered source' });
      continue;
    }
    verified.push({
      id: c.id,
      name: lang === 'ar' ? c.ar : c.en,
      explanation: lang === 'ar' ? c.plain_ar : c.plain_en,
      specialty: c.specialty,
      urgency: c.urgency,
      compatibility: s.compatibility,
      support: s.support,
      contradict: s.contradict,
      missing: s.missing,
      discriminators: lang === 'ar' ? c.discriminators_ar : c.discriminators_en,
      investigations: lang === 'ar' ? c.investigations_ar : c.investigations_en,
      sources,
    });
  }
  return { verified, rejected };
}

const LEVELS = ['routine', 'soon', 'urgent', 'emergency'];

/**
 * A high-acuity candidate raises the floor of the advice, but only a
 * deterministic red flag can reach the emergency level. This keeps
 * "call an ambulance" tied to explicit rules rather than to scoring.
 */
function candidateFloor(differential) {
  const top = (differential.verified || [])[0];
  if (!top) return 'routine';
  if (top.urgency === 'emergency') return 'urgent';
  if (top.urgency === 'urgent') return 'soon';
  return 'routine';
}


/**
 * Possible evaluations a clinician may consider.
 *
 * An entry reaches the person only when one of its associated candidates is in
 * the verified differential and it carries a registered source. Order is set by
 * safety relevance first, then by how well the linked candidates fit what was
 * reported, then by whether the evaluation separates more than one of them.
 * Nothing here is an order, and no cost is ever estimated.
 */
function possibleEvaluations(state, lang = 'en') {
  const ar = lang === 'ar';
  const pick = (obj) => (obj ? (ar ? obj.ar : obj.en) : null);

  // Safety overrides the whole section: an emergency is not a testing discussion.
  if (state.redFlags.some((f) => f.level === 'emergency' || f.level === 'support')) {
    return {
      status: 'safety_override',
      evaluations: [],
      note: ar
        ? 'توجد علامة تستدعي تقييمًا عاجلًا، لذلك لا يعرض HealTrip قائمة فحوصات هنا. الأولوية الآن هي الرعاية العاجلة.'
        : 'A feature that needs urgent assessment is present, so HealTrip does not show a testing discussion here. Urgent care comes first.',
      preparation: [],
      limitations: [],
    };
  }

  const differential = buildDifferential(state, lang).verified;
  const byId = Object.fromEntries(differential.map((d) => [d.id, d]));

  const scored = [];
  for (const item of ev.EVALUATIONS) {
    const linked = item.candidates.map((id) => byId[id]).filter(Boolean);
    if (!linked.length) continue;

    const sources = (item.sources || []).map((id) => SOURCES[id]).filter(Boolean);
    if (!sources.length) continue; // no registered evidence, no recommendation

    // Only evaluations tied to a candidate that actually fits are shown. A long
    // unfiltered list of every test associated with any candidate would be
    // worse than useless to the person reading it.
    const MIN_LINK_COMPATIBILITY = 40;
    if (!linked.some((c) => c.compatibility >= MIN_LINK_COMPATIBILITY)) continue;

    // Fit dominates: an evaluation tied to a candidate that barely matches what
    // was reported should not outrank one tied to the leading candidate merely
    // because it is safety relevant. The safety bonus therefore only applies to
    // a candidate that actually fits.
    const best = Math.max(...linked.map((c) => c.compatibility));
    const urgentLink = linked.some((c) => (c.urgency === 'emergency' || c.urgency === 'urgent') && c.compatibility >= 50);
    const fit = (best / 100) * 3 + (linked.reduce((acc, c) => acc + c.compatibility, 0) / 100) * 0.5;
    const discriminates = linked.filter((c) => c.compatibility >= 40).length > 1 ? 1.5 : 0;
    const safety = item.safety_relevant && urgentLink ? 2.5 : 0;

    scored.push({
      id: item.id,
      name: pick(item.name),
      type: item.type,
      why: pick(item.why),
      clinical_question: pick(item.clinical_question),
      what_to_expect: pick(item.expect),
      preparation: pick(item.preparation),
      preparation_status: item.preparation ? 'source_supported' : 'none_indicated',
      practical: pick(ev.COST_NOTE),
      cost_estimate: null,
      relates_to: linked.map((c) => ({ id: c.id, name: c.name, compatibility: c.compatibility })),
      evidence: sources,
      confidence: 'evidence_supported',
      priority_score: Number((safety + fit + discriminates).toFixed(2)),
      safety_relevant: Boolean(item.safety_relevant && urgentLink),
    });
  }

  scored.sort((a, b) => b.priority_score - a.priority_score);
  const evaluations = scored.slice(0, 4);

  return {
    status: evaluations.length ? 'ok' : 'no_supported_evaluation',
    note: evaluations.length
      ? pick(ev.DECIDER_NOTE)
      : ar
        ? 'لا تتوفر في قاعدة المعرفة الحالية أدلة موثوقة كافية لاقتراح فحص محدد.'
        : 'Reliable evidence for a specific evaluation was not available in the current knowledge base.',
    evaluations,
    preparation: ar ? ev.VISIT_PREPARATION.ar : ev.VISIT_PREPARATION.en,
    practical: pick(ev.COST_NOTE),
    reassurance: pick(ev.EMOTIONAL_NOTE),
    limitations: [
      pick(ev.DECIDER_NOTE),
      ar
        ? 'هذه احتمالات لخطوات تالية، وليست تشخيصًا ولا أمرًا طبيًا.'
        : 'These are possible next steps, not a diagnosis and not a medical order.',
      ar
        ? 'لا يقدّر HealTrip أي تكلفة. التكلفة والتوفر يختلفان حسب البلد والمنشأة والتأمين.'
        : 'HealTrip does not estimate any cost. Cost and availability vary by country, facility and insurance.',
    ],
  };
}

function carePathway(state, differential, lang = 'en') {
  const base = urgencyLabel(state.urgencyScore, state.redFlags);
  const floor = candidateFloor(differential);
  const level = LEVELS[Math.max(LEVELS.indexOf(base), LEVELS.indexOf(floor))];
  const specialty = differential.verified.length ? differential.verified[0].specialty : 'General Practice';
  const copy = {
    emergency: {
      en: 'Seek emergency care now. Call your local emergency number or go to the nearest emergency department. Do not wait for this assessment to finish.',
      ar: 'اطلبي الرعاية الطارئة الآن. اتصلي برقم الطوارئ المحلي أو توجهي لأقرب قسم طوارئ. لا تنتظري انتهاء هذا التقييم.',
    },
    urgent: {
      en: 'Arrange to be seen today by a clinician, or use an urgent care service if your regular clinic is closed.',
      ar: 'رتبي لمراجعة طبيب اليوم، أو استخدمي خدمة رعاية عاجلة إذا كانت عيادتك مغلقة.',
    },
    soon: {
      en: 'Book an appointment within the next few days. Seek care sooner if anything gets worse.',
      ar: 'احجزي موعدًا خلال الأيام القليلة القادمة. واطلبي الرعاية أبكر إذا ساءت الأعراض.',
    },
    routine: {
      en: 'A routine appointment is reasonable. Keep track of what changes and seek care sooner if it does.',
      ar: 'موعد اعتيادي مناسب. تابعي أي تغيّر واطلبي الرعاية أبكر إذا حدث.',
    },
  };
  return { level, specialty, advice: copy[level][lang === 'ar' ? 'ar' : 'en'] };
}

function summarise(state, lang = 'en') {
  const differential = buildDifferential(state, lang);
  const pathway = carePathway(state, differential, lang);
  const ar = lang === 'ar';
  return {
    reported: state.symptoms.map((s) => (ar ? SYMPTOMS[s].ar : SYMPTOMS[s].en)),
    answers: state.answers.map((a) => ({ field: a.field, answer: ar ? a.label_ar : a.label_en })),
    stillUnknown: state.unknowns,
    redFlags: state.redFlags.map((f) => (ar ? f.ar : f.en)),
    urgency: pathway.level,
    advice: pathway.advice,
    specialty: pathway.specialty,
    differential: differential.verified,
    nextEvaluations: possibleEvaluations(state, lang),
    droppedClaims: differential.rejected,
    disclaimer: ar
      ? 'هذا ليس تشخيصًا. HealTrip يوضح الاحتمالات التي قد تكون متوافقة مع ما ذكرتِه، وما الذي قد يساعد الطبيب على التفريق بينها.'
      : 'This is not a diagnosis. HealTrip describes explanations that may be compatible with what you reported, and what could help a clinician tell them apart.',
    generatedAt: new Date().toISOString(),
  };
}

/** FHIR R4-shaped export so the summary can be handed to a clinical system. */
function toFhirBundle(state, summary, sessionId) {
  const now = new Date().toISOString();
  const entries = [
    {
      resource: {
        resourceType: 'Patient',
        id: `healtrip-${sessionId}`,
        meta: { tag: [{ code: 'self-reported', display: 'Self-reported, unverified identity' }] },
      },
    },
  ];
  state.symptoms.forEach((s, i) => {
    entries.push({
      resource: {
        resourceType: 'Observation',
        id: `symptom-${i}`,
        status: 'preliminary',
        category: [{ coding: [{ code: 'symptom', display: 'Patient-reported symptom' }] }],
        code: { text: SYMPTOMS[s].en },
        subject: { reference: `Patient/healtrip-${sessionId}` },
        effectiveDateTime: now,
      },
    });
  });
  state.answers.forEach((a, i) => {
    entries.push({
      resource: {
        resourceType: 'QuestionnaireResponse',
        id: `answer-${i}`,
        status: 'completed',
        authored: now,
        subject: { reference: `Patient/healtrip-${sessionId}` },
        item: [{ linkId: a.questionId, text: a.field, answer: [{ valueString: a.label_en }] }],
      },
    });
  });
  entries.push({
    resource: {
      resourceType: 'RiskAssessment',
      id: 'triage',
      status: 'final',
      subject: { reference: `Patient/healtrip-${sessionId}` },
      occurrenceDateTime: now,
      note: [{ text: `Urgency: ${summary.urgency}. ${summary.disclaimer}` }],
      prediction: summary.differential.map((d) => ({
        outcome: { text: d.name },
        qualitativeRisk: { text: `compatibility ${d.compatibility}% with reported information` },
      })),
    },
  });
  return { resourceType: 'Bundle', type: 'collection', timestamp: now, entry: entries };
}

module.exports = {
  emptyState,
  possibleEvaluations,
  stripNegated,
  extractSymptoms,
  screenRedFlags,
  ingestText,
  applyAnswer,
  nextQuestion,
  scoreCandidates,
  buildDifferential,
  carePathway,
  summarise,
  toFhirBundle,
  urgencyLabel,
};
