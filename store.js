/*
 * Storage layer.
 *
 * Two interchangeable backends behind one interface:
 *
 *   list(fromDate, toDate) -> [{ id, date, hour, name }]
 *   listAll()              -> every booking ever made, for the statistics
 *   create(rows)           -> creates bookings, throws Conflict if taken
 *   removeMany(ids)        -> deletes bookings, in one round trip
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

  async listAll() {
    return this._all();
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

  async removeMany(ids) {
    const drop = new Set(ids);
    this._save(this._all().filter((b) => !drop.has(b.id)));
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

    // A successful insert answers 201 with an empty body and a delete answers
    // 204, so parse only when there is something to parse.
    const body = await res.text();
    return body ? JSON.parse(body) : null;
  }

  return {
    mode: 'shared',

    list(from, to) {
      return call(`?select=id,date,hour,name&date=gte.${from}&date=lte.${to}`);
    },

    async listAll() {
      // PostgREST caps a response at 1000 rows, so walk the table in pages
      // rather than silently reporting statistics for only part of it.
      const page = 1000;
      const all = [];
      for (let offset = 0; ; offset += page) {
        const rows = await call(
          `?select=id,date,hour,name&order=date.asc,hour.asc&limit=${page}&offset=${offset}`,
        );
        all.push(...rows);
        if (rows.length < page) return all;
      }
    },

    create(rows) {
      return call('', { method: 'POST', body: JSON.stringify(rows) });
    },

    removeMany(ids) {
      // One request for the whole block, so a multi-hour release can't half-fail.
      const list = ids.map(encodeURIComponent).join(',');
      return call(`?id=in.(${list})`, { method: 'DELETE' });
    },
  };
}

function createStore(config) {
  const s = config.supabase || {};
  return s.url && s.anonKey ? makeSupabaseStore(s) : LocalStore;
}
