/*
 * Storage layer.
 *
 * Two interchangeable backends behind one interface:
 *
 *   list(fromDate, toDate) -> [{ id, date, hour, name }]
 *   create(rows)           -> creates bookings, throws Conflict if taken
 *   remove(id)             -> deletes one booking
 *
 * Dates are ISO strings 'YYYY-MM-DD'; hour is an integer 0-23 meaning the
 * slot hour:00 - (hour+1):00 local time.
 */

class Conflict extends Error {}

const LocalStore = {
  mode: 'demo',
  key: 'fumehood.bookings.v1',

  _all() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || [];
    } catch {
      return [];
    }
  },

  _save(rows) {
    localStorage.setItem(this.key, JSON.stringify(rows));
  },

  async list(from, to) {
    return this._all().filter((b) => b.date >= from && b.date <= to);
  },

  async create(rows) {
    const all = this._all();
    const taken = new Set(all.map((b) => `${b.date}#${b.hour}`));
    for (const r of rows) {
      if (taken.has(`${r.date}#${r.hour}`)) throw new Conflict();
    }
    for (const r of rows) {
      all.push({ ...r, id: `${r.date}#${r.hour}` });
    }
    this._save(all);
  },

  async remove(id) {
    this._save(this._all().filter((b) => b.id !== id));
  },
};

function makeSupabaseStore({ url, anonKey }) {
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/bookings`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  };

  async function call(path, options = {}) {
    const res = await fetch(endpoint + path, { ...options, headers: { ...headers, ...options.headers } });
    if (res.status === 409) throw new Conflict();
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }

  return {
    mode: 'shared',

    list(from, to) {
      return call(`?select=id,date,hour,name&date=gte.${from}&date=lte.${to}`);
    },

    create(rows) {
      return call('', { method: 'POST', body: JSON.stringify(rows) });
    },

    remove(id) {
      return call(`?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}

function createStore(config) {
  const s = config.supabase || {};
  return s.url && s.anonKey ? makeSupabaseStore(s) : LocalStore;
}
