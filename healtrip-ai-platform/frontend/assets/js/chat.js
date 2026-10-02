/* HealTrip AI assistant: account, persistent conversation, message list */

const $ = (id) => document.getElementById(id);
let conversationId = null;

const TEXT = {
  en: {
    welcome:
      'Welcome. I can explain your saved records, a term in a report, or help you prepare questions for your appointment. I do not diagnose or prescribe. For symptoms, open the assessment console.',
    thinking: 'Thinking…',
    signedOut: 'Sign out',
  },
  ar: {
    welcome:
      'أهلًا. أستطيع شرح سجلاتك المحفوظة أو مصطلح في تقرير أو مساعدتك في تجهيز أسئلة لموعدك. لا أشخّص ولا أصف علاجًا. وللأعراض، افتحي واجهة التقييم.',
    thinking: 'جارٍ التفكير…',
    signedOut: 'تسجيل الخروج',
  },
};
const L = () => TEXT[HT.lang === 'ar' ? 'ar' : 'en'];

function showChat() {
  $('login').style.display = 'none';
  $('chatbox').style.display = '';
}

function addMessage(role, text, meta) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `<div>${HT.escape(text)}</div>${meta ? `<div class="meta">${HT.escape(meta)}</div>` : ''}`;
  $('messages').appendChild(div);
  $('messages').scrollTop = $('messages').scrollHeight;
  return div;
}

async function openConversation() {
  const list = await HT.get('/api/chat/conversations');
  conversationId = list.conversations?.[0]?.id;
  if (!conversationId) {
    const created = await HT.post('/api/chat/conversations', { title: 'HealTrip AI' });
    conversationId = created.conversation.id;
  }
  const history = await HT.get(`/api/chat/conversations/${conversationId}`);
  $('messages').innerHTML = '';
  if (history.messages?.length) {
    history.messages.forEach((m) => addMessage(m.role === 'user' ? 'user' : 'assistant', m.content));
  } else {
    addMessage('assistant', L().welcome);
  }
  showChat();
}

async function authenticate(mode) {
  const status = $('login').querySelector('.auth-status') || document.createElement('p');
  status.className = 'auth-status';
  status.style.cssText = 'font-size:.86rem;color:var(--alert);margin-top:.8rem';
  $('login').appendChild(status);
  try {
    const data = await HT.post(`/api/auth/${mode}`, {
      email: $('email').value.trim(),
      password: $('password').value,
    });
    HT.setToken(data.token);
    await openConversation();
  } catch (err) {
    status.textContent = HT.explain(err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (HT.token()) {
    try {
      await openConversation();
    } catch (_) {
      HT.clearToken();
    }
  }

  $('register').addEventListener('click', () => authenticate('register'));
  $('signin').addEventListener('click', () => authenticate('login'));

  $('chat-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = $('message').value.trim();
    if (!text) return;
    $('message').value = '';
    addMessage('user', text);
    const pending = addMessage('assistant', HT.tr('agent.thinking') || L().thinking);
    try {
      const data = await HT.post('/api/v1/agent/chat', {
        message: text,
        language: HT.lang,
        conversation_id: conversationId || undefined,
      });
      pending.remove();
      const node = addMessage(
        'assistant',
        data.message,
        data.tool_calls.map((t) => `${t.name}: ${t.status}`).join(' · ')
      );
      if (data.trace?.length) {
        const details = document.createElement('details');
        details.style.cssText = 'margin:-.4rem 0 1rem;font-size:.82rem;color:var(--mist)';
        details.innerHTML =
          `<summary style="cursor:pointer">${HT.escape(HT.tr('agent.traceTitle'))}</summary>` +
          data.trace
            .map((s) => {
              const label = HT.tr(`agent.steps.${s.type}`);
              const name = label === `agent.steps.${s.type}` ? s.type.replace(/_/g, ' ') : label;
              const detail = Object.entries(s)
                .filter(([k]) => !['step', 'type', 'at'].includes(k))
                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                .join(' · ');
              return `<div>${s.step}. ${HT.escape(name)}${detail ? ` — ${HT.escape(detail)}` : ''}</div>`;
            })
            .join('');
        node.after(details);
      }
    } catch (err) {
      pending.remove();
      addMessage('assistant', HT.explain(err));
    }
  });
});
