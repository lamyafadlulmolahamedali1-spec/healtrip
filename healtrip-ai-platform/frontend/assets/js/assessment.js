/* HealTrip assessment console.
 *
 * Patient-facing only. Nothing here shows a score, a rule id, an endpoint or a
 * status code. The conversation is the product; the machinery stays in the
 * technical console.
 */

const el = (id) => document.getElementById(id);
const esc = (s) => HT.escape(s);
const tr = (key) => HT.tr(key);

let sessionId = null;
let turn = null;             // the voice turn manager
let speaking = localStorage.getItem('healtrip.voice') !== 'off';
let lastSubmission = '';     // kept so a failure never costs the person their words
let closingAsked = false;

/* ---------------- conversation rendering ---------------- */

function addTurn(who, text, why) {
  const div = document.createElement('div');
  div.className = `turn ${who === 'me' ? 'me' : ''}`;
  div.innerHTML = `<div class="who">${who === 'me' ? esc(tr('assessment.you')) : 'HealTrip'}</div>
    <div class="what">${esc(text)}</div>
    ${why ? `<div class="why"><strong>${esc(tr('assessment.why'))}:</strong> ${esc(why)}</div>` : ''}`;
  el('thread').appendChild(div);
  div.scrollIntoView({ block: 'nearest' });
  return div;
}

function showThinking(key = 'loading.assessment') {
  const div = document.createElement('div');
  div.className = 'turn';
  div.id = 'thinking';
  div.innerHTML = `<p class="loading" style="margin:0">${esc(tr(key))}</p>`;
  el('thread').appendChild(div);
  div.scrollIntoView({ block: 'nearest' });
}

const clearThinking = () => el('thinking')?.remove();

function showRetry(message) {
  clearThinking();
  const div = document.createElement('div');
  div.className = 'alert-panel';
  div.innerHTML = `<p style="margin:0 0 .8rem">${esc(message)}</p>
    <p style="margin:0 0 .8rem;font-size:.88rem">${esc(tr('uiErrors.inputKept'))}</p>
    <button class="btn btn-ghost" type="button" id="retry-turn">${esc(tr('common.retry'))}</button>`;
  el('thread').appendChild(div);
  el('retry-turn').addEventListener('click', () => {
    div.remove();
    submitText(lastSubmission, true);
  });
  div.scrollIntoView({ block: 'nearest' });
}

function renderState(raw) {
  const u = { symptoms: [], answered: [], stillUnknown: [], ...(raw || {}) };
  const rows = [];
  if (u.symptoms.length) {
    rows.push(`<div class="state-row"><span>${esc(tr('assessment.reported'))}</span><span>${u.symptoms.map((s) => esc(s.label)).join('<br>')}</span></div>`);
  }
  for (const a of u.answered) {
    rows.push(`<div class="state-row"><span>${esc(a.field.replace(/_/g, ' '))}</span><span>${esc(a.value)}</span></div>`);
  }
  el('state').innerHTML = rows.length
    ? rows.join('')
    : `<p style="color:var(--mist);margin:0">${esc(tr('common.none'))}</p>`;
}

function renderShortlist(list) {
  if (!list || !list.length) {
    el('shortlist').innerHTML = '';
    el('shortlist-label').style.display = 'none';
    return;
  }
  el('shortlist-label').style.display = '';
  el('shortlist').innerHTML = list
    .map((c) => `<div class="cand"><div class="cand-top"><span>${esc(c.name)}</span></div><div class="bar"><i style="width:${c.compatibility}%"></i></div></div>`)
    .join('');
}

/** Plain words for how soon to seek care. No internal level names. */
const URGENCY_WORDS = {
  emergency: { en: 'Seek care now', ar: 'اطلبي الرعاية الآن' },
  urgent: { en: 'Be seen today', ar: 'راجعي طبيبًا اليوم' },
  soon: { en: 'Be seen soon', ar: 'راجعي قريبًا' },
  routine: { en: 'Routine', ar: 'اعتيادي' },
  support: { en: 'Support', ar: 'دعم' },
};

function setUrgency(level) {
  const node = el('urgency');
  node.dataset.level = level;
  const words = URGENCY_WORDS[level] || URGENCY_WORDS.routine;
  node.textContent = HT.lang === 'ar' ? words.ar : words.en;
}

