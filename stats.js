'use strict';

/*
 * Usage statistics: hours booked per person, per year and per month.
 *
 * One row in the bookings table is one booked hour, so every figure here is
 * simply a row count. Dates are compared as 'YYYY-MM-DD' strings and never
 * parsed into Date objects, which keeps the month a booking falls in
 * independent of the reader's time zone.
 */

const CFG = window.FUMEHOOD_CONFIG;
const store = createStore(CFG);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const state = {
  rows: [],      // every booking
  people: [],    // display names, busiest first
  years: [],     // ascending
};

const yearOf = (b) => b.date.slice(0, 4);
const monthOf = (b) => Number(b.date.slice(5, 7)) - 1;
const keyOf = (b) => b.name.trim().toLowerCase();

/*
 * Names are free text, so group them case-insensitively and display whichever
 * spelling that person used most often.
 */
function displayNames(rows) {
  const spellings = new Map(); // key -> Map(spelling -> count)
  for (const b of rows) {
    const key = keyOf(b);
    const seen = spellings.get(key) || new Map();
    const label = b.name.trim();
    seen.set(label, (seen.get(label) || 0) + 1);
    spellings.set(key, seen);
  }

  const names = new Map();
  for (const [key, seen] of spellings) {
    const best = [...seen.entries()].sort((a, b) => b[1] - a[1])[0][0];
    names.set(key, best);
  }
  return names;
}

function tally(rows, bucketOf) {
  const totals = new Map(); // person key -> Map(bucket -> hours)
  for (const b of rows) {
    const key = keyOf(b);
    const buckets = totals.get(key) || new Map();
    const bucket = bucketOf(b);
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    totals.set(key, buckets);
  }
  return totals;
}

/* Builds a table: one row per person, one column per bucket, plus totals. */
function renderReport(table, buckets, headers, totals, names) {
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th')).textContent = 'Name';
  for (const label of headers) {
    const th = document.createElement('th');
    th.className = 'num';
    th.textContent = label;
    headRow.appendChild(th);
  }
  const totalHead = document.createElement('th');
  totalHead.className = 'num total';
  totalHead.textContent = 'Total';
  headRow.appendChild(totalHead);
  head.appendChild(headRow);

  const body = document.createElement('tbody');
  const columnSums = buckets.map(() => 0);
  let grand = 0;

  for (const key of state.people) {
    const perBucket = totals.get(key);
    if (!perBucket) continue;

    const tr = document.createElement('tr');
    tr.appendChild(document.createElement('th')).textContent = names.get(key);

    let rowSum = 0;
    buckets.forEach((bucket, i) => {
      const hours = perBucket.get(bucket) || 0;
      rowSum += hours;
      columnSums[i] += hours;

      const td = document.createElement('td');
      td.className = 'num' + (hours ? '' : ' zero');
      td.textContent = hours || '·';
      tr.appendChild(td);
    });

    const td = document.createElement('td');
    td.className = 'num total';
    td.textContent = rowSum;
    tr.appendChild(td);
    grand += rowSum;
    body.appendChild(tr);
  }

  const foot = document.createElement('tfoot');
  const footRow = document.createElement('tr');
  footRow.appendChild(document.createElement('th')).textContent = 'All';
  for (const sum of columnSums) {
    const td = document.createElement('td');
    td.className = 'num' + (sum ? '' : ' zero');
    td.textContent = sum || '·';
    footRow.appendChild(td);
  }
  const grandCell = document.createElement('td');
  grandCell.className = 'num total';
  grandCell.textContent = grand;
  footRow.appendChild(grandCell);
  foot.appendChild(footRow);

  table.replaceChildren(head, body, foot);
}

function renderYearTable(names) {
  renderReport(
    document.getElementById('by-year'),
    state.years,
    state.years,
    tally(state.rows, yearOf),
    names,
  );
}

function renderMonthTable(names, year) {
  const rows = state.rows.filter((b) => yearOf(b) === year);
  renderReport(
    document.getElementById('by-month'),
    MONTHS.map((_, i) => i),
    MONTHS,
    tally(rows, monthOf),
    names,
  );
}

function renderSummary() {
  const el = document.getElementById('summary');
  if (!state.rows.length) {
    el.textContent = 'No bookings recorded yet.';
    return;
  }
  const dates = state.rows.map((b) => b.date).sort();
  // Counted from the rows, not from state.people, so this stays correct no
  // matter what order the summary and the tables are built in.
  const people = new Set(state.rows.map(keyOf)).size;
  el.textContent =
    `${state.rows.length} hours booked by ${people} ${people === 1 ? 'person' : 'people'}, ` +
    `between ${dates[0]} and ${dates[dates.length - 1]}.`;
}

function downloadCsv(names) {
  const counts = new Map(); // 'key\tYYYY\tMM' -> hours
  for (const b of state.rows) {
    const k = `${keyOf(b)}\t${yearOf(b)}\t${b.date.slice(5, 7)}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ['name,year,month,hours'];
  for (const [k, hours] of [...counts.entries()].sort()) {
    const [key, year, month] = k.split('\t');
    lines.push([quote(names.get(key)), year, month, hours].join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fume-hood-usage-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function start() {
  document.getElementById('hood-name').textContent = `${CFG.hoodName} — usage`;
  document.getElementById('lock-btn').addEventListener('click', lockAndReload);

  if (store.mode === 'demo') {
    const badge = document.getElementById('mode-badge');
    badge.hidden = false;
    badge.textContent = 'Demo mode — this browser only';
  }

  try {
    state.rows = await store.listAll();
  } catch (err) {
    document.getElementById('summary').textContent = `Could not load bookings: ${err.message}`;
    document.getElementById('summary').classList.add('error');
    return;
  }

  renderSummary();

  if (!state.rows.length) {
    // Nothing to tabulate: one message beats a summary plus two empty tables.
    for (const section of document.querySelectorAll('.stats section')) section.hidden = true;
    document.getElementById('csv-btn').disabled = true;
    return;
  }

  const names = displayNames(state.rows);
  const hoursPerPerson = tally(state.rows, () => 'all');

  state.people = [...names.keys()].sort((a, b) => {
    const diff = (hoursPerPerson.get(b)?.get('all') || 0) - (hoursPerPerson.get(a)?.get('all') || 0);
    return diff || names.get(a).localeCompare(names.get(b));
  });
  state.years = [...new Set(state.rows.map(yearOf))].sort();

  renderYearTable(names);

  const select = document.getElementById('year-select');
  const thisYear = String(new Date().getFullYear());
  const options = state.years.length ? state.years : [thisYear];
  select.replaceChildren(
    ...options.map((y) => {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      return o;
    }),
  );
  select.value = options.includes(thisYear) ? thisYear : options[options.length - 1];
  select.addEventListener('change', () => renderMonthTable(names, select.value));
  renderMonthTable(names, select.value);

  document.getElementById('csv-btn').addEventListener('click', () => downloadCsv(names));
}

unlockThen(start);
