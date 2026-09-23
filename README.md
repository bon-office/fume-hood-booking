# Fume hood booking

A tiny booking calendar for fume hood **C1:3042**. One shared lab password, a
week view of hourly slots, click or drag to book.

No build step, no framework — four static files, so it deploys straight to
GitHub Pages.

## Where it runs

- **Live at** <https://gits-15.sys.kth.se/pages/uvogt/fume-hood-booking/>, served
  by GitHub Pages on KTH's GitHub Enterprise instance.
- That instance runs in private mode, so **visitors must be signed in to KTH
  GitHub** before the page loads at all. Anonymous requests — including requests
  for `config.js` — are redirected to the KTH login.
- Bookings live in a Supabase project (`wmiquhcxnicsowbmvfkf`). To publish a
  change: commit, `git push`, and Pages redeploys within a minute or two.

### Keeping Supabase awake

A Supabase project on the free plan **pauses itself after about a week with no
API requests**. In term time the lab's own bookings keep it awake; a long
holiday is the risk. Nothing is lost if it does pause — unpausing is one click
in the dashboard, within 90 days.

An external scheduler (cron-job.org) fetches this URL **once an hour**, which
counts as activity:

```
https://wmiquhcxnicsowbmvfkf.supabase.co/rest/v1/bookings?select=id&limit=0&apikey=sb_publishable_DDMuOi2pd8H5811ZJTEITA_8r_TuTGp
```

`limit=0` is deliberate: the request proves the project is alive without the
response ever carrying a booking or a name. The key travels in the query string
because it lets any plain URL monitor do the job with no custom headers.

**Hourly, not daily.** A once-a-day ping was tried first and Supabase still
sent "scheduled to be paused" warnings; at hourly the warnings stopped. One
request an hour returning an empty `[]` costs nothing worth counting, so there
is no reason to trim it back — and the daily experiment says trimming it is
what causes trouble.

If the calendar ever fails to load after a quiet spell, check the scheduler
first — a run of failures there is the early warning.

## Try it locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> and enter the lab password. (The password
itself is deliberately not written down in this repo — ask in the lab.)

Opening `index.html` directly as a `file://` URL will not work: browsers block
`crypto.subtle` (used to hash the password) outside a secure context. Any local
server, as above, is fine.

## Put it on GitHub Pages

```bash
git remote add origin git@github.com:<you>/fume-hood-booking.git
git push -u origin main
```

Then in the repository: **Settings → Pages → Source: Deploy from a branch →
`main` / `/ (root)` → Save**. A minute later it is live at
`https://<you>.github.io/fume-hood-booking/`.

## Usage statistics

The **Statistics** button in the calendar's header opens `stats.html`: hours
booked per person per year, and per person per month for a chosen year, with a
CSV download for anything further. One booked hour counts as one hour, and
names are grouped case-insensitively so "Uli" and "uli" are one person.

Both pages share the same password, and unlocking one unlocks the other for
that browser session.

## Changing the CSS or JS

Browsers cache `store.js`, `app.js` and the rest hard enough that a visitor can
end up running a new page against an old script — which fails in confusing
ways rather than cleanly. Every reference carries a `?v=N` stamp; bump it
before committing a CSS or JS change:

```bash
./scripts/bump-version.sh
```

## Configure it

Everything you'd normally change is in [`config.js`](config.js): hood name,
opening hours, weekends on/off, how far ahead people may book, the longest
single booking, and the password.

To change the password, hash the new one and paste the result into
`config.js` → `passwordHash`:

```bash
printf 'your-new-password' | shasum -a 256
```

## Shared bookings

Out of the box the app runs in **demo mode**: bookings are stored in the
visitor's own browser, so nobody else sees them. That's fine for trying the
interface out, but useless as a lab calendar.

GitHub Pages only serves files — it can't store anything — so shared bookings
need one free external database. Supabase takes about five minutes:

1. Create a free project at <https://supabase.com>.
2. **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), run it.
3. **Project Settings → API**, copy the *Project URL* and the *anon public* key.
4. Hand both to the helper script, which writes them into `config.js` and
   checks that the table can actually be read, written and deleted with that
   key:

   ```bash
   ./scripts/connect-supabase.sh https://abcdefghijkl.supabase.co eyJhbGciOi...
   ```

5. Commit and push. The "Demo mode" badge disappears and everyone sees the same
   calendar, refreshed every 30 seconds.

The anon key belongs in the repo — it is designed to be public, and the table
policies in step 2 are what decide what it may do.

Double-booking is prevented by the database itself (`unique (date, hour)`), not
by the browser — so two people clicking the same slot at the same moment can't
both win.

## How secure is this, really?

**It is a doorlock, not security.** Be clear-eyed about it:

- The password hash and the Supabase anon key sit in files any visitor can read.
  A determined person who has the page URL can bypass the prompt and reach the
  data directly.
- The password stops casual passers-by and web crawlers. That's its whole job.
  A short password's hash can be brute-forced offline in seconds by anyone who
  reads `config.js`, so don't lean on it for more than that.
- So: use a password you don't use anywhere else, keep the repo private if you
  prefer (Pages works on private repos with GitHub Team/Enterprise), and put
  nothing confidential in a booking name. First names are plenty.

If the hood ever needs real access control — audit trail, per-person accounts,
KTH login — that needs a server-side app, and this static version is the wrong
foundation for it. Worth knowing before it grows.

## Files

| File | What it is |
| --- | --- |
| [`index.html`](index.html) | Page structure: password gate + calendar |
| [`stats.html`](stats.html) / [`stats.js`](stats.js) | Usage statistics per person, per month and year |
| [`gate.js`](gate.js) | The password gate, shared by both pages |
| [`config.js`](config.js) | All settings — the only file you normally edit |
| [`store.js`](store.js) | Storage layer: browser-local, or Supabase when configured |
| [`app.js`](app.js) | Grid rendering, drag-to-select, booking and release |
| [`style.css`](style.css) | Styling, including a dark mode |
| [`supabase/schema.sql`](supabase/schema.sql) | Table and access policies for shared mode |
| [`scripts/connect-supabase.sh`](scripts/connect-supabase.sh) | Connects the app to a Supabase project and verifies it |
| [`scripts/bump-version.sh`](scripts/bump-version.sh) | Busts browser caches after a CSS/JS change |
