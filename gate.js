/*
 * The shared password gate, used by every page.
 *
 * A page that needs gating includes the markup from index.html's #gate block
 * and calls unlockThen(fn); fn runs once the passphrase is accepted. The
 * unlock is remembered per browser session, so moving between the calendar
 * and the statistics does not ask again.
 */

const UNLOCK_KEY = 'fumehood.unlocked';

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function unlockThen(start) {
  const gate = document.getElementById('gate');
  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-input');
  const error = document.getElementById('gate-error');
  document.getElementById('gate-hood').textContent = CFG.hoodName;

  const open = () => {
    gate.hidden = true;
    document.getElementById('app').hidden = false;
    start();
  };

  if (sessionStorage.getItem(UNLOCK_KEY) === CFG.passwordHash) {
    open();
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await sha256Hex(input.value) === CFG.passwordHash) {
      sessionStorage.setItem(UNLOCK_KEY, CFG.passwordHash);
      open();
    } else {
      error.hidden = false;
      input.select();
    }
  });

  input.focus();
}

function lockAndReload() {
  sessionStorage.removeItem(UNLOCK_KEY);
  location.reload();
}
