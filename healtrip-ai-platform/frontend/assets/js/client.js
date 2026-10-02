/* HealTrip API client.
 *
 * One place that knows how to reach the service. No other file builds a URL, so
 * a deployment change is one line here instead of a hunt through six modules.
 *
 * Base URL, in order:
 *   1. window.HEALTRIP_API, if a deployment sets it in config.js
 *   2. same origin, which is the normal case: the service serves the pages
 *   3. http://localhost:4000, for the case where someone runs the pages from a
 *      separate static server during development
 *
 * Errors never reach a person as a status code or a stack. Each one is mapped
 * to a plain sentence and a flag saying whether retrying is worth it.
 */

const HealTripAPI = (() => {
  const TIMEOUT_MS = 20000;
  let base = null;
  let online = true;
  const listeners = [];

  const configured = () =>
    typeof window !== 'undefined' && window.HEALTRIP_API !== undefined && window.HEALTRIP_API !== null
      ? String(window.HEALTRIP_API).replace(/\/$/, '')
      : null;

  async function probe(candidate) {
    try {
      const r = await fetch(`${candidate}/api/v1/health`, { cache: 'no-store' });
      return r.ok;
    } catch (_) {
      return false;
    }
  }

  async function resolveBase() {
    if (base !== null) return base;
    const fixed = configured();
    if (fixed !== null) {
      base = fixed;
      return base;
    }
    if (await probe('')) {
      base = '';
      return base;
    }
    if (await probe('http://localhost:4000')) {
      base = 'http://localhost:4000';
      return base;
    }
    base = '';
    return base;
  }

  /** A failure a person can read, plus what the interface should do about it. */
  class ApiError extends Error {
    constructor(kind, messageKey, status = 0, detail = null) {
      super(messageKey);
      this.kind = kind;            // network | unavailable | auth | validation | ratelimit | server | notfound
      this.messageKey = messageKey; // a key in the locale bundle
      this.status = status;
      this.detail = detail;        // for the technical console only, never shown to a patient
      this.retryable = ['network', 'unavailable', 'server', 'ratelimit'].includes(kind);
    }
  }

  function classify(status, body) {
    if (status === 401 || status === 403) return new ApiError('auth', 'uiErrors.session', status, body);
    if (status === 400 || status === 422) return new ApiError('validation', 'uiErrors.validation', status, body);
    if (status === 404) return new ApiError('notfound', 'uiErrors.notFound', status, body);
    if (status === 429) return new ApiError('ratelimit', 'uiErrors.rateLimit', status, body);
    if (status >= 500) return new ApiError('server', 'uiErrors.server', status, body);
    return new ApiError('server', 'uiErrors.server', status, body);
  }

  function setOnline(value) {
    if (online === value) return;
    online = value;
    listeners.forEach((fn) => {
      try { fn(online); } catch (_) { /* a listener must not break a request */ }
    });
  }

  async function request(path, options = {}) {
    const root = await resolveBase();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || TIMEOUT_MS);

    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
    headers['Accept-Language'] = (window.HT && HT.lang) || 'en';
    const token = localStorage.getItem('healtrip_token');
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(root + path, { ...options, headers, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      setOnline(false);
      throw new ApiError(err.name === 'AbortError' ? 'unavailable' : 'network', err.name === 'AbortError' ? 'uiErrors.slow' : 'uiErrors.network');
    }
    clearTimeout(timer);
    setOnline(true);

    let body = null;
    try {
      body = await response.json();
    } catch (_) {
      body = null;
    }
    if (!response.ok) throw classify(response.status, body);
    return body;
  }

  return {
    ApiError,
    base: resolveBase,
    reset() { base = null; },
    onConnectionChange(fn) { listeners.push(fn); },
    isOnline: () => online,
    async available() {
      try {
        await request('/api/v1/health');
        return true;
      } catch (_) {
        return false;
      }
    },
    get: (path, options) => request(path, options),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    del: (path, options) => request(path, { ...options, method: 'DELETE' }),
    async text(path, options = {}) {
      const root = await resolveBase();
      const r = await fetch(root + path, options);
      if (!r.ok) throw classify(r.status, null);
      return r.text();
    },
  };
})();

window.HealTripAPI = HealTripAPI;
