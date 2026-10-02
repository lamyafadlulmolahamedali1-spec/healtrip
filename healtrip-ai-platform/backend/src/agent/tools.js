'use strict';

/**
 * Agent tools.
 *
 * The language model has no database access and no SQL. It may only emit a tool
 * name and arguments. Every tool validates its arguments with a schema, runs
 * against a service, and returns a typed result that names its source. The agent
 * may state nothing that is not inside a tool result, and the claim screen in
 * ai/provider.js enforces that on the wording as well.
 *
 *   model -> tool name + arguments
 *          -> schema validation (rejected if it does not fit)
 *          -> service
 *          -> database or knowledge base
 *          -> typed result with source and status
 *          -> model may quote from the result and nothing else
 */

const { z } = require('zod');
const kb = require('../clinical/knowledge');
const engine = require('../clinical/engine');
const providers = require('../clinical/providers');
const store = require('../store');

const Specialty = z.string().min(2).max(60);
const Country = z.string().min(2).max(60);

const TOOLS = {
  check_safety_rules: {
    description: 'Runs the deterministic red-flag rules over a piece of free text. Always called first, before any other tool.',
    input: z.object({ text: z.string().min(1).max(2000) }),
    async run({ text }) {
      const state = engine.ingestText(engine.emptyState(), text);
      const flags = state.redFlags.map((f) => ({ id: f.id, level: f.level, text_en: f.en, text_ar: f.ar, source: kb.SOURCES[f.source]?.url || null }));
      const level = flags.some((f) => f.level === 'emergency')
        ? 'emergency'
        : flags.some((f) => f.level === 'support')
          ? 'support'
          : flags.some((f) => f.level === 'urgent')
            ? 'urgent'
            : 'none';
      return {
        source: 'clinical_safety_rules',
        rule_count: kb.RED_FLAGS.length,
        level,
        flags,
        symptoms_detected: state.symptoms,
        status: flags.length ? 'match' : 'no_match',
      };
    },
  },

  search_doctors: {
    description: 'Searches the provider database. Returns only records that exist in it.',
    input: z.object({
      specialty: Specialty.optional(),
      country: Country.optional(),
      city: z.string().max(60).optional(),
      language: z.string().max(40).optional(),
      telemedicine: z.boolean().optional(),
    }),
    async run(args) {
      const rows = await store.searchDoctors(args);
      return {
        source: 'provider_database',
        verified_source: false,
        source_note: 'Demo registry. No licensing authority has been queried in this build.',
        status: rows.length ? 'ok' : 'no_match',
        count: rows.length,
        results: rows.map((d) => ({
          id: d.id,
          full_name: d.full_name,
          specialty: d.specialty,
          subspecialty: d.subspecialty,
          qualifications: d.qualifications,
          organization: d.organization,
          city: d.city,
          country: d.country,
          languages: d.languages,
          telemedicine: d.telemedicine,
          license_status: d.license_status,
          licensing_authority: d.licensing_authority,
          source: d.source,
        })),
      };
    },
  },

  search_hospitals: {
    description: 'Searches the hospital directory, optionally for emergency departments.',
    input: z.object({
      specialty: Specialty.optional(),
      country: Country.optional(),
      city: z.string().max(60).optional(),
      emergency: z.boolean().optional(),
    }),
    async run(args) {
      const rows = await store.searchHospitals(args);
      return {
        source: 'provider_database',
        status: rows.length ? 'ok' : 'no_match',
        count: rows.length,
        results: rows,
      };
    },
  },

  verify_doctor: {
    description: 'Returns the licence status of one provider record and the registers an importer would query.',
    input: z.object({ doctor_id: z.string().min(1).max(60) }),
    async run({ doctor_id }) {
      const result = providers.verifyLicense(doctor_id);
      return { source: 'provider_database', status: result.found ? 'ok' : 'no_match', ...result };
    },
  },

  get_provider_details: {
    description: 'Returns one provider record in full.',
    input: z.object({ doctor_id: z.string().min(1).max(60) }),
    async run({ doctor_id }) {
      const row = providers.DOCTORS.find((d) => d.id === doctor_id) || null;
      return { source: 'provider_database', status: row ? 'ok' : 'no_match', result: row };
    },
  },

  get_clinical_evidence: {
    description: 'Returns registered sources, optionally the ones behind one candidate explanation.',
    input: z.object({ condition_id: z.string().max(60).optional(), query: z.string().max(200).optional() }),
    async run({ condition_id, query }) {
      if (condition_id) {
        const c = kb.CONDITION_BY_ID[condition_id];
        if (!c) return { source: 'evidence_register', status: 'no_match', results: [] };
        return {
          source: 'evidence_register',
          status: 'ok',
          condition: { id: c.id, en: c.en, ar: c.ar, specialty: c.specialty },
          results: (c.sources || []).map((id) => kb.SOURCES[id]).filter(Boolean),
        };
      }
      const all = Object.values(kb.SOURCES);
      const hits = query
        ? all.filter((s) => `${s.title} ${s.publisher} ${s.type}`.toLowerCase().includes(query.toLowerCase()))
        : all;
      return { source: 'evidence_register', status: hits.length ? 'ok' : 'no_match', count: hits.length, results: hits };
    },
  },


  get_possible_evaluations: {
    description:
      'Returns evidence-supported evaluations a clinician may consider for the structured patient state. Entries come from the controlled clinical knowledge layer; the model cannot add one, add a preparation instruction, or attach a cost.',
    input: z.object({
      assessment_id: z.string().max(80).optional(),
      text: z.string().max(2000).optional(),
      language: z.enum(['en', 'ar']).default('en'),
    }),
    async run({ assessment_id, text, language }) {
      let state = null;
      if (assessment_id) state = await store.getSession(assessment_id);
      if (!state && text) state = engine.ingestText(engine.emptyState(), text);
      if (!state) return { source: 'clinical_knowledge', status: 'no_match', evaluations: [] };

      const result = engine.possibleEvaluations(state, language);
      return {
        source: 'clinical_knowledge',
        status: result.status === 'ok' ? 'ok' : result.status,
        count: result.evaluations.length,
        note: result.note,
        results: result.evaluations,
        preparation: result.preparation,
        limitations: result.limitations,
      };
    },
  },

  find_relevant_specialty: {
    description: 'Maps a candidate explanation, or a free-text complaint, to the specialty recorded in the knowledge base.',
    input: z.object({ condition_id: z.string().max(60).optional(), text: z.string().max(500).optional() }),
    async run({ condition_id, text }) {
      if (condition_id) {
        const c = kb.CONDITION_BY_ID[condition_id];
        return { source: 'clinical_knowledge', status: c ? 'ok' : 'no_match', specialty: c?.specialty || null };
      }
      if (!text) return { source: 'clinical_knowledge', status: 'no_match', specialty: null };
      const state = engine.ingestText(engine.emptyState(), text);
      const diff = engine.buildDifferential(state, 'en');
      const top = diff.verified[0];
      return {
        source: 'clinical_knowledge',
        status: top ? 'ok' : 'no_match',
        specialty: top?.specialty || null,
        based_on: top ? { id: top.id, name: top.name, compatibility: top.compatibility } : null,
      };
    },
  },
};

/** Contracts published through OpenAPI and used by the trace viewer. */
const CATALOG = Object.entries(TOOLS).map(([name, tool]) => ({ name, description: tool.description }));

async function invoke(name, args) {
  const tool = TOOLS[name];
  if (!tool) return { ok: false, error: 'unknown_tool', name };
  const parsed = tool.input.safeParse(args || {});
  if (!parsed.success) {
    return { ok: false, error: 'invalid_arguments', name, issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  const result = await tool.run(parsed.data);
  return { ok: true, name, arguments: parsed.data, result };
}

module.exports = { TOOLS, CATALOG, invoke };
