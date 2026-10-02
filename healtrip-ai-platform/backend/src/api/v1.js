'use strict';

/**
 * HealTrip API v1.
 *
 * The contract between the interface, the agent and the data. Three rules hold
 * everywhere in this router:
 *
 *   1. Every request body is validated by a schema before anything runs.
 *   2. The language model never reaches the database. It emits a tool name and
 *      arguments; the tool layer validates them and runs the query.
 *   3. Every response carries its locale and direction, and every message the
 *      person reads comes from the locale files, not from string literals here.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');

const engine = require('../clinical/engine');
const kb = require('../clinical/knowledge');
const providers = require('../clinical/providers');
const store = require('../store');
const agent = require('../agent/orchestrator');
const tools = require('../agent/tools');
const i18n = require('../i18n');
const ai = require('../ai/provider');
const report = require('../services/report');

const { envelope, fail } = i18n;

function build({ auth, optionalAuth, audit, turnPayload, signToken }) {
  const router = express.Router();
  router.use(i18n.middleware);

  const parse = (schema, req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      fail(req, res, 400, 'errors.validation', { issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
      return null;
    }
    return parsed.data;
  };

  // ---------------------------------------------------------------- meta
  router.get('/health', (req, res) =>
    res.json(
      envelope(req, {
        status: 'ok',
        service: 'healtrip-api',
        api_version: 'v1',
        ai_mode: ai.MODE,
        storage: store.kind(),
        knowledge: { conditions: kb.CONDITIONS.length, questions: kb.QUESTIONS.length, red_flags: kb.RED_FLAGS.length, sources: Object.keys(kb.SOURCES).length },
        supported_languages: i18n.SUPPORTED,
        time: new Date().toISOString(),
      })
    )
  );

  router.get('/readiness', async (req, res) =>
    res.json(envelope(req, await require('../readiness').evaluate(store.kind(), ai.MODE)))
  );

  router.get('/evaluation', async (req, res) => res.json(envelope(req, await require('../evaluation').run())));

  router.get('/openapi.json', (_req, res) => res.json(require('../openapi').spec()));


  // ---------------------------------------------------------------- auth
  const Credentials = z.object({
    email: z.string().email().max(160),
    password: z.string().min(10).max(200),
  });

  router.post('/auth/register', async (req, res) => {
    const body = parse(Credentials, req, res);
    if (!body) return;
    if (await store.findUser(body.email)) return fail(req, res, 409, 'errors.accountExists');
    const user = await store.createUser(body.email, await bcrypt.hash(body.password, 12));
    await store.upsertProfile(user.id, { preferred_language: req.lang });
    await audit('auth.register', req, { userId: user.id });
    res.status(201).json(envelope(req, { token: signToken(user), user: { id: user.id, email: user.email, role: user.role } }));
  });

  router.post('/auth/login', async (req, res) => {
    const body = parse(Credentials.partial({ password: true }).extend({ password: z.string().max(200) }), req, res);
    if (!body) return;
    const user = await store.findUser(body.email);
    const ok = user && (await bcrypt.compare(body.password, user.password_hash || user.passwordHash));
    if (!ok) {
      await audit('auth.failed', req, {});
      return fail(req, res, 401, 'errors.invalidCredentials');
    }
    await audit('auth.login', req, { userId: user.id });
    res.json(envelope(req, { token: signToken(user), user: { id: user.id, email: user.email, role: user.role } }));
  });

  router.get('/me', auth, async (req, res) =>
    res.json(envelope(req, { user: req.user, profile: await store.getProfile(req.user.id) }))
  );

  router.get('/ready', (req, res) =>
    res.json(
      envelope(req, {
        ready: true,
        storage: store.kind(),
        production_database: store.kind() === 'postgres',
        ai: ai.MODE,
      })
    )
  );

  // ---------------------------------------------------------- assessments
  const StartSchema = z.object({ message: z.string().min(2).max(2000).optional(), text: z.string().min(2).max(2000).optional(), language: z.enum(['en', 'ar']).optional(), lang: z.enum(['en', 'ar']).optional() })
    .refine((v) => v.message || v.text, { message: 'message is required' });

  router.post('/assessments', optionalAuth, async (req, res) => {
    const body = parse(StartSchema, req, res);
    if (!body) return;
    const lang = body.language || body.lang || req.lang;
    const id = crypto.randomUUID();
    const state = engine.ingestText(engine.emptyState(), body.message || body.text);
    await store.saveSession(id, state, lang, req.user?.id || null);
    await audit('assessment.start', req, { sessionId: id, symptoms: state.symptoms, flags: state.redFlags.map((f) => f.id) });
    const payload = await turnPayload(id, state, lang);
    res.status(201).json(envelope({ ...req, lang }, { assessment_id: id, ...payload }));
  });

  const AnswerSchema = z.object({
    question_id: z.string().max(60).optional(),
    questionId: z.string().max(60).optional(),
    value: z.string().max(60).optional(),
    message: z.string().max(2000).optional(),
    text: z.string().max(2000).optional(),
    language: z.enum(['en', 'ar']).optional(),
  });

  router.post('/assessments/:id/answers', optionalAuth, async (req, res) => {
    const body = parse(AnswerSchema, req, res);
    if (!body) return;
    const lang = body.language || req.lang;
    let state = await store.getSession(req.params.id);
    if (!state) return fail(req, res, 404, 'errors.assessmentNotFound');
    const questionId = body.question_id || body.questionId;
    if (questionId && body.value) state = engine.applyAnswer(state, questionId, body.value);
    const free = body.message || body.text;
    if (free) state = engine.ingestText(state, free);
    await store.saveSession(req.params.id, state, lang, req.user?.id || null);
    await audit('assessment.reply', req, { sessionId: req.params.id });
    res.json(envelope({ ...req, lang }, { assessment_id: req.params.id, ...(await turnPayload(req.params.id, state, lang)) }));
  });

  router.get('/assessments/:id', async (req, res) => {
    const state = await store.getSession(req.params.id);
    if (!state) return fail(req, res, 404, 'errors.assessmentNotFound');
    res.json(envelope(req, { assessment_id: req.params.id, summary: engine.summarise(state, req.lang) }));
  });

  router.get('/assessments/:id/fhir', async (req, res) => {
    const state = await store.getSession(req.params.id);
    if (!state) return fail(req, res, 404, 'errors.assessmentNotFound');
    await audit('export.fhir', req, { sessionId: req.params.id });
    res.json(engine.toFhirBundle(state, engine.summarise(state, 'en'), req.params.id.slice(0, 8)));
  });

  /**
   * What a clinician may consider next, for one assessment. Evidence-grounded,
   * never an order, and never carrying a cost estimate.
   */
  router.get('/assessments/:id/evaluations', optionalAuth, async (req, res) => {
    const state = await store.getSession(req.params.id);
    if (!state) return fail(req, res, 404, 'errors.assessmentNotFound');
    const result = engine.possibleEvaluations(state, req.lang);
    await audit('evaluations.read', req, { sessionId: req.params.id, count: result.evaluations.length, status: result.status });
    res.json(envelope(req, { assessment_id: req.params.id, ...result }));
  });

  /** Printable bilingual report. The browser turns it into a PDF. */
  router.get('/assessments/:id/report', async (req, res) => {
    const state = await store.getSession(req.params.id);
    if (!state) return fail(req, res, 404, 'errors.assessmentNotFound');
    const summary = engine.summarise(state, req.lang);
    const doctors = await store.searchDoctors({ specialty: summary.specialty });
    await audit('export.report', req, { sessionId: req.params.id, lang: req.lang });
    res.type('html').send(report.render({ lang: req.lang, id: req.params.id, summary, doctors }));
  });

  router.delete('/assessments/:id', auth, async (req, res) => {
    await store.deleteSession(req.params.id);
    await audit('assessment.delete', req, { sessionId: req.params.id });
    res.json(envelope(req, { deleted: true }));
  });

  // ---------------------------------------------------------------- agent
  const ChatSchema = z.object({
    message: z.string().min(1).max(4000),
    language: z.enum(['en', 'ar']).optional(),
    conversation_id: z.string().max(80).optional(),
    include_trace: z.boolean().optional(),
  });

  router.post('/agent/chat', optionalAuth, async (req, res) => {
    const body = parse(ChatSchema, req, res);
    if (!body) return;
    const lang = body.language || req.lang;
    const profile = req.user ? await store.getProfile(req.user.id) : null;
    const history = body.conversation_id ? await store.getMessages(body.conversation_id) : [];

    const turn = await agent.runTurn({ message: body.message, lang, profile, history });

    if (body.conversation_id && req.user) {
      await store.addMessage(body.conversation_id, 'user', body.message);
      await store.addMessage(body.conversation_id, 'assistant', turn.text, `agent:${ai.MODE}`, turn.verified !== false);
    }
    for (const call of turn.tool_calls) {
      await store.audit({
        event: 'agent.tool_call',
        user_id: req.user?.id || null,
        session_id: null,
        detail: { tool: call.name, ok: call.ok, status: call.result?.status || call.error },
      });
    }

    res.json(
      envelope({ ...req, lang }, {
        type: turn.type,
        safety: { level: turn.level },
        message: turn.text,
        grounded_in: turn.sources,
        tool_calls: turn.tool_calls.map((c) => ({ name: c.name, ok: c.ok, arguments: c.arguments, status: c.result?.status || c.error, source: c.result?.source })),
        trace: body.include_trace === false ? undefined : turn.trace,
      })
    );
  });

  router.get('/agent/tools', (req, res) => res.json(envelope(req, { tools: tools.CATALOG })));

  // ------------------------------------------------------- typed tool calls
  const toolRoute = (name) => async (req, res) => {
    const outcome = await tools.invoke(name, req.body);
    if (!outcome.ok) return fail(req, res, 400, 'errors.validation', { tool: name, issues: outcome.issues });
    await store.audit({ event: 'tool.invoke', user_id: req.user?.id || null, session_id: null, detail: { tool: name, status: outcome.result.status } });
    res.json(envelope(req, { tool: name, arguments: outcome.arguments, ...outcome.result }));
  };

  router.post('/tools/check-safety', optionalAuth, toolRoute('check_safety_rules'));
  router.post('/tools/search-doctors', optionalAuth, toolRoute('search_doctors'));
  router.post('/tools/search-hospitals', optionalAuth, toolRoute('search_hospitals'));
  router.post('/tools/verify-doctor', optionalAuth, toolRoute('verify_doctor'));
  router.post('/tools/clinical-evidence', optionalAuth, toolRoute('get_clinical_evidence'));
  router.post('/tools/possible-evaluations', optionalAuth, toolRoute('get_possible_evaluations'));
  router.post('/tools/relevant-specialty', optionalAuth, toolRoute('find_relevant_specialty'));

  // ------------------------------------------------------------- directory
  router.get('/doctors', async (req, res) => {
    const rows = await store.searchDoctors({
      specialty: req.query.specialty, country: req.query.country, city: req.query.city,
      language: req.query.language, telemedicine: req.query.telemedicine === 'true' ? true : undefined,
    });
    res.json(envelope(req, { count: rows.length, source_note: req.t('providers.sourceNote'), doctors: rows }));
  });

  router.get('/doctors/:id', (req, res) => {
    const row = providers.DOCTORS.find((d) => d.id === req.params.id);
    if (!row) return fail(req, res, 404, 'errors.notFound');
    res.json(envelope(req, { doctor: row }));
  });

  router.get('/doctors/:id/license', (req, res) => {
    const result = providers.verifyLicense(req.params.id);
    if (!result.found) return fail(req, res, 404, 'errors.notFound');
    res.json(envelope(req, result));
  });

  router.get('/hospitals/:id', async (req, res) => {
    const rows = await store.searchHospitals({});
    const row = rows.find((h) => h.id === req.params.id);
    if (!row) return fail(req, res, 404, 'errors.notFound');
    res.json(envelope(req, { hospital: row }));
  });

  router.get('/hospitals', async (req, res) => {
    const rows = await store.searchHospitals({
      specialty: req.query.specialty, country: req.query.country, city: req.query.city,
      emergency: req.query.emergency === 'true' ? true : undefined,
    });
    res.json(envelope(req, { count: rows.length, hospitals: rows }));
  });

  router.get('/provider-sources', (req, res) => res.json(envelope(req, { sources: providers.AUTHORITIES })));

  // -------------------------------------------------------------- evidence
  router.get('/evidence', (req, res) => res.json(envelope(req, { sources: Object.values(kb.SOURCES) })));
  router.get('/evidence/:id', (req, res) => {
    const source = kb.SOURCES[req.params.id];
    if (!source) return fail(req, res, 404, 'errors.evidenceUnavailable');
    res.json(envelope(req, { source }));
  });
  router.get('/knowledge/conditions', (req, res) =>
    res.json(envelope(req, {
      count: kb.CONDITIONS.length,
      conditions: kb.CONDITIONS.map((c) => ({ id: c.id, name: req.lang === 'ar' ? c.ar : c.en, specialty: c.specialty, urgency: c.urgency, sources: c.sources })),
    }))
  );
  router.get('/knowledge/red-flags', (req, res) =>
    res.json(envelope(req, {
      count: kb.RED_FLAGS.length,
      rules: kb.RED_FLAGS.map((r) => ({ id: r.id, level: r.level, text: req.lang === 'ar' ? r.ar : r.en, concept_groups: (r.concepts || []).length, source: r.source })),
    }))
  );

  // -------------------------------------------------------------- locales
  router.get('/locales/:code', (req, res) => {
    const bundle = i18n.BUNDLES[req.params.code];
    if (!bundle) return fail(req, res, 404, 'errors.notFound');
    res.json(bundle);
  });

  return router;
}

module.exports = { build };
