/* HealTrip care network */

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const q = (id) => document.getElementById(id);
const has = (id) => Boolean(document.getElementById(id));

const SPECIALTIES = ['Cardiology', 'Dermatology', 'Endocrinology', 'ENT', 'Gastroenterology', 'General Practice', 'General Surgery', 'Internal Medicine', 'Neurology', 'Ophthalmology', 'Orthopaedics', 'Urology'];
const COUNTRIES = ['United Kingdom', 'Saudi Arabia', 'United Arab Emirates', 'Sudan', 'Egypt'];

function doctorCard(d) {
  const ar = HT.lang === 'ar';
  const verified = d.license_status === 'verified' && d.licensing_authority;
  const badge = verified
    ? `<span class="chip ok">${ar ? 'ترخيص متحقق منه' : 'Licence verified'} · ${esc(d.licensing_authority)}</span>`
    : `<span class="chip warn">${esc(d.source)} · ${ar ? 'الترخيص غير متحقق منه' : 'licence unverified'}</span>`;
  const certs = (d.certificates || []).length
    ? (d.certificates || []).map(esc).join(', ')
    : esc(d.qualifications || (ar ? 'غير مسجلة' : 'not recorded'));
  const email = d.contact_email
    ? `<a href="mailto:${esc(d.contact_email)}" style="color:var(--signal-deep)">${esc(d.contact_email)}</a> <span class="chip">${esc(d.contact_source || 'provided by the organisation')}</span>`
    : (ar ? 'غير منشور. لا يُعرض البريد إلا إذا قدمته الجهة وسمحت بنشره.' : 'Not published. Email is shown only when the organisation supplies it and permits publication.');
  return `<article class="provider">
    <h3>${esc(d.full_name)}</h3>
    <div class="spec">${esc(d.specialty)}${d.subspecialty ? ` · ${esc(d.subspecialty)}` : ''}</div>
    <dl>
      <dt>${ar ? 'الشهادات' : 'Certificates'}</dt><dd>${certs}</dd>
      <dt>${ar ? 'المستشفى' : 'Hospital'}</dt><dd>${esc(d.organization)}</dd>
      <dt>${ar ? 'الموقع' : 'Location'}</dt><dd>${esc(d.city)}, ${esc(d.country)}</dd>
      <dt>${ar ? 'اللغات' : 'Languages'}</dt><dd>${(d.languages || []).map(esc).join(', ')}</dd>
      <dt>${ar ? 'طب عن بُعد' : 'Telemedicine'}</dt><dd>${d.telemedicine ? (ar ? 'متاح' : 'Available') : (ar ? 'غير متاح' : 'Not offered')}</dd>
      <dt>${ar ? 'البريد' : 'Email'}</dt><dd>${email}</dd>
    </dl>
    <p style="margin-top:1rem">${badge}</p>
    <button class="btn btn-ghost" type="button" data-licence="${esc(d.id)}" style="padding:.5rem 1.1rem;font-size:.85rem">${ar ? 'تفاصيل الترخيص' : 'Licence details'}</button>
  </article>`;
}

