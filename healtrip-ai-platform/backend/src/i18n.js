'use strict';

/**
 * Internationalisation for the API.
 *
 * One set of locale files at the repository root serves both the API and the
 * interface, so a string never exists twice. The clinical logic does not read
 * these files: language changes what a person is shown, never which rule fires,
 * which question is chosen, or how a candidate is ranked.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', '..', 'locales');
const SUPPORTED = ['en', 'ar'];

const BUNDLES = Object.fromEntries(
  SUPPORTED.map((code) => [code, JSON.parse(fs.readFileSync(path.join(DIR, `${code}.json`), 'utf8'))])
);

/** Accept-Language, then ?lang=, then the body's lang field, then English. */
function negotiate(req) {
  const explicit = (req.query?.lang || req.body?.lang || '').toString().toLowerCase();
  if (SUPPORTED.includes(explicit)) return explicit;

  const header = (req.headers?.['accept-language'] || '').toLowerCase();
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.split('-')[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const hit = ranked.find((r) => SUPPORTED.includes(r.tag));
  return hit ? hit.tag : 'en';
}

function t(lang, key, vars = {}) {
  const bundle = BUNDLES[SUPPORTED.includes(lang) ? lang : 'en'];
  const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : vars[name]));
}

function direction(lang) {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/** Attaches req.lang, req.t and the Content-Language header to every response. */
function middleware(req, res, next) {
  req.lang = negotiate(req);
  req.t = (key, vars) => t(req.lang, key, vars);
  res.set('Content-Language', req.lang);
  res.set('Vary', 'Accept-Language');
  next();
}

/** Every v1 response body carries its locale so a client never has to guess. */
function envelope(req, payload) {
  return { locale: req.lang, direction: direction(req.lang), ...payload };
}

function fail(req, res, status, key, extra = {}) {
  return res.status(status).json(envelope(req, { error: req.t(key), error_key: key, ...extra }));
}

module.exports = { SUPPORTED, BUNDLES, negotiate, t, direction, middleware, envelope, fail };
