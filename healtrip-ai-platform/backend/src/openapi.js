'use strict';

/** OpenAPI 3.1 description of the v1 contract, served at /api/v1/openapi.json. */

const tools = require('./agent/tools');

const LANG_PARAM = {
  name: 'Accept-Language',
  in: 'header',
  required: false,
  schema: { type: 'string', enum: ['en', 'ar'] },
  description: 'Language of every human-readable string in the response. Clinical logic is identical in both.',
};

const json = (schema) => ({ content: { 'application/json': { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

function spec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'HealTrip API',
      version: '1.0.0',
      contact: { name: 'HealTrip prototype' },
      description:
        'Patient navigation and clinical evidence API. The safety gate, the question engine and the differential are deterministic; the language model only phrases what the tools returned, and has no database access.',
      license: { name: 'Prototype, not for clinical use' },
    },
    servers: [{ url: '/api/v1' }],
    tags: [
      { name: 'meta', description: 'Health, readiness, evaluation, OpenAPI' },
      { name: 'auth', description: 'Accounts and tokens' },
      { name: 'assessments', description: 'Adaptive clinical assessment' },
      { name: 'agent', description: 'Tool-calling assistant and its execution trace' },
      { name: 'tools', description: 'The same tools the agent uses, callable directly' },
      { name: 'directory', description: 'Clinicians, hospitals and licensing registers' },
      { name: 'evidence', description: 'Source register and readable knowledge base' },
    ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Envelope: {
          type: 'object',
          properties: { locale: { type: 'string', enum: ['en', 'ar'] }, direction: { type: 'string', enum: ['ltr', 'rtl'] } },
        },
        Error: {
          type: 'object',
          properties: { locale: { type: 'string' }, direction: { type: 'string' }, error: { type: 'string' }, error_key: { type: 'string' } },
        },
        AssessmentRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', minLength: 2, maxLength: 2000, example: 'I have chest pain and I am sweating' },
            language: { type: 'string', enum: ['en', 'ar'] },
          },
        },
        AssessmentResponse: {
          type: 'object',
          properties: {
            assessment_id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['question', 'summary', 'emergency', 'support'] },
            urgency: { type: 'string', enum: ['routine', 'soon', 'urgent', 'emergency', 'support'] },
            question: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                why: { type: 'string' },
                informationGain: { type: 'number', description: 'How much this question would re-rank the live candidates' },
                options: { type: 'array', items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } } },
              },
            },
            shortlist: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, compatibility: { type: 'integer' } } } },
            summary: { type: 'object' },
          },
        },
        AnswerRequest: {
          type: 'object',
          properties: {
            question_id: { type: 'string', example: 'radiation' },
            value: { type: 'string', example: 'arm_jaw' },
            message: { type: 'string', description: 'Free text instead of, or alongside, an answer' },
            language: { type: 'string', enum: ['en', 'ar'] },
          },
        },
        ChatRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', example: "I don't think this is an emergency. Can you find me a cardiologist in London?" },
            language: { type: 'string', enum: ['en', 'ar'] },
            conversation_id: { type: 'string' },
            include_trace: { type: 'boolean', default: true },
          },
        },
        ChatResponse: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['answer', 'safety', 'support', 'redirect'] },
            safety: { type: 'object', properties: { level: { type: 'string' } } },
            message: { type: 'string' },
            grounded_in: { type: 'array', items: { type: 'string' }, description: 'Identifiers taken from tool results. The agent may state nothing outside these.' },
            tool_calls: { type: 'array', items: ref('ToolCall') },
            trace: { type: 'array', items: ref('TraceStep') },
          },
        },
        ToolCall: {
          type: 'object',
          properties: {
            name: { type: 'string', enum: Object.keys(tools.TOOLS) },
            ok: { type: 'boolean' },
            arguments: { type: 'object' },
            status: { type: 'string', enum: ['ok', 'no_match', 'match', 'invalid_arguments', 'unknown_tool'] },
            source: { type: 'string', example: 'provider_database' },
          },
        },
        TraceStep: {
          type: 'object',
          properties: {
            step: { type: 'integer' },
            type: { type: 'string', enum: ['safety_check', 'tool_call', 'tool_result', 'decision', 'claim_screen', 'response'] },
            at: { type: 'string', format: 'date-time' },
          },
        },
        DoctorSearchRequest: {
          type: 'object',
          properties: {
            specialty: { type: 'string', example: 'Cardiology' },
            country: { type: 'string' },
            city: { type: 'string', example: 'London' },
            language: { type: 'string', example: 'Arabic' },
            telemedicine: { type: 'boolean' },
          },
        },
        DoctorSearchResponse: {
          type: 'object',
          properties: {
            source: { type: 'string', example: 'provider_database' },
            status: { type: 'string', enum: ['ok', 'no_match'] },
            count: { type: 'integer' },
            results: { type: 'array', items: ref('Doctor') },
          },
        },
        Doctor: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            full_name: { type: 'string' },
            specialty: { type: 'string' },
            subspecialty: { type: 'string' },
            qualifications: { type: 'string' },
            organization: { type: 'string' },
            city: { type: 'string' },
            country: { type: 'string' },
            languages: { type: 'array', items: { type: 'string' } },
            telemedicine: { type: 'boolean' },
            license_status: { type: 'string', enum: ['verified', 'unverified', 'lapsed', 'restricted'] },
            licensing_authority: { type: 'string', nullable: true },
            source: { type: 'string' },
          },
        },
        Evaluation: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'ecg' },
            name: { type: 'string' },
            type: { type: 'string', example: 'laboratory' },
            why: { type: 'string', description: 'Why a clinician may consider it' },
            clinical_question: { type: 'string', description: 'What it may help evaluate' },
            what_to_expect: { type: 'string' },
            preparation: { type: 'string', nullable: true, description: 'Only where a source supports it; null means none indicated' },
            preparation_status: { type: 'string', enum: ['source_supported', 'none_indicated'] },
            practical: { type: 'string', description: 'Cost and availability vary; no estimate is ever given' },
            cost_estimate: { type: 'null', description: 'Always null. HealTrip does not estimate costs.' },
            relates_to: { type: 'array', items: { type: 'object' } },
            evidence: { type: 'array', items: { type: 'object' } },
            confidence: { type: 'string', enum: ['evidence_supported'] },
            priority_score: { type: 'number' },
          },
        },
        SafetyResult: {
          type: 'object',
          properties: {
            source: { type: 'string', example: 'clinical_safety_rules' },
            level: { type: 'string', enum: ['none', 'urgent', 'emergency', 'support'] },
            rule_count: { type: 'integer' },
            flags: { type: 'array', items: { type: 'object' } },
            symptoms_detected: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    paths: {
      '/auth/register': { post: { tags: ['auth'], summary: 'Create an account', requestBody: { required: true, ...json({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 10 } } }) }, responses: { 201: { description: 'Created, returns a JWT' }, 400: { description: 'Validation failed', ...json(ref('Error')) }, 409: { description: 'Account exists', ...json(ref('Error')) } } } },
      '/auth/login': { post: { tags: ['auth'], summary: 'Exchange credentials for a JWT', requestBody: { required: true, ...json({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } }) }, responses: { 200: { description: 'Returns a JWT' }, 401: { description: 'Rejected without revealing whether the account exists', ...json(ref('Error')) } } } },
      '/me': { get: { tags: ['auth'], summary: 'The signed-in account and its profile', security: [{ bearerAuth: [] }], responses: { 200: { description: 'ok' }, 401: { description: 'No or invalid token', ...json(ref('Error')) } } } },
      '/ready': { get: { tags: ['meta'], summary: 'Readiness probe: storage mode and whether a production database is attached', responses: { 200: { description: 'ok' } } } },
      '/hospitals/{id}': { get: { tags: ['directory'], summary: 'One hospital record', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'ok' }, 404: { description: 'Not found', ...json(ref('Error')) } } } },
      '/health': { get: { tags: ['meta'], summary: 'Service status, storage mode, knowledge counts', parameters: [LANG_PARAM], responses: { 200: { description: 'ok', ...json(ref('Envelope')) } } } },
      '/readiness': { get: { tags: ['meta'], summary: 'The ten clinical readiness gates and what is still open', responses: { 200: { description: 'ok' } } } },
      '/evaluation': { get: { tags: ['meta'], summary: 'Runs the evaluation suite and returns measured metrics', responses: { 200: { description: 'ok' } } } },
      '/openapi.json': { get: { tags: ['meta'], summary: 'This document', responses: { 200: { description: 'ok' } } } },

      '/assessments': {
        post: {
          tags: ['assessments'],
          summary: 'Open an assessment. The safety gate runs before anything else and can end the turn immediately.',
          parameters: [LANG_PARAM],
          requestBody: { required: true, ...json(ref('AssessmentRequest')) },
          responses: { 201: { description: 'Assessment opened', ...json(ref('AssessmentResponse')) }, 400: { description: 'Validation failed', ...json(ref('Error')) } },
        },
      },
      '/assessments/{id}/answers': {
        post: {
          tags: ['assessments'],
          summary: 'Answer the current question, or add free text. Returns the next best question or the summary.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, LANG_PARAM],
          requestBody: { required: true, ...json(ref('AnswerRequest')) },
          responses: { 200: { description: 'Next turn', ...json(ref('AssessmentResponse')) }, 404: { description: 'Not found', ...json(ref('Error')) } },
        },
      },
      '/assessments/{id}': {
        get: { tags: ['assessments'], summary: 'Structured summary', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, LANG_PARAM], responses: { 200: { description: 'ok' } } },
        delete: { tags: ['assessments'], summary: 'Delete the assessment and its content', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'deleted' } } },
      },
      '/assessments/{id}/fhir': { get: { tags: ['assessments'], summary: 'FHIR R4 bundle of the assessment', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'FHIR Bundle' } } } },
      '/assessments/{id}/evaluations': {
        get: {
          tags: ['assessments'],
          summary: 'Evaluations a clinician may consider, with the clinical question each answers',
          description:
            'Entries come from the controlled clinical knowledge layer and are returned only when an associated candidate is in the verified differential and a registered source exists. Never an order, never a cost estimate. Returns status "safety_override" when a red flag is present, because an emergency is not a testing discussion.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, LANG_PARAM],
          responses: {
            200: {
              description: 'Possible evaluations',
              ...json({
                type: 'object',
                properties: {
                  assessment_id: { type: 'string' },
                  status: { type: 'string', enum: ['ok', 'no_supported_evaluation', 'safety_override'] },
                  note: { type: 'string' },
                  evaluations: { type: 'array', items: ref('Evaluation') },
                  preparation: { type: 'array', items: { type: 'string' } },
                  limitations: { type: 'array', items: { type: 'string' } },
                },
              }),
            },
            404: { description: 'Not found', ...json(ref('Error')) },
          },
        },
      },
      '/assessments/{id}/report': { get: { tags: ['assessments'], summary: 'Printable bilingual clinical navigation summary (HTML, print to PDF)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, LANG_PARAM], responses: { 200: { description: 'HTML report' } } } },

      '/agent/chat': {
        post: {
          tags: ['agent'],
          summary: 'One agent turn: safety check, tool plan, tool execution, grounded answer, execution trace',
          description: 'The model may only emit tool names and arguments. It has no database access, and the response is composed from tool results.',
          parameters: [LANG_PARAM],
          requestBody: { required: true, ...json(ref('ChatRequest')) },
          responses: { 200: { description: 'Agent turn', ...json(ref('ChatResponse')) } },
        },
      },
      '/agent/tools': { get: { tags: ['agent'], summary: 'The tool catalog the agent is restricted to', responses: { 200: { description: 'ok' } } } },

      '/tools/check-safety': { post: { tags: ['tools'], summary: 'Run the red-flag rules over free text', requestBody: { required: true, ...json({ type: 'object', required: ['text'], properties: { text: { type: 'string' } } }) }, responses: { 200: { description: 'ok', ...json(ref('SafetyResult')) } } } },
      '/tools/search-doctors': { post: { tags: ['tools'], summary: 'Search the provider database', requestBody: { required: true, ...json(ref('DoctorSearchRequest')) }, responses: { 200: { description: 'ok', ...json(ref('DoctorSearchResponse')) }, 400: { description: 'Arguments rejected by the schema', ...json(ref('Error')) } } } },
      '/tools/search-hospitals': { post: { tags: ['tools'], summary: 'Search the hospital directory', requestBody: { required: true, ...json({ type: 'object', properties: { specialty: { type: 'string' }, city: { type: 'string' }, country: { type: 'string' }, emergency: { type: 'boolean' } } }) }, responses: { 200: { description: 'ok' } } } },
      '/tools/verify-doctor': { post: { tags: ['tools'], summary: 'Licence status of one provider record', requestBody: { required: true, ...json({ type: 'object', required: ['doctor_id'], properties: { doctor_id: { type: 'string' } } }) }, responses: { 200: { description: 'ok' } } } },
      '/tools/clinical-evidence': { post: { tags: ['tools'], summary: 'Registered sources, optionally for one candidate explanation', requestBody: { required: true, ...json({ type: 'object', properties: { condition_id: { type: 'string' }, query: { type: 'string' } } }) }, responses: { 200: { description: 'ok' } } } },
      '/tools/possible-evaluations': { post: { tags: ['tools'], summary: 'Evaluations a clinician may consider, from the knowledge layer', requestBody: { required: true, ...json({ type: 'object', properties: { assessment_id: { type: 'string' }, text: { type: 'string' }, language: { type: 'string', enum: ['en', 'ar'] } } }) }, responses: { 200: { description: 'ok' } } } },
      '/tools/relevant-specialty': { post: { tags: ['tools'], summary: 'Specialty recorded for a candidate or inferred from free text', requestBody: { required: true, ...json({ type: 'object', properties: { condition_id: { type: 'string' }, text: { type: 'string' } } }) }, responses: { 200: { description: 'ok' } } } },

      '/doctors': { get: { tags: ['directory'], summary: 'Filterable clinician directory', parameters: [LANG_PARAM, { name: 'specialty', in: 'query', schema: { type: 'string' } }, { name: 'country', in: 'query', schema: { type: 'string' } }, { name: 'city', in: 'query', schema: { type: 'string' } }, { name: 'language', in: 'query', schema: { type: 'string' } }, { name: 'telemedicine', in: 'query', schema: { type: 'boolean' } }], responses: { 200: { description: 'ok' } } } },
      '/doctors/{id}': { get: { tags: ['directory'], summary: 'One clinician record', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'ok' }, 404: { description: 'Not found' } } } },
      '/doctors/{id}/license': { get: { tags: ['directory'], summary: 'Licence status and the registers an importer would query', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'ok' } } } },
      '/hospitals': { get: { tags: ['directory'], summary: 'Hospital directory', parameters: [LANG_PARAM], responses: { 200: { description: 'ok' } } } },
      '/provider-sources': { get: { tags: ['directory'], summary: 'Licensing authorities and their import status', responses: { 200: { description: 'ok' } } } },

      '/evidence': { get: { tags: ['evidence'], summary: 'Source register', responses: { 200: { description: 'ok' } } } },
      '/evidence/{id}': { get: { tags: ['evidence'], summary: 'One registered source', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'ok' }, 404: { description: 'No registered source' } } } },
      '/knowledge/conditions': { get: { tags: ['evidence'], summary: 'Candidate explanations in the knowledge base', parameters: [LANG_PARAM], responses: { 200: { description: 'ok' } } } },
      '/knowledge/red-flags': { get: { tags: ['evidence'], summary: 'Every safety rule, readable', parameters: [LANG_PARAM], responses: { 200: { description: 'ok' } } } },
      '/locales/{code}': { get: { tags: ['meta'], summary: 'The locale bundle the interface uses', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string', enum: ['en', 'ar'] } }], responses: { 200: { description: 'ok' } } } },
    },
  };
}

module.exports = { spec };
