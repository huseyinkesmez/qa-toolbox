/* ==========================================================================
   Cron expression parser (standard 5-field syntax + @macros)
   QA.cron.parse(expr)        -> { fields, raw } or throws Error
   QA.cron.describe(parsed)   -> human readable sentence
   QA.cron.nextRuns(parsed,n) -> array of Date
   ========================================================================== */
'use strict';

QA.cron = (() => {
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const FIELDS = [
    { key: 'minute', min: 0, max: 59 },
    { key: 'hour', min: 0, max: 23 },
    { key: 'dayOfMonth', min: 1, max: 31 },
    { key: 'month', min: 1, max: 12, names: MONTHS, nameOffset: 1 },
    { key: 'dayOfWeek', min: 0, max: 7, names: DAYS, nameOffset: 0 },
  ];

  const MACROS = {
    '@yearly': '0 0 1 1 *',
    '@annually': '0 0 1 1 *',
    '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *',
    '@midnight': '0 0 * * *',
    '@hourly': '0 * * * *',
  };

  function toNumber(token, field) {
    const upper = token.toUpperCase();
    if (field.names && field.names.includes(upper)) return field.names.indexOf(upper) + field.nameOffset;
    if (!/^\d+$/.test(token)) throw new Error(`"${token}" is not a valid ${field.key} value`);
    const n = Number(token);
    if (n < field.min || n > field.max) {
      throw new Error(`${field.key} value ${n} is out of range (${field.min}-${field.max})`);
    }
    return n;
  }

  /** Expand one field (e.g. "1-5,10/2") into a sorted Set of numbers. */
  function parseField(text, field) {
    const values = new Set();
    for (const part of text.split(',')) {
      if (part === '') throw new Error(`Empty list item in ${field.key}`);
      const [range, stepText] = part.split('/');
      const step = stepText === undefined ? 1 : Number(stepText);
      if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step "${stepText}" in ${field.key}`);

      let start, end;
      if (range === '*' || range === '?') {
        start = field.min;
        end = field.key === 'dayOfWeek' ? 6 : field.max;
      } else if (range.includes('-')) {
        const [a, b] = range.split('-');
        start = toNumber(a, field);
        end = toNumber(b, field);
        if (start > end) throw new Error(`Range ${range} in ${field.key} is reversed`);
      } else {
        start = toNumber(range, field);
        // "5/15" means "starting at 5, every 15"
        end = stepText === undefined ? start : field.max;
      }
      for (let v = start; v <= end; v += step) values.add(field.key === 'dayOfWeek' ? v % 7 : v);
    }
    return values;
  }

  function parse(expr) {
    const raw = expr.trim().replace(/\s+/g, ' ');
    const expanded = MACROS[raw.toLowerCase()] || raw;
    const parts = expanded.split(' ');
    if (parts.length !== 5) {
      throw new Error(`Expected 5 fields (minute hour day-of-month month day-of-week), got ${parts.length}`);
    }
    const fields = {};
    FIELDS.forEach((field, i) => {
      fields[field.key] = { text: parts[i], values: parseField(parts[i], field) };
    });
    return { raw, fields };
  }

  // ---------- Description ----------

  const pad = (n) => String(n).padStart(2, '0');

  function listText(values, nameFn = String) {
    const arr = [...values].sort((a, b) => a - b).map(nameFn);
    if (arr.length <= 1) return arr.join('');
    return `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;
  }

  /** Describe a field token like "*\/15", "1-5", "MON-FRI". Returns null for "*". */
  function fieldPhrase(field, unit, nameFn = String) {
    const t = field.text;
    if (t === '*' || t === '?') return null;
    const step = /^\*\/(\d+)$/.exec(t);
    if (step) return `every ${step[1]} ${unit}s`;
    const range = /^([^,/]+)-([^,/]+)$/.exec(t);
    if (range) {
      const vals = [...field.values].sort((a, b) => a - b);
      return `${unit}s ${nameFn(vals[0])} through ${nameFn(vals[vals.length - 1])}`;
    }
    return `${unit} ${listText(field.values, nameFn)}`;
  }

  function describe({ fields }) {
    const { minute, hour, dayOfMonth, month, dayOfWeek } = fields;
    const isSingle = (f) => /^\d+$/.test(f.text);
    let time;

    if (isSingle(minute) && isSingle(hour)) {
      time = `At ${pad(hour.text)}:${pad(minute.text)}`;
    } else if (isSingle(minute) && hour.text !== '*') {
      time = `At ${listText(hour.values, (h) => `${pad(h)}:${pad(minute.text)}`)}`;
    } else {
      const m = fieldPhrase(minute, 'minute');
      const h = fieldPhrase(hour, 'hour', pad);
      if (!m && !h) time = 'Every minute';
      else if (!m) time = `Every minute of ${h}`;
      else if (minute.text === '0' && !h) time = 'Every hour, on the hour';
      else time = `${m.startsWith('every') ? m[0].toUpperCase() + m.slice(1) : `At ${m}`}${h ? `, past ${h}` : isSingle(minute) ? ' past every hour' : ''}`;
    }

    const parts = [time];
    const dom = fieldPhrase(dayOfMonth, 'day-of-month');
    const dow = fieldPhrase(dayOfWeek, 'day', (d) => DAY_NAMES[d]);
    const mon = fieldPhrase(month, 'month', (m) => MONTH_NAMES[m - 1]);
    if (dom && dow) parts.push(`on ${dom} or on ${dow.replace(/^days? /, '')}`);
    else if (dom) parts.push(`on ${dom}`);
    else if (dow) parts.push(`on ${dow.replace(/^days? /, '')}`);
    if (mon) parts.push(`in ${mon.replace(/^months? /, '')}`);
    return parts.join(', ');
  }

  // ---------- Next run times ----------

  function matchesDay(fields, date) {
    const domRestricted = fields.dayOfMonth.text !== '*' && fields.dayOfMonth.text !== '?';
    const dowRestricted = fields.dayOfWeek.text !== '*' && fields.dayOfWeek.text !== '?';
    const domOk = fields.dayOfMonth.values.has(date.getDate());
    const dowOk = fields.dayOfWeek.values.has(date.getDay());
    // Standard cron: when both are restricted, either may match.
    if (domRestricted && dowRestricted) return domOk || dowOk;
    return domOk && dowOk;
  }

  function nextRuns({ fields }, count = 5, from = new Date()) {
    const runs = [];
    const d = new Date(from);
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    const limit = new Date(from);
    limit.setFullYear(limit.getFullYear() + 5);

    while (runs.length < count && d < limit) {
      if (!fields.month.values.has(d.getMonth() + 1)) {
        d.setMonth(d.getMonth() + 1, 1);
        d.setHours(0, 0, 0, 0);
      } else if (!matchesDay(fields, d)) {
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
      } else if (!fields.hour.values.has(d.getHours())) {
        d.setHours(d.getHours() + 1, 0, 0, 0);
      } else if (!fields.minute.values.has(d.getMinutes())) {
        d.setMinutes(d.getMinutes() + 1, 0, 0);
      } else {
        runs.push(new Date(d));
        d.setMinutes(d.getMinutes() + 1, 0, 0);
      }
    }
    return runs;
  }

  return { parse, describe, nextRuns };
})();
