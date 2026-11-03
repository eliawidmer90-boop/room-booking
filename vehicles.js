import { vehicles } from './vehicle-catalog.js';

const panel = document.getElementById('vehicle-panel');
const $ = selector => document.querySelector(selector);
const form = $('#vehicle-form');
const dialog = $('#vehicle-dialog');
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const zone = 'Africa/Windhoek';
const dayOf = value => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const dayStart = date => Date.parse(`${date}T00:00:00+02:00`);
const addDays = (date, days) => dayOf(dayStart(date) + days * 86400000);
const clock = value => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
const prettyDay = (date, options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...options }).format(new Date(`${date}T12:00:00+02:00`));
const dateTime = value => `${prettyDay(dayOf(value))}, ${clock(value)}`;
const vehicleName = id => vehicles.find(vehicle => vehicle.id === id)?.name || id;
const newToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
const storageKey = 'kavango-vehicle-booking-access-v1';
let access = {};
let storageAvailable = true;
try {
  access = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (!access || typeof access !== 'object' || Array.isArray(access)) access = {};
} catch { storageAvailable = false; }
const saveAccess = () => { try { localStorage.setItem(storageKey, JSON.stringify(access)); } catch { storageAvailable = false; } };
const isMine = id => Boolean(access[id]?.token);
const state = { date: dayOf(Date.now()), view: 'day', filter: 'all', mine: false, fullDay: false, bookings: [], loaded: false, loading: false, error: '', serverOffset: 0, demo: false };
const now = () => Date.now() + state.serverOffset;
let sequence = 0;
let formToken = newToken();
let lastDeparture;
let detailBooking;
let toastTimer;

function toast(message) {
  clearTimeout(toastTimer);
  $('#vehicle-toast').textContent = message;
  $('#vehicle-toast').hidden = false;
  toastTimer = setTimeout(() => { $('#vehicle-toast').hidden = true; }, 4500);
}