function renderQuestion(p) {
  setUrgency(p.urgency);
  el('progress').textContent = `${tr('assessment.progress')}: ${p.progress.answered} / ${p.progress.target}`;
  addTurn('ht', p.question.text, p.question.why);
  speak(p.question.text);

  const box = document.createElement('div');
  box.className = 'opts';
  p.question.options.forEach((o) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.type = 'button';
    b.textContent = o.label;
    b.addEventListener('click', () => {
      addTurn('me', o.label);
      box.remove();
      send({ question_id: p.question.id, value: o.value });
    });
    box.appendChild(b);
  });
  el('thread').appendChild(box);
  box.scrollIntoView({ block: 'nearest' });
}

function renderEmergency(p) {
  setUrgency('emergency');
  const flags = (p.redFlags || []).map((f) => `<li>${esc(f.text)}</li>`).join('');
  el('thread').insertAdjacentHTML(
    'beforeend',
    `<div class="alert-panel"><h3>${esc(tr('safety.emergencyHeading'))}</h3>
      <p>${esc(p.message)}</p><ul style="font-size:.9rem">${flags}</ul></div>`
  );
  speak(p.message);
  el('composer').style.display = 'none';
  turn?.stop();
}

function renderSupport(p) {
  setUrgency('support');
  el('thread').insertAdjacentHTML(
    'beforeend',
    `<div class="alert-panel"><h3>${esc(tr('safety.supportHeading'))}</h3><p>${esc(p.message)}</p></div>`
  );
  el('composer').style.display = 'none';
  turn?.stop();
}

/* ---------------- what a clinician may consider ---------------- */

function renderEvaluations(next) {
  const t = (k) => tr(`evaluations.${k}`);
  if (!next || next.status === 'safety_override') return '';
  const cards = next.evaluations.length
    ? next.evaluations
        .map(
          (e) => `<article class="card" style="margin-bottom:1rem">
            <div class="cand-top"><h3 style="margin:0">${esc(e.name)}</h3><span class="chip">${esc(e.type)}</span></div>
            <h4 class="mini">${esc(t('why'))}</h4><p>${esc(e.why)}</p>
            <h4 class="mini">${esc(t('question'))}</h4><p>${esc(e.clinical_question)}</p>
            <h4 class="mini">${esc(t('expect'))}</h4><p>${esc(e.what_to_expect)}</p>
            <h4 class="mini">${esc(t('prepare'))}</h4><p>${esc(e.preparation || t('noPrep'))}</p>
            <h4 class="mini">${esc(t('practical'))}</h4><p>${esc(e.practical)}</p>
            <p style="font-size:.82rem;margin:.6rem 0 0">${esc(t('evidence'))}: ${e.evidence
              .map((x) => `<a href="${x.url}" target="_blank" rel="noopener" style="color:var(--signal-deep)">${esc(x.publisher)}</a>`)
              .join(' · ')}</p>
            <p style="font-size:.82rem;color:var(--alert);margin:.6rem 0 0">${esc(t('notOrder'))}</p>
          </article>`
        )
        .join('')
    : `<p class="empty">${esc(next.note || tr('empty.evidence'))}</p>`;

  return `
    <h2 class="display" style="font-size:1.6rem;margin:2.4rem 0 1.2rem">${esc(t('title'))}</h2>
    ${cards}
    <div class="card" style="background:var(--slate-2)">
      <h3>${esc(t('visitPrep'))}</h3>
      <ul style="color:var(--mist-2);font-size:.92rem;margin:.6rem 0 0">${(next.preparation || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <h3 style="margin-top:1.2rem">${esc(t('reassurance'))}</h3>
      <p style="color:var(--mist-2)">${esc(next.reassurance || '')}</p>
      <h3 style="margin-top:1.2rem">${esc(t('important'))}</h3>
      <ul style="color:var(--mist);font-size:.88rem;margin:.4rem 0 0">${(next.limitations || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </div>`;
}

