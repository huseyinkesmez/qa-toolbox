/* ==========================================================================
   Shared helpers used by tools.js and app.js
   ========================================================================== */
'use strict';

const QA = {};

/** localStorage wrapper that never throws (private mode, blocked storage…). */
QA.storage = {
  prefix: 'qa-toolbox:',
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  },
  clear() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(this.prefix))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  },
};

/** Escape text for safe insertion into innerHTML. */
QA.escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Show a short message at the bottom of the screen. */
QA.toast = (() => {
  let timer;
  return (message) => {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 1800);
  };
})();

/** Copy text to the clipboard, with a fallback for non-secure contexts (file://). */
QA.copy = async (text) => {
  if (!text) {
    QA.toast('Nothing to copy');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  QA.toast('Copied to clipboard');
};

/** Write a result into an .output element. `state` is '', 'error' or 'success'. */
QA.setOutput = (el, text, state = '') => {
  el.textContent = text;
  el.classList.toggle('is-error', state === 'error');
  el.classList.toggle('is-success', state === 'success');
};

/** Cryptographically secure random integer in [0, max). */
QA.randomInt = (max) => {
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
};

QA.pick = (arr) => arr[QA.randomInt(arr.length)];

/** RFC 4122 v4 UUID. crypto.randomUUID only exists in secure contexts. */
QA.uuid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/** UTF-8 safe Base64 (btoa/atob only handle Latin-1). */
QA.base64 = {
  encode(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  },
  /** Decode to raw bytes. Accepts base64url and missing padding as well. */
  decodeBytes(b64) {
    let s = b64.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (s.length % 4 === 1) throw new Error('Invalid Base64 length');
    s += '='.repeat((4 - (s.length % 4)) % 4);
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  },
  /** Decode to UTF-8 text; throws if the bytes are not valid UTF-8. */
  decode(b64) {
    return new TextDecoder('utf-8', { fatal: true }).decode(this.decodeBytes(b64));
  },
};

/** Format a JSON.parse error with line/column when the engine provides a position. */
QA.jsonError = (input, err) => {
  const m = /position (\d+)/i.exec(err.message);
  // Newer engines already include line/column in the message.
  if (!m || /line \d+/i.test(err.message)) return `Invalid JSON: ${err.message}`;
  const pos = Number(m[1]);
  const before = input.slice(0, pos).split('\n');
  return `Invalid JSON at line ${before.length}, column ${before[before.length - 1].length + 1}: ${err.message}`;
};