async function api(method = 'GET', body, query = '') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/vehicle-bookings${query}`, { method, cache: 'no-store', signal: controller.signal, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    let data;
    try { data = await response.json(); } catch { throw new Error('The booking service could not be reached. Please try again.'); }
    if (!response.ok) { const error = new Error(data.error || 'Please try again.'); error.code = data.code; throw error; }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The connection took too long. Please try again.');
    if (error instanceof TypeError) throw new Error('You appear to be offline. Reconnect and try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function weekStart(date) {
  const weekday = new Date(`${date}T12:00:00+02:00`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

async function loadSchedule({ quiet = false } = {}) {
  const request = ++sequence;
  state.loading = true;
  if (!quiet) { state.loaded = false; state.error = ''; }
  render();
  const from = state.mine ? dayOf(now()) : state.view === 'week' ? weekStart(state.date) : state.date;
  const to = state.mine ? addDays(from, 366) : state.view === 'week' ? addDays(from, 6) : from;
  try {
    const data = await api('GET', undefined, `?from=${from}&to=${to}`);
    if (request !== sequence) return;
    state.bookings = data.bookings;
    state.demo = data.demo;
    if (data.serverTime) state.serverOffset = Date.parse(data.serverTime) - Date.now();
    state.loaded = true; state.loading = false; state.error = '';
  } catch (error) {
    if (request !== sequence) return;
    state.loaded = false; state.loading = false; state.error = error.message;
  }
  render();
}

const visibleVehicles = () => vehicles.filter(vehicle => state.filter === 'all' || vehicle.id === state.filter);
const forDay = date => state.bookings.filter(booking => Date.parse(booking.startAt) < dayStart(date) + 86400000 && Date.parse(booking.endAt) > dayStart(date) && (state.filter === 'all' || booking.vehicle === state.filter));
function timeOnDay(booking, date) {
  const startsBefore = Date.parse(booking.startAt) < dayStart(date);
  const endsAfter = Date.parse(booking.endAt) >= dayStart(date) + 86400000;
  return `${startsBefore ? '← 00:00' : clock(booking.startAt)} – ${endsAfter ? '24:00 →' : clock(booking.endAt)}`;
}

function render() {
  $('#vehicle-sync').innerHTML = `<button class="sync-button" data-v-action="refresh" aria-label="Refresh vehicle schedule" ${state.loading ? 'disabled' : ''}>${icon('refresh')}${state.loading ? 'Refreshing…' : 'Refresh'}</button>`;
  $('#vehicle-mine').checked = state.mine;
  $('#vehicle-schedule-title').textContent = state.mine ? 'My bookings' : 'Bookings';
  $('#vehicle-toolbar').hidden = state.mine;
  $('#vehicle-date-heading').textContent = state.view === 'day' ? prettyDay(state.date) : `${prettyDay(weekStart(state.date), { day: 'numeric', month: 'short' })} – ${prettyDay(addDays(weekStart(state.date), 6), { day: 'numeric', month: 'short', year: 'numeric' })}`;
  $('#vehicle-schedule-date').value = state.date;
  panel.querySelectorAll('[data-v-view]').forEach(button => { button.classList.toggle('selected', button.dataset.vView === state.view); button.setAttribute('aria-pressed', String(button.dataset.vView === state.view)); });
  for (const direction of ['previous', 'next']) panel.querySelector(`[data-v-action="${direction}"]`).setAttribute('aria-label', `${direction === 'previous' ? 'Previous' : 'Next'} ${state.view === 'day' ? 'day' : 'week'}`);
  $('#vehicle-hours').hidden = state.mine || state.view !== 'day';
  $('#vehicle-hours').textContent = state.fullDay ? 'Show working hours' : 'Show full day';
  if (!panel.hidden) {
    $('#service-message').hidden = !state.demo;
    $('#service-message').textContent = 'Local preview';
    $('#service-message').title = 'Bookings in this preview are saved only on this computer.';
  }
  const content = $('#vehicle-schedule');
  content.setAttribute('aria-busy', String(state.loading));
  if (state.loading && !state.loaded) { content.innerHTML = '<div class="loading-state">Loading bookings…</div>'; return; }
  if (state.error) { content.innerHTML = `<div class="empty-state"><h3>Bookings unavailable</h3><p>${esc(state.error)}</p><button class="button secondary" data-v-action="refresh">Try again</button></div>`; return; }
  if (state.mine) renderMine();
  else if (state.view === 'week') renderWeek();
  else renderDay();
}

function renderDay() {
  const rows = forDay(state.date);
  const base = dayStart(state.date);
  const startMinute = booking => Math.max(0, (Date.parse(booking.startAt) - base) / 60000);
  const endMinute = booking => Math.min(1440, (Date.parse(booking.endAt) - base) / 60000);
  let first = state.fullDay ? 0 : 7, last = state.fullDay ? 24 : 18;
  rows.forEach(booking => { first = Math.min(first, Math.floor(startMinute(booking) / 60)); last = Math.max(last, Math.ceil(endMinute(booking) / 60)); });
  const hours = Array.from({ length: last - first }, (_, index) => first + index);
  const time = hour => `${String(hour).padStart(2, '0')}:00`;
  const fleet = visibleVehicles();
  const minuteNow = (now() - base) / 60000;
  const line = minuteNow >= first * 60 && minuteNow < last * 60 ? `<div class="now-line" style="top:${minuteNow - first * 60}px" aria-label="Current time ${clock(now())}"></div>` : '';
  $('#vehicle-schedule').innerHTML = `<div class="day-scroll"><div class="day-grid vehicle-day-grid ${fleet.length === 1 ? 'single-vehicle' : ''}" style="--rooms:${fleet.length};--hour-height:60px;--timeline-height:${(last - first) * 60}px"><div class="day-columns-header"><span class="time-zone-cell">CAT</span>${fleet.map(vehicle => `<div class="room-column-header vehicle-column-header"><strong>${esc(vehicle.name)}</strong></div>`).join('')}</div><div class="timeline"><div class="time-axis">${hours.map(hour => `<span class="time-label" style="top:${(hour - first) * 60}px">${time(hour)}</span>`).join('')}</div>${fleet.map(vehicle => `<div class="room-lane">${hours.map(hour => `<button class="time-slot" style="top:${(hour - first) * 60}px" data-v-slot="${vehicle.id}|${state.date}|${time(hour)}" aria-label="Book ${esc(vehicle.name)} at ${time(hour)}" ${base + hour * 3600000 < now() ? 'disabled' : ''}>${icon('plus')}Select time</button>`).join('')}${rows.filter(booking => booking.vehicle === vehicle.id).map(booking => {
    const length = endMinute(booking) - startMinute(booking);
    return `<button class="booking-block vehicle-block ${length < 45 ? 'compact' : ''} ${length <= 15 ? 'micro' : ''}" style="top:${startMinute(booking) - first * 60 + 2}px;height:${Math.max(9, length - 4)}px" data-v-booking="${booking.id}" aria-label="${esc(`${vehicle.name} · ${booking.name} · ${dateTime(booking.startAt)} to ${dateTime(booking.endAt)}`)}"><span class="booking-time">${timeOnDay(booking, state.date)}</span><strong class="booking-name">${esc(booking.name)}${isMine(booking.id) ? ' · You' : ''}</strong>${length >= 45 ? `<span class="booking-purpose">${esc(booking.destination || booking.purpose || 'Vehicle reservation')}</span>` : ''}</button>`;
  }).join('')}</div>`).join('')}${line}</div></div></div>`;
}

function renderWeek() {
  const first = weekStart(state.date);
  $('#vehicle-schedule').innerHTML = `<div class="week-scroll"><div class="week-grid">${Array.from({ length: 7 }, (_, index) => addDays(first, index)).map(date => {
    const rows = forDay(date);
    return `<div class="week-day"><div class="week-date ${date === dayOf(now()) ? 'today' : ''}"><button class="week-date-button" data-v-date="${date}" aria-label="View ${prettyDay(date)}"><span>${prettyDay(date, { weekday: 'short' }).toUpperCase()}</span><strong>${Number(date.slice(-2))}</strong></button></div>${rows.map(booking => `<button class="week-booking" data-v-booking="${booking.id}"><span>${esc(vehicleName(booking.vehicle))}</span><span>${timeOnDay(booking, date)}</span><strong>${esc(booking.name)}</strong></button>`).join('') || '<p class="week-free">No bookings</p>'}</div>`;
  }).join('')}</div></div>`;
}

function renderMine() {
  const rows = state.bookings.filter(booking => isMine(booking.id) && Date.parse(booking.endAt) > now());
  $('#vehicle-schedule').innerHTML = rows.length ? `<p class="list-caption">Upcoming bookings saved in this browser</p>${rows.map(booking => `<button class="list-booking vehicle-list-booking" data-v-booking="${booking.id}"><span class="list-booking-date">${prettyDay(dayOf(booking.startAt), { day: 'numeric', month: 'short' })}</span><span class="list-booking-time">${clock(booking.startAt)} → ${dayOf(booking.endAt) !== dayOf(booking.startAt) ? prettyDay(dayOf(booking.endAt), { day: 'numeric', month: 'short' }) + ', ' : ''}${clock(booking.endAt)}</span><div class="list-booking-title">${esc(vehicleName(booking.vehicle))}<div class="list-booking-meta">${esc(booking.name)}${booking.destination ? ` · ${esc(booking.destination)}` : ''}</div></div>${icon('chevron')}</button>`).join('')}` : '<div class="empty-state"><p>No upcoming vehicle bookings saved in this browser.</p></div>';
}

function formInstant(prefix) { return Date.parse(`${form.elements[`${prefix}Date`].value}T${form.elements[`${prefix}Time`].value}:00+02:00`); }
function setReturn(value) { form.elements.returnDate.value = dayOf(value); form.elements.returnTime.value = clock(value); }
function updateDuration() {
  const duration = (formInstant('return') - formInstant('departure')) / 60000;
  form.elements.returnDate.min = form.elements.departureDate.value;
  const days = Math.floor(duration / 1440), hours = Math.floor((duration % 1440) / 60), minutes = duration % 60;
  const text = [days ? `${days} ${days === 1 ? 'day' : 'days'}` : '', hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '', minutes ? `${minutes} minutes` : ''].filter(Boolean).join(' ');
  $('#vehicle-duration').textContent = !Number.isFinite(duration) ? '' : duration > 0 ? `Reserved for ${text}` : 'Return must be after departure.';
}
function selectTime(vehicle = form.elements.vehicle.value, date = state.date, time, focus = true) {
  let chosen = date < dayOf(now()) ? dayOf(now()) : date;
  let start = time;
  if (!start) {
    if (chosen === dayOf(now())) { const rounded = Math.ceil((now() + 60000) / 900000) * 900000; chosen = dayOf(rounded); start = clock(rounded); }
    else start = '09:00';
  }
  const previousDuration = formInstant('return') - formInstant('departure');
  form.elements.vehicle.value = vehicle;
  form.elements.departureDate.value = chosen;
  form.elements.departureTime.value = start;
  form.elements.departureDate.min = dayOf(now());
  form.elements.departureDate.max = addDays(dayOf(now()), 366);
  lastDeparture = formInstant('departure');
  setReturn(lastDeparture + (Number.isFinite(previousDuration) && previousDuration > 0 ? previousDuration : 3600000));
  $('#vehicle-form-error').hidden = true;
  updateDuration();
  if (focus) { form.scrollIntoView({ block: 'nearest' }); (form.elements.name.value ? form.elements.returnDate : form.elements.name).focus({ preventScroll: true }); }
}

form.elements.vehicle.innerHTML = vehicles.map(vehicle => `<option value="${vehicle.id}">${esc(vehicle.name)}</option>`).join('');
$('#vehicle-filter').insertAdjacentHTML('beforeend', vehicles.map(vehicle => `<option value="${vehicle.id}">${esc(vehicle.name)}</option>`).join(''));
try { form.elements.name.value = localStorage.getItem('kavango-booker-name') || ''; } catch {}
selectTime(vehicles[0].id, state.date, undefined, false);
form.addEventListener('change', event => {
  if (['departureDate', 'departureTime'].includes(event.target.name)) {
    const next = formInstant('departure');
    const previousDuration = formInstant('return') - lastDeparture;
    if (Number.isFinite(next) && Number.isFinite(previousDuration) && previousDuration > 0) setReturn(next + previousDuration);
    lastDeparture = next;
    if (form.elements.departureDate.validity.valid && form.elements.departureDate.value) { state.date = form.elements.departureDate.value; state.mine = false; loadSchedule(); }
  }
  updateDuration();
});
form.addEventListener('input', updateDuration);
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#vehicle-submit');
  button.disabled = true; button.textContent = 'Booking…'; $('#vehicle-form-error').hidden = true;
  try {
    const { booking } = await api('POST', { ...Object.fromEntries(new FormData(form)), cancelToken: formToken });
    access[booking.id] = { token: formToken, endAt: booking.endAt }; saveAccess();
    try { localStorage.setItem('kavango-booker-name', booking.name); } catch {}
    formToken = newToken();
    state.date = dayOf(booking.startAt); state.mine = false;
    if (state.filter !== 'all' && state.filter !== booking.vehicle) { state.filter = booking.vehicle; $('#vehicle-filter').value = booking.vehicle; }
    showDetail(booking, true);
    await loadSchedule();
  } catch (error) {
    $('#vehicle-form-error').textContent = error.message; $('#vehicle-form-error').hidden = false;
    if (error.code === 'CONFLICT') loadSchedule({ quiet: true });
  } finally { button.disabled = false; button.textContent = 'Book vehicle'; }
});

function showDetail(booking, success = false) {
  detailBooking = booking;
  const own = isMine(booking.id);
  const row = (label, text) => `<div class="detail-row"><div><label>${label}</label><p>${esc(text)}</p></div></div>`;
  const link = own ? `${location.origin}/#vehicle-cancel=${booking.id}.${access[booking.id].token}` : '';
  $('#vehicle-detail').innerHTML = `<div class="modal-header"><h2 id="vehicle-detail-title">${success ? 'Booking confirmed' : esc(vehicleName(booking.vehicle))}</h2><button class="icon-button" data-v-close aria-label="Close vehicle booking details">${icon('x')}</button></div><div class="detail-summary">${row('Vehicle', vehicleName(booking.vehicle))}${row('Departure · CAT (UTC+2)', dateTime(booking.startAt))}${row('Return · CAT (UTC+2)', dateTime(booking.endAt))}${row('Booked by', booking.name + (own ? ' · You' : ''))}${booking.driver ? row('Driver', booking.driver) : ''}${booking.destination ? row('Destination', booking.destination) : ''}${booking.purpose ? row('Purpose', booking.purpose) : ''}</div>${own ? `<div class="private-link-box"><strong>${storageAvailable ? 'Keep this private cancellation link' : 'Save this link — this browser cannot remember your booking'}</strong><p>Use it on another device. Anyone with this link can cancel this booking.</p><div class="link-copy-row"><input id="vehicle-cancel-link" readonly aria-label="Private vehicle cancellation link" value="${esc(link)}"><button data-v-action="copy">${icon('copy')}Copy</button></div></div>` : ''}<div class="detail-actions">${own ? '<button class="button secondary" data-v-action="cancel-prompt">Cancel booking</button>' : ''}<button class="button primary" data-v-close>${success ? 'Done' : 'Close'}</button></div><div id="vehicle-cancel-confirmation" class="cancel-confirmation" hidden><strong>Cancel this booking?</strong><p>The vehicle will become available for this time.</p><button class="button danger" data-v-action="cancel-confirm">Yes, cancel booking</button><button class="button secondary" data-v-action="cancel-keep">Keep booking</button></div><p id="vehicle-detail-error" class="form-error" role="alert" hidden></p>`;
  if (!dialog.open) dialog.showModal();
}