async function renderSummary(p) {
  const s = p.summary;
  setUrgency(s.urgency);
  el('composer').style.display = 'none';
  turn?.stop();
  addTurn('ht', p.message);
  speak(p.message);

  const cands = s.differential
    .map(
      (d) => `<article class="card" style="margin-bottom:1rem">
        <h3 style="margin:0">${esc(d.name)}</h3>
        <div class="bar" style="margin:.6rem 0 1rem"><i style="width:${d.compatibility}%"></i></div>
        <p style="margin-bottom:1rem">${esc(d.explanation)}</p>
        <h4 class="mini">${esc(tr('assessment.distinguish'))}</h4>
        <ul style="color:var(--mist);font-size:.9rem;margin-top:.3rem">${d.discriminators.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <p style="font-size:.82rem;margin-top:1rem">${esc(tr('assessment.sources'))}: ${d.sources
          .map((src) => `<a href="${src.url}" target="_blank" rel="noopener" style="color:var(--signal-deep)">${esc(src.publisher)}</a>`)
          .join(' · ')}</p>
      </article>`
    )
    .join('');

  el('result').innerHTML = `
    <h2 class="display" style="font-size:1.7rem;margin-bottom:1.2rem">${esc(tr('assessment.possible'))}</h2>
    ${cands || `<p class="empty">${esc(tr('empty.assessment'))}</p>`}
    <div class="card" style="border-color:var(--signal)">
      <h3>${esc(tr('assessment.pathway'))}</h3>
      <p style="color:var(--mist-2)">${esc(s.advice)}</p>
      <p style="font-size:.9rem">${esc(tr('assessment.specialty'))}: <strong style="color:var(--paper)">${esc(s.specialty)}</strong></p>
    </div>
    ${renderEvaluations(s.nextEvaluations)}
    <h3 style="margin-top:2rem">${esc(tr('assessment.doctors'))}</h3>
    <div id="matched" class="grid grid-2" style="margin-top:1rem"><p class="loading">${esc(tr('loading.providers'))}</p></div>
    <p class="legal" style="margin-top:2rem">${esc(s.disclaimer)}</p>
    <div class="row" style="margin-top:1.4rem">
      <button class="btn btn-primary" id="reportit">${esc(tr('assessment.report'))}</button>
      <button class="btn btn-ghost" id="printit">${esc(tr('common.print'))}</button>
      <button class="btn btn-ghost" id="delit">${esc(tr('assessment.delete'))}</button>
      <a class="btn btn-ghost" href="assessment.html">${esc(tr('assessment.restart'))}</a>
    </div>`;
  el('result').scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const docs = await HT.get(`/api/v1/doctors?specialty=${encodeURIComponent(s.specialty)}`);
    el('matched').innerHTML = docs.doctors.length
      ? docs.doctors
          .map(
            (d) => `<div class="provider"><h3>${esc(d.full_name)}</h3>
            <div class="spec">${esc(d.specialty)}${d.subspecialty ? ` · ${esc(d.subspecialty)}` : ''}</div>
            <dl><dt>${esc(tr('providers.location'))}</dt><dd>${esc(d.city)}, ${esc(d.country)}</dd>
            <dt>${esc(tr('providers.languages'))}</dt><dd>${(d.languages || []).map(esc).join(', ')}</dd>
            <dt>${esc(tr('providers.telemedicine'))}</dt><dd>${d.telemedicine ? esc(tr('providers.available')) : esc(tr('providers.notOffered'))}</dd></dl>
            <p style="margin-top:.9rem"><span class="chip warn">${esc(d.source)}</span></p></div>`
          )
          .join('')
      : `<p class="empty">${esc(tr('empty.providers'))}</p>`;
  } catch (err) {
    el('matched').innerHTML = `<p class="empty">${esc(tr('uiErrors.providersUnavailable'))}</p>`;
  }

  el('reportit').addEventListener('click', async () => {
    const base = await HT.resolveApi();
    window.open(`${base}/api/v1/assessments/${sessionId}/report?lang=${HT.lang}`, '_blank', 'noopener');
  });
  el('printit').addEventListener('click', () => window.print());
  el('delit').addEventListener('click', async () => {
    try {
      await HT.del(`/api/v1/assessments/${sessionId}`);
      el('result').innerHTML = `<p>${esc(tr('assessment.deleted'))}</p><a class="btn btn-primary" href="assessment.html">${esc(tr('assessment.restart'))}</a>`;
    } catch (err) {
      el('result').insertAdjacentHTML('afterbegin', `<p class="empty">${esc(HT.explain(err))}</p>`);
    }
  });
}

function renderClarify(p) {
  setUrgency('routine');
  addTurn('ht', p.message);
  speak(p.message);
  if (!p.examples || !p.examples.length) return;
  const box = document.createElement('div');
  box.className = 'opts';
  p.examples.forEach((example) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.type = 'button';
    b.textContent = example;
    b.addEventListener('click', () => {
      box.remove();
      submitText(example);
    });
    box.appendChild(b);
  });
  el('thread').appendChild(box);
}

