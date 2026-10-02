/* HealTrip technical console.
 *
 * Everything an engineer or a clinical reviewer wants to inspect, in one place
 * and out of the patient experience. All figures come from the live service.
 */

const el = (id) => document.getElementById(id);
const esc = (s) => HT.escape(s);

const STEP_COLOUR = {
  safety_check: 'var(--alert)',
  tool_call: 'var(--signal-deep)',
  tool_result: 'var(--signal-deep)',
  decision: 'var(--brass)',
  claim_screen: 'var(--brass)',
  response: 'var(--mist)',
};

const METRIC_LABELS = {
  case_pass_rate: 'Clinical cases passing every check',
  safety_routing_pass_rate: 'Red-flag cases routed to emergency',
  question_relevance_rate: 'Questions relevant to reported symptoms',
  citation_grounding_rate: 'Surfaced possibilities carrying a source',
  agent_pass_rate: 'Agent turns passing every check',
  agent_safety_first_rate: 'Turns where the safety check ran first',
  evaluation_relevance_rate: 'Evaluations tied to a fitting candidate',
  evaluation_grounding_rate: 'Evaluations carrying a registered source',
};

const COUNTERS = {
  cases_total: 'Clinical cases',
  cases_adversarial: 'Adversarial cases',
  agent_cases_total: 'Agent cases',
  tool_schema_guards: 'Tool schema guards',
  provider_hallucination_count: 'Providers shown as verified without verification',
  agent_provider_invention_count: 'Clinicians invented by the agent',
  unsupported_evaluation_rate: 'Unsupported evaluation rate',
  fabricated_preparation_rate: 'Fabricated preparation rate',
  fabricated_cost_rate: 'Fabricated cost rate',
};

const pct = (n) => `${Math.round(n * 100)}%`;
const loading = (node) => { node.innerHTML = '<p class="loading">Running</p>'; };
const failed = (node, err) => { node.innerHTML = `<p style="color:var(--mist)">${esc(HT.explain(err))}</p>`; };

function renderTrace(trace) {
  return `<div class="panel-label" style="margin-top:1.2rem">Execution trace</div>
    ${trace
      .map(
        (s) => `<div class="gate">
          <span class="dot" style="background:${STEP_COLOUR[s.type] || 'var(--line)'}"></span>
          <div>
            <h3 style="margin:0">${esc(s.type.replace(/_/g, ' '))}</h3>
            <p>${esc(
              Object.entries(s)
                .filter(([k]) => !['step', 'type', 'at'].includes(k))
                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                .join(' · ') || '—'
            )}</p>
          </div>
        </div>`
      )
      .join('')}`;
}

