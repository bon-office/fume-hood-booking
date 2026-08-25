# Fume hood booking

A tiny booking calendar for a single fume hood. One shared lab password, a week
view of hourly slots, click or drag to book.

No build step, no framework — four static files, so it deploys straight to
GitHub Pages.

## Try it locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> and use the default password **`fumehood`**.

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
4. Put both into `config.js`:

   ```js
   supabase: {
     url: 'https://abcdefghijkl.supabase.co',
     anonKey: 'eyJhbGciOi...',
   },
   ```

5. Commit and push. The "Demo mode" badge disappears and everyone sees the same
   calendar, refreshed every 30 seconds.

Double-booking is prevented by the database itself (`unique (date, hour)`), not
by the browser — so two people clicking the same slot at the same moment can't
both win.

## How secure is this, really?

**It is a doorlock, not security.** Be clear-eyed about it:

- The password hash and the Supabase anon key sit in files any visitor can read.
  A determined person who has the page URL can bypass the prompt and reach the
  data directly.
- The password stops casual passers-by and web crawlers. That's its whole job.
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
| [`config.js`](config.js) | All settings — the only file you normally edit |
| [`store.js`](store.js) | Storage layer: browser-local, or Supabase when configured |
| [`app.js`](app.js) | Grid rendering, drag-to-select, booking and release |
| [`style.css`](style.css) | Styling, including a dark mode |
| [`supabase/schema.sql`](supabase/schema.sql) | Table and access policies for shared mode |