async function search() {
  if (has('doctors')) q('doctors').innerHTML = `<p class="loading">${esc(HT.tr('loading.providers'))}</p>`;
  if (has('hospitals-list')) q('hospitals-list').innerHTML = `<p class="loading">${esc(HT.tr('loading.providers'))}</p>`;
  const params = new URLSearchParams();
  if (q('f-specialty').value) params.set('specialty', q('f-specialty').value);
  if (q('f-country').value) params.set('country', q('f-country').value);
  if (q('f-city').value.trim()) params.set('city', q('f-city').value.trim());
  if (has('f-language') && q('f-language').value) params.set('language', q('f-language').value);
  if (has('f-tele') && q('f-tele').checked) params.set('telemedicine', 'true');

  try {
    const data = has('doctors') ? await HT.get(`/api/v1/doctors?${params}`) : { count: 0, doctors: [] };
    if (has('count')) q('count').textContent = `${data.count} ${HT.tr('providers.results')}`;
    if (has('doctors')) q('doctors').innerHTML = data.doctors.length
      ? data.doctors.map(doctorCard).join('')
      : `<p class="empty">${esc(HT.tr('empty.providers'))}</p>`;

    const hp = new URLSearchParams();
    if (q('f-specialty').value) hp.set('specialty', q('f-specialty').value);
    if (q('f-country').value) hp.set('country', q('f-country').value);
    const hos = await HT.get(`/api/v1/hospitals?${hp}`);
    if (has('hospitals-list')) q('hospitals-list').innerHTML = hos.hospitals.length ? hos.hospitals
      .map(
        (h) => `<div class="provider"><h3>${esc(h.name)}</h3>
        <div class="spec">${esc(h.city)}, ${esc(h.country)}</div>
        <p style="font-size:.88rem;color:var(--mist);margin-top:.7rem">${(h.specialties || []).map(esc).join(' · ')}</p>
        <p style="margin-top:.8rem"><span class="chip${h.emergency ? '' : ' warn'}">${h.emergency ? 'Emergency department' : 'No emergency department'}</span></p>
        <p style="margin-top:.5rem"><a style="color:var(--signal);font-size:.85rem" target="_blank" rel="noopener"
          href="https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lng}#map=13/${h.lat}/${h.lng}">Open on map</a></p></div>`
      )
      .join('') : `<p class="empty">${esc(HT.tr('empty.hospitals'))}</p>`;
  } catch (err) {
    if (has('count')) q('count').textContent = '';
    if (has('doctors')) q('doctors').innerHTML = `<p class="empty">${esc(HT.tr('uiErrors.providersUnavailable'))}</p>`;
    if (has('hospitals-list')) q('hospitals-list').innerHTML = `<p class="empty">${esc(HT.tr('uiErrors.providersUnavailable'))}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  SPECIALTIES.forEach((s) => q('f-specialty')?.insertAdjacentHTML('beforeend', `<option>${s}</option>`));
  COUNTRIES.forEach((c) => q('f-country')?.insertAdjacentHTML('beforeend', `<option>${c}</option>`));
  const pre = new URLSearchParams(location.search).get('specialty');
  if (pre && has('f-specialty')) q('f-specialty').value = pre;

  q('search').addEventListener('click', search);
  q('doctors')?.addEventListener('click', async (ev) => {
    const id = ev.target.dataset?.licence;
    if (!id) return;
    const card = ev.target.closest('.provider');
    card.querySelector('.licence-detail')?.remove();
    const r = await HT.get(`/api/v1/doctors/${id}/license`);
    const ar = HT.lang === 'ar';
    card.insertAdjacentHTML(
      'beforeend',
      `<div class="licence-detail" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--line);font-size:.86rem">
        <dl style="display:grid;grid-template-columns:auto 1fr;gap:.3rem .9rem;margin:0">
          <dt style="color:var(--mist)">${ar ? 'الحالة' : 'Status'}</dt><dd style="margin:0">${esc(r.license_status)}</dd>
          <dt style="color:var(--mist)">${ar ? 'الجهة' : 'Authority'}</dt><dd style="margin:0">${esc(r.licensing_authority || (ar ? 'لا شيء مسجل' : 'none recorded'))}</dd>
          <dt style="color:var(--mist)">${ar ? 'تاريخ التحقق' : 'Verified at'}</dt><dd style="margin:0">${esc(r.verified_at || (ar ? 'لم يحدث' : 'never'))}</dd>
        </dl>
        <p style="color:var(--mist);margin-top:.8rem">${esc(r.note)}</p>
      </div>`
    );
  });

  await search();

  try {
    const r = await HT.get('/api/v1/doctors');
    // authorities are returned by the licence endpoint; use the first record
    if (has('authorities') && r.doctors[0]) {
      const lic = await HT.get(`/api/doctors/${r.doctors[0].id}/license`);
      q('authorities').innerHTML = lic.authorities
        .map(
          (a) => `<div class="card"><h3>${esc(a.name)}</h3>
          <p>${esc(a.country)}</p>
          <p style="margin-top:.6rem"><a style="color:var(--signal);font-size:.85rem" href="${a.register_url}" target="_blank" rel="noopener">${esc(a.register_url)}</a></p>
          <p style="margin-top:.6rem"><span class="chip warn">${a.bulk_license_required ? 'Data licence required for bulk use' : 'Open access'}</span></p></div>`
        )
        .join('');
    }
  } catch (_) { /* optional */ }
});

window.addEventListener('healtrip:lang', search);
