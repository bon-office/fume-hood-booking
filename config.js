/*
 * Fume hood booking — configuration
 *
 * Everything you normally want to change lives in this file.
 * Edit it, commit, push — GitHub Pages picks it up on the next deploy.
 */
window.FUMEHOOD_CONFIG = {

  // Shown in the header. Name your hood however the lab refers to it.
  hoodName: 'Fume hood C1:3042',

  // SHA-256 hash of the shared password.
  // Generate a new one with:
  //   printf 'your-new-password' | shasum -a 256
  // and paste the hex string here (no trailing spaces).
  passwordHash: '02da0ef15124fd1c6c706b6bc181f973c0c3c9241ff386d44c03d286a6fdb047',

  // Bookable window, in whole hours (24 h clock). 7 → 19 means the first
  // slot is 07:00–08:00 and the last is 18:00–19:00.
  dayStartHour: 7,
  dayEndHour: 19,

  // Show weekends in the grid at all?
  includeWeekends: true,

  // Guardrails.
  maxHoursPerBooking: 8,   // longest single drag-selection
  maxDaysAhead: 60,        // how far into the future booking is allowed
  allowCancelOthers: true, // lab honour system: anyone may free someone else's slot

  /*
   * Shared storage (optional).
   *
   * Leave url/anonKey empty and the app runs in DEMO mode: bookings are kept
   * in this browser only, so nobody else sees them. Good for trying it out.
   *
   * Fill both in and every visitor sees the same live calendar.
   * See README.md → "Shared bookings" for the 5-minute Supabase setup.
   */
  supabase: {
    url: 'https://wmiquhcxnicsowbmvfkf.supabase.co',
    anonKey: 'sb_publishable_DDMuOi2pd8H5811ZJTEITA_8r_TuTGp',
  },
};
