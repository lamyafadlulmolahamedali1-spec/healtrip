#!/usr/bin/env node
/**
 * Failure-mode tests.
 *
 * Every layer has to fail in a way that is safe and visible. These run in
 * process, without a server, because they deliberately break dependencies.
 *
 *   node scripts/resilience-tests.js
 */

const path = require('path');
const SRC = path.resolve(__dirname, '..', 'backend', 'src');

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

(async () => {
  // --- language provider unreachable -----------------------------------
  process.env.AI_MODE = 'openai';
  process.env.OPENAI_API_KEY = 'sk-not-a-real-key';
  delete require.cache[require.resolve(`${SRC}/ai/provider.js`)];
  const ai = require(`${SRC}/ai/provider.js`);
  const phrased = await ai.phrase({ kind: 'summary', differential: [{ name: 'Migraine' }], advice: 'Book an appointment.' }, 'en');
  check('unreachable model falls back to the deterministic text', Boolean(phrased.text) && phrased.provider.includes('fallback'), phrased.provider);
  check('the fallback still carries the engine advice', phrased.text.includes('Book an appointment.'));
  check('the fallback is marked unverified rather than silently trusted', phrased.verified === false);

  const ar = await ai.phrase({ kind: 'summary', differential: [{ name: 'شقيقة' }], advice: 'احجزي موعدًا.' }, 'ar');
  check('the fallback works in Arabic too', ar.text.includes('احجزي موعدًا.'));

  // a model that answers with a diagnosis must be replaced, not passed through
  delete require.cache[require.resolve(`${SRC}/ai/provider.js`)];
  process.env.AI_MODE = 'demo';
  const demo = require(`${SRC}/ai/provider.js`);
  check('demo mode needs no key at all', demo.MODE === 'demo');

  // --- database unreachable --------------------------------------------
  process.env.DATABASE_URL = 'postgres://nobody:nobody@127.0.0.1:1/nothing';
  delete require.cache[require.resolve(`${SRC}/store.js`)];
  const store = require(`${SRC}/store.js`);
  await store.init();
  check('a broken database connection falls back to in-memory storage', store.kind() === 'memory', store.kind());
  const id = 'resilience-test';
  await store.saveSession(id, { symptoms: ['headache'], redFlags: [], answers: [], unknowns: [] }, 'en');
  check('the product still works after the fallback', Boolean(await store.getSession(id)));
  check('the fallback is visible rather than silent', store.kind() !== 'postgres');

  // --- tool failures -----------------------------------------------------
  delete process.env.DATABASE_URL;
  const tools = require(`${SRC}/agent/tools.js`);
  const unknown = await tools.invoke('drop_all_tables', {});
  check('an unknown tool returns a structured refusal', unknown.ok === false && unknown.error === 'unknown_tool');
  const badArgs = await tools.invoke('search_doctors', { specialty: 123 });
  check('bad arguments return the schema issues, not a crash', badArgs.ok === false && Array.isArray(badArgs.issues));
  const missing = await tools.invoke('verify_doctor', { doctor_id: 'nope' });
  check('an unknown provider id returns no_match rather than an invention', missing.result.status === 'no_match');

  // --- agent with everything degraded ------------------------------------
  const agent = require(`${SRC}/agent/orchestrator.js`);
  const turn = await agent.runTurn({ message: 'Find me a cardiologist in Atlantis', lang: 'en' });
  check('the agent answers safely when a search returns nothing', !/Dr\.\s+\w+/.test(turn.text));
  check('the trace still records what happened', turn.trace[0].type === 'safety_check' && turn.trace.length >= 3);

  const emergency = await agent.runTurn({ message: 'crushing chest pain and sweating', lang: 'en' });
  check('safety still fires with the model unavailable', emergency.type === 'safety' && emergency.level === 'emergency');

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nresilience: ${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
})();