function route(p) {
  clearThinking();
  sessionId = p.assessment_id || p.sessionId || sessionId;
  renderState(p.understood);
  renderShortlist(p.shortlist);
  if (p.type === 'emergency') return renderEmergency(p);
  if (p.type === 'support') return renderSupport(p);
  if (p.type === 'clarify') return renderClarify(p);
  if (p.type === 'question') return renderQuestion(p);
  if (p.type === 'summary') return renderSummary(p);
}

/* ---------------- sending ---------------- */

async function submitText(text, isRetry = false) {
  const value = (text || '').trim();
  if (value.length < 2) return;
  lastSubmission = value;
  if (!isRetry) addTurn('me', value);
  el('intake').value = '';
  el('interim').textContent = '';
  showThinking(sessionId ? 'loading.question' : 'loading.assessment');

  try {
    const payload = sessionId
      ? await HT.post(`/api/v1/assessments/${sessionId}/answers`, { message: value, language: HT.lang })
      : await HT.post('/api/v1/assessments', { message: value, language: HT.lang });
    route(payload);
  } catch (err) {
    el('intake').value = value; // never lose what the person typed or said
    showRetry(HT.explain(err));
  }
}

async function send(answer) {
  showThinking('loading.question');
  try {
    route(await HT.post(`/api/v1/assessments/${sessionId}/answers`, { ...answer, language: HT.lang }));
  } catch (err) {
    showRetry(HT.explain(err));
  }
}

/* ---------------- voice ---------------- */

function speak(text) {
  if (!speaking || !text) return;
  HealTripVoice.Speaker.speak(text, HT.lang);
}

function setVoiceState(state) {
  const map = {
    IDLE: 'voice.idle',
    LISTENING: 'voice.listening',
    SPEECH: 'voice.stillListening',
    PAUSE: 'voice.paused',
    FINALIZING: 'voice.processing',
  };
  el('voice-state-text').textContent = tr(map[state] || 'voice.idle');
  el('mic').dataset.state = state;
  el('mic').dataset.on = state === 'IDLE' ? 'false' : 'true';
  el('finish-turn').style.display = state === 'IDLE' ? 'none' : '';
}

function setupVoice() {
  if (!HealTripVoice.TurnManager.supported()) {
    el('mic').disabled = true;
    el('mic-note').textContent = tr('voice.unsupported');
    return;
  }

  el('mic').addEventListener('click', () => {
    // Barge-in: if the assistant is speaking, the person takes the floor.
    HealTripVoice.Speaker.stop();

    if (turn && turn.state !== 'IDLE') {
      turn.stop();
      setVoiceState('IDLE');
      return;
    }
    turn = new HealTripVoice.TurnManager({
      lang: HT.lang,
      onState: setVoiceState,
      onInterim: (text) => { el('interim').textContent = text; },
      onFinal: (text) => {
        el('interim').textContent = '';
        setVoiceState('IDLE');
        submitText(text);
      },
      onError: (kind) => {
        setVoiceState('IDLE');
        el('mic-note').textContent = tr(kind === 'unsupported' ? 'voice.unsupported' : 'voice.failed');
      },
    });
    turn.start();
    el('mic-note').textContent = '';
    if (!el('thread').children.length) addTurn('ht', tr('voice.openingPrompt'));
  });

  el('finish-turn').addEventListener('click', () => turn?.finishNow());
}

/* ---------------- boot ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  setupVoice();

  el('send').addEventListener('click', () => submitText(el('intake').value));
  el('intake').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitText(el('intake').value);
  });

  const setVoiceLabel = () => {
    el('voice-toggle').textContent = speaking
      ? (HT.lang === 'ar' ? 'الردود الصوتية: تعمل' : 'Voice replies: on')
      : (HT.lang === 'ar' ? 'الردود الصوتية: متوقفة' : 'Voice replies: off');
  };
  el('voice-toggle').addEventListener('click', () => {
    speaking = !speaking;
    localStorage.setItem('healtrip.voice', speaking ? 'on' : 'off');
    if (!speaking) HealTripVoice.Speaker.stop();
    setVoiceLabel();
  });
  setVoiceLabel();

  window.addEventListener('healtrip:lang', () => {
    setVoiceLabel();
    if (turn) turn.lang = HT.lang;
  });

  const seed = new URLSearchParams(location.search).get('q');
  if (seed) submitText(seed);
});
