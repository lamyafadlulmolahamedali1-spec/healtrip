/* HealTrip core: language, session, shared chrome.
 *
 * Network access goes through HealTripAPI (assets/js/api.js). Nothing in this
 * file, or in any page module, builds a URL or reads a status code.
 */

const HT = {
  lang: localStorage.getItem('healtrip.lang') || 'en',
};

HT.token = () => localStorage.getItem('healtrip_token');
HT.setToken = (t) => localStorage.setItem('healtrip_token', t);
HT.clearToken = () => localStorage.removeItem('healtrip_token');

/** Turns any failure into a sentence a patient can act on. */
HT.explain = function (err) {
  const key = err && err.messageKey ? err.messageKey : 'uiErrors.server';
  const text = HT.tr(key);
  return text === key ? HT.tr('uiErrors.server') : text;
};

HT.request = (path, options) => HealTripAPI.get(path, options);
HT.get = (path) => HealTripAPI.get(path);
HT.post = (path, body) => HealTripAPI.post(path, body);
HT.put = (path, body) => HealTripAPI.put(path, body);
HT.del = (path) => HealTripAPI.del(path);
HT.resolveApi = () => HealTripAPI.base();

HT.escape = (s) =>
  String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/* ---------------- API availability banner ---------------- */

/**
 * The most common way to see a broken page is to open the site without starting
 * the API. Rather than scattering "service unreachable" through every panel, say
 * it once, at the top, with the command that fixes it.
 */
HT.showApiBanner = function () {
  if (document.getElementById('healtrip-api-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'healtrip-api-banner';
  bar.setAttribute('role', 'status');
  bar.className = 'connection-bar';
  bar.innerHTML = `<span>${HT.escape(HT.tr('uiErrors.offlineBanner'))}</span>
    <button class="btn btn-ghost" type="button" id="healtrip-retry" style="padding:.35rem 1rem;font-size:.85rem">${HT.escape(HT.tr('common.retry'))}</button>`;
  document.body.insertBefore(bar, document.body.firstChild);
  document.getElementById('healtrip-retry').addEventListener('click', () => {
    HealTripAPI.reset();
    HT.checkApi().then((ok) => { if (ok) location.reload(); });
  });
};

HT.hideApiBanner = function () {
  document.getElementById('healtrip-api-banner')?.remove();
};

/** One quiet check per page load. No status codes, no endpoint names. */
HT.checkApi = async function () {
  const ok = await HealTripAPI.available();
  if (ok) HT.hideApiBanner();
  else HT.showApiBanner();
  return ok;
};

/* ---------------- locale bundles ---------------- */
HT.bundle = null;

/** Loads the same locale file the API uses, so a string exists in one place. */
HT.loadLocale = async function (lang = HT.lang) {
  try {
    const r = await fetch(`locales/${lang}.json`, { cache: 'no-store' });
    if (r.ok) { HT.bundle = await r.json(); return HT.bundle; }
  } catch (_) { /* the service copy is the fallback */ }
  try {
    HT.bundle = await HT.get(`/api/v1/locales/${lang}`);
  } catch (_) {
    HT.bundle = HT.bundle || null;
  }
  return HT.bundle;
};

/** tr('assessment.why') resolves against the loaded bundle. */
HT.tr = function (key, vars = {}) {
  const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), HT.bundle || {});
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, n) => (vars[n] === undefined ? `{${n}}` : vars[n]));
};

/** Elements marked data-i18n take their text from the bundle. */
HT.applyBundle = function () {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const text = HT.tr(node.dataset.i18n);
    if (text === node.dataset.i18n) return;
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') node.placeholder = text;
    else node.textContent = text;
  });
};

/* ---------------- language ---------------- */
HT.t = function () {
  const key = HT.lang === 'ar' ? 'ar' : 'en';
  document.querySelectorAll('[data-en]').forEach((node) => {
    const val = node.dataset[key];
    if (val === undefined) return;
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') node.placeholder = val;
    else node.textContent = val;
  });
  document.documentElement.lang = key;
  document.documentElement.dir = key === 'ar' ? 'rtl' : 'ltr';
  const btn = document.querySelector('.lang');
  if (btn) btn.textContent = key === 'ar' ? 'English' : 'العربية';
  window.dispatchEvent(new CustomEvent('healtrip:lang', { detail: { lang: key } }));
};

HT.setLang = async function (lang) {
  HT.lang = lang;
  localStorage.setItem('healtrip.lang', lang);
  await HT.loadLocale(lang);
  HT.t();
  HT.applyBundle();
};

/* ---------------- chrome ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const langBtn = document.querySelector('.lang');
  if (langBtn) langBtn.addEventListener('click', () => HT.setLang(HT.lang === 'ar' ? 'en' : 'ar'));

  const menu = document.querySelector('.menu-btn');
  if (menu) menu.addEventListener('click', () => document.querySelector('.nav').classList.toggle('open'));

  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
  });

  HT.t();
  HT.loadLocale().then(() => HT.applyBundle());
  HT.checkApi();
});

window.HT = HT;