async function probe() {
  const message = el('probe').value.trim() || el('probe').placeholder;
  loading(el('probe-out'));
  try {
    const d = await HT.post('/api/v1/agent/chat', { message, language: 'en' });
    el('probe-out').innerHTML = `
      <div class="msg assistant" style="max-width:none;white-space:pre-wrap">${esc(d.message)}</div>
      <p style="margin-top:.8rem">
        <span class="chip ${d.safety.level === 'emergency' ? 'warn' : 'ok'}">safety: ${esc(d.safety.level)}</span>
        ${d.tool_calls.map((t) => `<span class="chip">${esc(t.name)} · ${esc(t.status)}</span>`).join(' ')}
      </p>
      ${renderTrace(d.trace)}`;
  } catch (err) {
    failed(el('probe-out'), err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  el('probe-send').addEventListener('click', probe);
  el('probe').addEventListener('keydown', (e) => { if (e.key === 'Enter') probe(); });

  try {
    const health = await HT.get('/api/v1/health');
    el('api-status').textContent = `${health.api_version} · ${health.status} · storage ${health.storage} · language layer ${health.ai_mode}`;
    el('api-status').className = 'chip ok';
  } catch (err) {
    el('api-status').textContent = HT.explain(err);
    el('api-status').className = 'chip warn';
  }

  try {
    const cat = await HT.get('/api/v1/agent/tools');
    el('tools').innerHTML = cat.tools
      .map((t) => `<div class="source"><h3 style="margin:0">${esc(t.name)}</h3><p style="font-size:.86rem;color:var(--mist);margin:.2rem 0 0">${esc(t.description)}</p></div>`)
      .join('');
  } catch (err) { failed(el('tools'), err); }

  loading(el('metrics'));
  try {
    const ev = await HT.get('/api/v1/evaluation');
    const m = ev.metrics;
    el('metrics').innerHTML =
      Object.entries(METRIC_LABELS)
        .filter(([k]) => m[k] !== undefined)
        .map(([k, label]) => `<div class="metric"><span>${esc(label)}</span><b>${pct(m[k])}</b></div>`)
        .join('') +
      Object.entries(COUNTERS)
        .filter(([k]) => m[k] !== undefined)
        .map(([k, label]) => `<div class="metric"><span>${esc(label)}</span><b>${esc(m[k])}</b></div>`)
        .join('') +
      `<p style="font-size:.8rem;color:var(--mist);margin-top:1rem">Last run ${esc(ev.generated_at)}</p>`;
    el('knowledge').innerHTML = Object.entries(ev.knowledge)
      .map(([k, v]) => `<div class="metric"><span>${esc(k.replace(/_/g, ' '))}</span><b>${esc(v)}</b></div>`)
      .join('');
  } catch (err) { failed(el('metrics'), err); }

  loading(el('gatelist'));
  try {
    const r = await HT.get('/api/v1/readiness');
    el('gatelist').innerHTML =
      `<p style="font-size:.92rem;color:var(--paper);margin-bottom:1.2rem"><strong>${r.gates_passed} / ${r.gates_total}</strong> gates passed. ${esc(r.statement)}</p>` +
      r.gates
        .map(
          (g) => `<div class="gate">
            <span class="dot ${g.pass ? 'pass' : 'open'}"></span>
            <div>
              <h3 style="margin:0">${esc(g.title)}</h3>
              <p><strong>measured:</strong> ${esc(g.machine)}</p>
              ${g.pass ? '' : `<p><strong>to close:</strong> ${esc(g.blocker)}</p>`}
            </div>
          </div>`
        )
        .join('');
  } catch (err) { failed(el('gatelist'), err); }

  try {
    const flags = await HT.get('/api/v1/knowledge/red-flags');
    el('flags').innerHTML = flags.rules
      .map(
        (f) => `<div class="source"><div class="row" style="justify-content:space-between">
          <strong style="color:var(--paper);font-weight:400">${esc(f.text)}</strong>
          <span class="chip${f.level === 'emergency' ? ' warn' : ''}">${esc(f.level)} · ${f.concept_groups} concept groups</span></div></div>`
      )
      .join('');
  } catch (err) { failed(el('flags'), err); }

  try {
    const s = await HT.get('/api/v1/evidence');
    el('sourcelist').innerHTML = s.sources
      .sort((a, b) => a.tier - b.tier)
      .map(
        (src) => `<div class="source">
          <div class="row" style="justify-content:space-between;align-items:baseline">
            <h3 style="margin:0">${esc(src.title)}</h3><span class="chip">Tier ${src.tier}</span>
          </div>
          <p style="font-size:.88rem;color:var(--mist);margin:.3rem 0">${esc(src.publisher)} · ${esc(src.type)}</p>
          <a href="${src.url}" target="_blank" rel="noopener">${esc(src.url)}</a>
        </div>`
      )
      .join('');
  } catch (err) { failed(el('sourcelist'), err); }

  try {
    const spec = await HT.get('/api/v1/openapi.json');
    const rows = [];
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        rows.push({ path, method: method.toUpperCase(), tag: (op.tags || [])[0] || '', summary: op.summary || '' });
      }
    }
    rows.sort((a, b) => a.tag.localeCompare(b.tag) || a.path.localeCompare(b.path));
    el('endpoints').innerHTML = rows
      .map(
        (r) => `<div class="metric" style="align-items:flex-start">
          <span style="flex:1">
            <code style="color:var(--signal-deep);font-size:.85rem">${esc(r.method)} /api/v1${esc(r.path)}</code>
            <br><span style="font-size:.86rem">${esc(r.summary)}</span>
          </span>
          <span class="chip">${esc(r.tag)}</span>
        </div>`
      )
      .join('');
  } catch (err) { failed(el('endpoints'), err); }

  try {
    const c = await HT.get('/api/v1/knowledge/conditions');
    el('conditions').innerHTML = c.conditions
      .map(
        (x) => `<div class="card"><h3>${esc(x.name)}</h3>
        <p style="margin-top:.5rem">${esc(x.specialty)}</p>
        <p style="margin-top:.6rem"><span class="chip${x.urgency === 'emergency' ? ' warn' : ''}">${esc(x.urgency)}</span></p></div>`
      )
      .join('');
  } catch (err) { failed(el('conditions'), err); }
});
