/* HealTrip patient profile: identity, records, voice notes */

const $ = (id) => document.getElementById(id);
const esc = (s) => HT.escape(s);

const TEXT = {
  en: {
    saved: 'Profile saved.',
    added: 'Added to your record.',
    empty: 'No records yet. Anything you add is stored as patient-reported.',
    reported: 'patient reported',
    verified: 'confirmed by a clinician',
    noVoice: 'Voice transcription is not available in this browser. Type the note instead.',
    listening: 'Listening. Speak now.',
    signIn: 'Sign in on the AI assistant page to open your profile.',
    delete: 'Delete',
  },
  ar: {
    saved: 'تم حفظ الملف.',
    added: 'أُضيف إلى سجلك.',
    empty: 'لا توجد سجلات بعد. وكل ما تضيفينه يُحفظ كمُبلَّغ من المريض.',
    reported: 'مُبلَّغ من المريض',
    verified: 'مؤكَّد من طبيب',
    noVoice: 'التفريغ الصوتي غير متاح في هذا المتصفح. اكتبي الملاحظة بدلًا من ذلك.',
    listening: 'يستمع الآن. تحدثي.',
    signIn: 'سجّلي الدخول من صفحة المساعد لفتح ملفك.',
    delete: 'حذف',
  },
};
const L = () => TEXT[HT.lang === 'ar' ? 'ar' : 'en'];

function renderRecords(records) {
  if (!records || !records.length) {
    $('records').innerHTML = `<p style="color:var(--mist)">${L().empty}</p>`;
    return;
  }
  $('records').innerHTML = `<div class="grid grid-2">${records
    .map((r) => {
      const content =
        typeof r.content === 'object' && r.content !== null
          ? Object.entries(r.content)
              .map(([k, v]) => `${esc(k.replace(/_/g, ' '))}: ${esc(v)}`)
              .join('<br>')
          : esc(r.content);
      return `<article class="card">
        <h3>${esc(r.title || r.record_type)}</h3>
        <p style="color:var(--mist-2)">${content}</p>
        <p style="margin-top:.9rem">
          <span class="chip">${esc(r.record_type.replace(/_/g, ' '))}</span>
          <span class="chip ${r.verified ? 'ok' : 'warn'}">${r.verified ? L().verified : L().reported}</span>
        </p>
      </article>`;
    })
    .join('')}</div>`;
}

function fillProfile(profile) {
  $('full_name').value = profile?.full_name || '';
  $('country').value = profile?.country || '';
  $('city').value = profile?.city || '';
  $('date_of_birth').value = (profile?.date_of_birth || '').slice(0, 10);
  $('preferred_language').value = profile?.preferred_language || HT.lang;
}

async function load() {
  const data = await HT.get('/api/profile');
  fillProfile(data.profile);
  renderRecords(data.records);
}

function setupVoice() {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('voice-record');
  if (!btn) return;
  if (!Rec) {
    btn.disabled = true;
    btn.title = L().noVoice;
    return;
  }
  const recog = new Rec();
  recog.interimResults = true;
  recog.onresult = (e) => {
    const text = Array.from(e.results)
      .map((r) => r[0].transcript)
      .join(' ');
    $('record_content').value = text;
    if (e.results[e.results.length - 1].isFinal) {
      btn.dataset.on = 'false';
      $('record_type').value = 'note';
    }
  };
  recog.onend = () => {
    btn.dataset.on = 'false';
  };
  btn.addEventListener('click', () => {
    recog.lang = HT.lang === 'ar' ? 'ar-SA' : 'en-GB';
    $('record-status').textContent = L().listening;
    try {
      recog.start();
      btn.dataset.on = 'true';
    } catch (_) {
      /* already running */
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setupVoice();

  if (!HT.token()) {
    $('records').innerHTML = `<p>${L().signIn} <a href="chat.html" style="color:var(--signal-deep)">chat.html</a></p>`;
    document.querySelectorAll('#profile-form button, #record-form button').forEach((b) => (b.disabled = true));
    return;
  }

  try {
    await load();
  } catch (err) {
    $('records').innerHTML = `<p>${esc(HT.explain(err))}</p>`;
  }

  $('profile-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await HT.put('/api/profile', {
        full_name: $('full_name').value,
        country: $('country').value,
        city: $('city').value,
        date_of_birth: $('date_of_birth').value || undefined,
        preferred_language: $('preferred_language').value,
      });
      $('profile-status').textContent = L().saved;
    } catch (err) {
      $('profile-status').textContent = HT.explain(err);
    }
  });

  $('record-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await HT.post('/api/profile/records', {
        record_type: $('record_type').value,
        title: $('record_title').value || $('record_type').value,
        content: { details: $('record_content').value },
        verified: false,
      });
      $('record-status').textContent = L().added;
      $('record_title').value = '';
      $('record_content').value = '';
      await load();
    } catch (err) {
      $('record-status').textContent = HT.explain(err);
    }
  });
});

window.addEventListener('healtrip:lang', () => {
  if (HT.token()) load().catch(() => {});
});
