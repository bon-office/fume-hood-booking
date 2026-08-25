'use strict';

const CFG = window.FUMEHOOD_CONFIG;
const store = createStore(CFG);

const state = {
  weekStart: startOfWeek(new Date()),
  bookings: new Map(), // 'YYYY-MM-DD#h' -> booking
  name: localStorage.getItem('fumehood.name') || '',
  drag: null,          // { date, from, to } while dragging
};

/* ---------- date helpers ---------- */

function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const shift = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - shift);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function iso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hourLabel(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isPast(date, hour) {
  const now = new Date();
  const slotEnd = new Date(`${date}T00:00:00`);
  slotEnd.setHours(hour + 1);
  return slotEnd <= now;
}

function tooFarAhead(date) {
  const limit = addDays(new Date(), CFG.maxDaysAhead);
  return date > iso(limit);
}

/* ---------- rendering ---------- */

function visibleDays() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(state.weekStart, i);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    if (weekend && !CFG.includeWeekends) continue;
    days.push(d);
  }
  return days;
}

function renderWeekLabel(days) {
  const fmt = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const last = days[days.length - 1];
  document.getElementById('week-label').textContent =
    `${fmt(days[0])} – ${fmt(last)} ${last.getFullYear()}`;
}

function renderGrid() {
  const days = visibleDays();
  renderWeekLabel(days);

  const todayIso = iso(new Date());
  const table = document.getElementById('grid');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th')).className = 'corner';

  for (const d of days) {
    const th = document.createElement('th');
    th.className = 'day-head' + (iso(d) === todayIso ? ' today' : '');
    th.innerHTML =
      `<span class="dow">${d.toLocaleDateString(undefined, { weekday: 'short' })}</span>` +
      `<span class="dom">${d.getDate()}/${d.getMonth() + 1}</span>`;
    headRow.appendChild(th);
  }
  head.appendChild(headRow);

  const body = document.createElement('tbody');
  for (let h = CFG.dayStartHour; h < CFG.dayEndHour; h++) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.className = 'hour-head';
    th.textContent = hourLabel(h);
    tr.appendChild(th);

    for (const d of days) {
      const date = iso(d);
      const key = `${date}#${h}`;
      const booking = state.bookings.get(key);
      const td = document.createElement('td');
      td.className = 'slot';
      td.dataset.date = date;
      td.dataset.hour = h;

      if (booking) {
        const mine = sameName(booking.name, state.name);
        td.classList.add('booked', mine ? 'mine' : 'theirs');
        td.textContent = booking.name;
        td.title = `${hourLabel(h)}–${hourLabel(h + 1)} · ${booking.name}` +
          (mine || CFG.allowCancelOthers ? ' · click to release' : '');
        td.dataset.name = booking.name;
        td.dataset.id = booking.id;
      } else if (isPast(date, h)) {
        td.classList.add('past');
      } else if (tooFarAhead(date)) {
        td.classList.add('past');
        td.title = `Booking opens ${CFG.maxDaysAhead} days ahead at most`;
      } else {
        td.classList.add('free');
        td.title = `${hourLabel(h)}–${hourLabel(h + 1)} · free`;
      }
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  table.replaceChildren(head, body);
  paintDrag();
}

function paintDrag() {
  const d = state.drag;
  for (const td of document.querySelectorAll('.slot')) {
    const inDrag = d &&
      td.dataset.date === d.date &&
      Number(td.dataset.hour) >= Math.min(d.from, d.to) &&
      Number(td.dataset.hour) <= Math.max(d.from, d.to);
    td.classList.toggle('selected', Boolean(inDrag));
  }
}

function setStatus(msg, kind = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = `status ${kind}`;
}

/* ---------- data ---------- */

async function reload() {
  const days = visibleDays();
  const from = iso(days[0]);
  const to = iso(days[days.length - 1]);
  try {
    const rows = await store.list(from, to);
    state.bookings = new Map(rows.map((b) => [`${b.date}#${b.hour}`, b]));
    setStatus('');
  } catch (err) {
    setStatus(`Could not load bookings: ${err.message}`, 'error');
  }
  renderGrid();
}

async function book(date, fromHour, toHour) {
  const name = state.name.trim();
  if (!name) {
    setStatus('Type your name first, then pick your hours.', 'error');
    document.getElementById('who-input').focus();
    return;
  }

  const hours = [];
  for (let h = Math.min(fromHour, toHour); h <= Math.max(fromHour, toHour); h++) {
    if (!state.bookings.has(`${date}#${h}`) && !isPast(date, h)) hours.push(h);
  }
  if (!hours.length) return;

  if (hours.length > CFG.maxHoursPerBooking) {
    setStatus(`At most ${CFG.maxHoursPerBooking} h in one booking.`, 'error');
    return;
  }

  setStatus('Saving…');
  let failure = null;
  try {
    await store.create(hours.map((h) => ({ date, hour: h, name })));
  } catch (err) {
    failure = err;
  }

  // Report after reloading: reload() clears the status line on success, which
  // would otherwise wipe the message and make a failure look like a no-op.
  await reload();
  if (failure) {
    setStatus(
      failure instanceof Conflict
        ? 'Someone just took one of those hours — have another look.'
        : `Could not save: ${failure.message}`,
      'error',
    );
  }
}

/*
 * The run of consecutive hours on one day belonging to one person, containing
 * `hour`. A 09:00-13:00 drag is four separate rows in the database; this is
 * what lets us treat them as the one booking the user thinks they made.
 */
function blockAround(date, hour, name) {
  const at = (h) => {
    const b = state.bookings.get(`${date}#${h}`);
    return b && sameName(b.name, name) ? b : null;
  };

  let lo = hour;
  let hi = hour;
  while (at(lo - 1)) lo--;
  while (at(hi + 1)) hi++;

  const rows = [];
  for (let h = lo; h <= hi; h++) rows.push(at(h));
  return { lo, hi, rows };
}

function longDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/*
 * Resolves to 'block', 'one' or 'cancel'.
 *
 * The buttons resolve on their own click rather than via the dialog's `close`
 * event: not every engine fires `close` reliably, and a release that silently
 * never happens is the worst possible failure here.
 */
function askRelease({ title, body, blockLabel, oneLabel }) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('release-dialog');
    const blockBtn = document.getElementById('release-block');
    const oneBtn = document.getElementById('release-one');
    const keepBtn = document.getElementById('release-keep');

    document.getElementById('release-title').textContent = title;
    document.getElementById('release-body').textContent = body;
    blockBtn.textContent = blockLabel;
    oneBtn.textContent = oneLabel || '';
    oneBtn.hidden = !oneLabel;

    let settled = false;
    const listeners = [];

    const finish = (value) => {
      if (settled) return;
      settled = true;
      for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
      if (dialog.open) dialog.close();
      resolve(value);
    };

    const on = (el, type, fn) => {
      listeners.push([el, type, fn]);
      el.addEventListener(type, fn);
    };

    on(blockBtn, 'click', () => finish('block'));
    on(oneBtn, 'click', () => finish('one'));
    on(keepBtn, 'click', () => finish('cancel'));
    on(dialog, 'cancel', () => finish('cancel')); // Escape
    on(dialog, 'close', () => finish(dialog.returnValue || 'cancel'));

    if (!dialog.open) dialog.showModal();
    keepBtn.focus(); // Enter keeps the booking; releasing is always deliberate
  });
}