async function handleCancelLink() {
  const match = location.hash.match(/^#vehicle-cancel=([0-9a-f-]{36})\.([0-9a-f]{64})$/i);
  if (!match) return;
  try {
    const { booking } = await api('GET', undefined, `?id=${match[1]}`);
    access[booking.id] = { token: match[2].toLowerCase(), endAt: booking.endAt }; saveAccess();
    state.date = dayOf(booking.startAt);
    history.replaceState(null, '', `${location.pathname}${location.search}#vehicles`);
    showDetail(booking);
    await loadSchedule();
  } catch (error) { toast(error.message); }
}

document.addEventListener('click', async event => {
  if (!panel.contains(event.target) && !dialog.contains(event.target)) return;
  if (event.target.closest('[data-v-close]')) { dialog.close(); return; }
  const view = event.target.closest('[data-v-view]');
  if (view) { state.view = view.dataset.vView; state.mine = false; loadSchedule(); return; }
  const slot = event.target.closest('[data-v-slot]');
  if (slot) { selectTime(...slot.dataset.vSlot.split('|')); return; }
  const date = event.target.closest('[data-v-date]');
  if (date) { state.date = date.dataset.vDate; state.view = 'day'; loadSchedule(); return; }
  const reference = event.target.closest('[data-v-booking]');
  if (reference) { const booking = state.bookings.find(row => row.id === reference.dataset.vBooking); if (booking) showDetail(booking); return; }
  const button = event.target.closest('[data-v-action]');
  if (!button) return;
  const action = button.dataset.vAction;
  if (action === 'hours') { state.fullDay = !state.fullDay; render(); }
  if (action === 'refresh') loadSchedule({ quiet: state.loaded });
  if (action === 'today') { state.date = dayOf(now()); loadSchedule(); }
  if (action === 'previous' || action === 'next') { state.date = addDays(state.date, (action === 'previous' ? -1 : 1) * (state.view === 'day' ? 1 : 7)); loadSchedule(); }
  if (action === 'copy') {
    try { await navigator.clipboard.writeText($('#vehicle-cancel-link').value); button.innerHTML = `${icon('check')}Copied`; }
    catch { $('#vehicle-cancel-link').focus(); $('#vehicle-cancel-link').select(); toast('Select and copy the private link above.'); }
  }
  if (action === 'cancel-prompt') $('#vehicle-cancel-confirmation').hidden = false;
  if (action === 'cancel-keep') $('#vehicle-cancel-confirmation').hidden = true;
  if (action === 'cancel-confirm' && detailBooking) {
    button.disabled = true; button.textContent = 'Cancelling…';
    try {
      await api('DELETE', { id: detailBooking.id, cancelToken: access[detailBooking.id].token });
      delete access[detailBooking.id]; saveAccess(); dialog.close(); toast('Booking cancelled. The vehicle is available again.'); await loadSchedule();
    } catch (error) { $('#vehicle-detail-error').textContent = error.message; $('#vehicle-detail-error').hidden = false; button.disabled = false; button.textContent = 'Yes, cancel booking'; }
  }
});
$('#vehicle-schedule-date').addEventListener('change', event => { if (event.target.value) { state.date = event.target.value; loadSchedule(); } });
$('#vehicle-filter').addEventListener('change', event => { state.filter = event.target.value; render(); });
$('#vehicle-mine').addEventListener('change', event => { state.mine = event.target.checked; loadSchedule(); });
dialog.addEventListener('click', event => {
  if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); }
});
document.addEventListener('booking-tab-change', event => { if (event.detail === 'vehicles') loadSchedule({ quiet: state.loaded }); });
window.addEventListener('hashchange', handleCancelLink);
window.addEventListener('storage', event => {
  if (event.key === storageKey) { try { const next = JSON.parse(event.newValue || '{}'); access = next && typeof next === 'object' && !Array.isArray(next) ? next : {}; if (state.loaded) render(); } catch {} }
});
window.addEventListener('online', () => { if (!panel.hidden) loadSchedule({ quiet: state.loaded }); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !panel.hidden) loadSchedule({ quiet: state.loaded }); });
setInterval(() => { if (!document.hidden && !panel.hidden && !dialog.open) loadSchedule({ quiet: state.loaded }); }, 60000);
if (!panel.hidden) await loadSchedule();
await handleCancelLink();
