'use strict';

/**
 * Printable clinical navigation summary, English or Arabic, RTL where needed.
 * Served as HTML so the person's own browser produces the PDF; no server-side
 * font stack has to be shipped to render Arabic correctly.
 */

const i18n = require('../i18n');

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

function render({ lang = 'en', id, summary, doctors = [] }) {
  const t = (k) => i18n.t(lang, k);
  const rtl = lang === 'ar';
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 16);

  const section = (title, body) => `<section><h2>${esc(title)}</h2>${body}</section>`;
  const list = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

  const explanations = summary.differential.length
    ? summary.differential
        .map(
          (d) => `<article class="cand">
            <h3>${esc(d.name)} <span>${d.compatibility}%</span></h3>
            <p>${esc(d.explanation)}</p>
            <h4>${esc(t('report.distinguishing'))}</h4>
            ${list(d.discriminators)}
            <h4>${esc(t('assessment.clinician'))}</h4>
            ${list(d.investigations)}
            <p class="src">${esc(t('report.evidence'))}: ${d.sources.map((s) => `${esc(s.publisher)} — ${esc(s.title)} (${esc(s.url)})`).join(' · ')}</p>
          </article>`
        )
        .join('')
    : `<p>${esc(t('common.none'))}</p>`;

  const next = summary.nextEvaluations || { status: 'no_supported_evaluation', evaluations: [], preparation: [], limitations: [] };
  const evaluationBlocks = next.evaluations.length
    ? next.evaluations
        .map(
          (e) => `<article class="cand">
            <h3>${esc(e.name)} <span>${esc(e.type)}</span></h3>
            <h4>${esc(t('evaluations.why'))}</h4><p>${esc(e.why)}</p>
            <h4>${esc(t('evaluations.question'))}</h4><p>${esc(e.clinical_question)}</p>
            <h4>${esc(t('evaluations.expect'))}</h4><p>${esc(e.what_to_expect)}</p>
            <h4>${esc(t('evaluations.prepare'))}</h4><p>${esc(e.preparation || t('evaluations.noPrep'))}</p>
            <h4>${esc(t('evaluations.practical'))}</h4><p>${esc(e.practical)}</p>
            <p class="src">${esc(t('report.evidence'))}: ${e.evidence.map((x) => `${esc(x.publisher)} — ${esc(x.title)} (${esc(x.url)})`).join(' · ')}</p>
          </article>`
        )
        .join('')
    : `<p>${esc(next.note || '')}</p>`;

  const providerRows = doctors.length
    ? `<table><thead><tr>
        <th>${esc(t('providers.certificates'))}</th><th>${esc(t('providers.hospital'))}</th>
        <th>${esc(t('providers.location'))}</th><th>${esc(t('providers.status'))}</th></tr></thead><tbody>
        ${doctors
          .slice(0, 6)
          .map(
            (d) => `<tr><td>${esc(d.full_name)} — ${esc(d.specialty)}<br><small>${esc(d.qualifications || '')}</small></td>
            <td>${esc(d.organization || '')}</td><td>${esc(d.city || '')}, ${esc(d.country || '')}</td>
            <td>${esc(d.source)} · ${esc(d.license_status)}</td></tr>`
          )
          .join('')}
      </tbody></table>`
    : `<p>${esc(t('errors.noProviders'))}</p>`;

  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t('report.title'))} — HealTrip</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: ${rtl ? "'IBM Plex Sans Arabic', 'Segoe UI'" : "'Inter', 'Segoe UI'"}, system-ui, sans-serif;
         color: #3a3f37; line-height: 1.7; max-width: 800px; margin: 0 auto; padding: 24px; background: #fff; }
  header { border-bottom: 2px solid #7d9478; padding-bottom: 14px; margin-bottom: 20px; }
  h1 { font-family: Georgia, serif; font-weight: 500; color: #23281f; margin: 0 0 6px; font-size: 26px; }
  h2 { font-family: Georgia, serif; font-weight: 500; color: #23281f; font-size: 17px; margin: 22px 0 8px; }
  h3 { font-size: 15px; margin: 0 0 4px; color: #23281f; display: flex; justify-content: space-between; gap: 12px; }
  h3 span { color: #5f7659; }
  h4 { font-size: 12px; color: #6e7568; margin: 12px 0 2px; font-weight: 600; }
  .meta { font-size: 12px; color: #6e7568; }
  .urgency { display: inline-block; border: 1px solid #e2dbcb; border-radius: 999px; padding: 3px 12px; font-size: 12px; }
  .urgency.emergency { border-color: #be5a44; color: #be5a44; background: #f6e4de; }
  .cand { border: 1px solid #e2dbcb; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; break-inside: avoid; }
  .src { font-size: 11px; color: #6e7568; word-break: break-all; }
  ul { margin: 4px 0; padding-inline-start: 20px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: ${rtl ? 'right' : 'left'}; border-bottom: 1px solid #e2dbcb; padding: 7px 6px; vertical-align: top; }
  th { color: #6e7568; font-weight: 600; }
  .limits { border-inline-start: 3px solid #be5a44; padding-inline-start: 12px; font-size: 12px; color: #6e7568; margin-top: 24px; }
  .print { margin: 20px 0; }
  button { font: inherit; background: #7d9478; color: #fff; border: 0; border-radius: 999px; padding: 10px 20px; cursor: pointer; }
  @media print { .print { display: none; } }
</style>
</head>
<body>
<header>
  <h1>${esc(t('report.title'))}</h1>
  <div class="meta">HealTrip &middot; ${esc(t('report.assessmentId'))}: ${esc(id)} &middot; ${esc(t('report.generated'))}: ${generated}</div>
</header>

<div class="print"><button onclick="window.print()">${esc(t('common.print'))}</button></div>

${section(t('report.reported'), list(summary.reported))}
${section(t('report.answered'), summary.answers.length ? list(summary.answers.map((a) => `${a.field.replace(/_/g, ' ')}: ${a.answer}`)) : `<p>${esc(t('common.none'))}</p>`)}
${section(t('report.safety'), `<p><span class="urgency ${summary.urgency === 'emergency' ? 'emergency' : ''}">${esc(summary.urgency)}</span></p>
  ${summary.redFlags.length ? list(summary.redFlags) : ''}`)}
${section(t('report.next'), `<p>${esc(summary.advice)}</p><p class="meta">${esc(t('assessment.specialty'))}: ${esc(summary.specialty)}</p>`)}
${section(t('report.explanations'), explanations)}
${summary.stillUnknown.length ? section(t('assessment.stillUnknown'), list(summary.stillUnknown)) : ''}
${section(t('evaluations.title'), evaluationBlocks + `<p class="meta">${esc(next.note || '')}</p>`)}
${section(t('evaluations.visitPrep'), list(next.preparation || []))}
${section(t('evaluations.reassurance'), `<p>${esc(next.reassurance || '')}</p>`)}
${section(t('report.providers'), providerRows)}

<div class="limits">
  <strong>${esc(t('report.limits'))}</strong><br>
  ${esc(summary.disclaimer)}<br>${esc(t('report.limitsBody'))}
</div>
</body>
</html>`;
}

module.exports = { render };