async function cancel(td) {
  const date = td.dataset.date;
  const hour = Number(td.dataset.hour);
  const booking = state.bookings.get(`${date}#${hour}`);
  if (!booking) return;

  const mine = sameName(booking.name, state.name);
  if (!mine && !CFG.allowCancelOthers) {
    setStatus(`That slot belongs to ${booking.name}.`, 'error');
    return;
  }

  const block = blockAround(date, hour, booking.name);
  const whole = block.rows.length > 1;
  const hours = `${hourLabel(hour)}–${hourLabel(hour + 1)}`;

  const choice = await askRelease({
    title: mine ? 'Release your booking?' : `Release ${booking.name}'s booking?`,
    body: whole
      ? `${longDate(date)}, ${hourLabel(block.lo)}–${hourLabel(block.hi + 1)} — ${block.rows.length} hours.`
      : `${longDate(date)}, ${hours}.`,
    blockLabel: whole ? `Release all ${block.rows.length} hours` : 'Release',
    oneLabel: whole ? `Only ${hours}` : null,
  });

  if (choice !== 'block' && choice !== 'one') return;
  const ids = choice === 'block' ? block.rows.map((b) => b.id) : [booking.id];

  setStatus('Releasing…');
  let failure = null;
  try {
    await store.removeMany(ids);
  } catch (err) {
    failure = err;
  }

  await reload();
  if (failure) setStatus(`Could not release: ${failure.message}`, 'error');
}

/* ---------- interaction ---------- */

function setupInteraction() {
  const grid = document.getElementById('grid');

  // Releasing runs on `click`, not `pointerdown`: opening the dialog under a
  // finger that is still down would let the same gesture press a button in it.
  grid.addEventListener('click', (e) => {
    const td = e.target.closest('td.slot.booked');
    if (td) cancel(td);
  });

  grid.addEventListener('pointerdown', (e) => {
    const td = e.target.closest('td.slot');
    if (!td || !td.classList.contains('free')) return;

    const hour = Number(td.dataset.hour);
    state.drag = { date: td.dataset.date, from: hour, to: hour };
    td.setPointerCapture?.(e.pointerId);
    paintDrag();
    e.preventDefault();
  });

  grid.addEventListener('pointermove', (e) => {
    if (!state.drag) return;
    const td = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('td.slot');
    if (!td || td.dataset.date !== state.drag.date) return;
    state.drag.to = Number(td.dataset.hour);
    paintDrag();
  });

  const finish = () => {
    const d = state.drag;
    state.drag = null;
    paintDrag();
    if (d) book(d.date, d.from, d.to);
  };
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', () => {
    state.drag = null;
    paintDrag();
  });

  document.getElementById('prev-week').addEventListener('click', () => {
    state.weekStart = addDays(state.weekStart, -7);
    reload();
  });
  document.getElementById('next-week').addEventListener('click', () => {
    state.weekStart = addDays(state.weekStart, 7);
    reload();
  });
  document.getElementById('this-week').addEventListener('click', () => {
    state.weekStart = startOfWeek(new Date());
    reload();
  });

  const who = document.getElementById('who-input');
  who.value = state.name;
  who.addEventListener('input', () => {
    state.name = who.value;
    localStorage.setItem('fumehood.name', state.name);
    renderGrid();
  });

  document.getElementById('lock-btn').addEventListener('click', lockAndReload);
}

/* ---------- boot ---------- */

function startApp() {
  document.getElementById('hood-name').textContent = CFG.hoodName;

  if (store.mode === 'demo') {
    const badge = document.getElementById('mode-badge');
    badge.hidden = false;
    badge.textContent = 'Demo mode — bookings stay in this browser';
  }

  setupInteraction();
  reload();

  // Keep the shared calendar reasonably fresh without hammering the API.
  if (store.mode === 'shared') {
    setInterval(() => {
      if (!state.drag && !document.hidden) reload();
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reload();
    });
  }
}

unlockThen(startApp);
