/* ==========================================================================
   Tool definitions

   Each tool is a plain object:
     id        – unique id, also used as the section anchor (#id)
     icon      – emoji shown next to the title
     title     – display name
     category  – one of CATEGORIES
     keywords  – extra words for the search box
     info      – help text shown by the ⓘ button
     template  – inner HTML of the tool body
     setup(ui) – wires up events. `ui` is created by app.js:
                   ui.$(ref)          -> element with data-ref="ref" inside this tool
                   ui.$$(selector)    -> all matching elements inside this tool
                   ui.load(key, def)  -> value saved for this tool
                   ui.save(key, val)  -> save a value for this tool

   Inputs with a `data-persist` attribute are restored by app.js *before*
   setup() runs, so setup() can simply compute from their current values.
   ========================================================================== */
'use strict';

const CATEGORIES = ['Data & Format', 'Encoding', 'Generators', 'Web & API', 'Testing'];

/** Output box with a copy button. */
const outputBox = (ref, placeholder = 'Result will appear here', rows = '') =>
  `<div class="output-wrap">
     <pre class="output" data-ref="${ref}" data-placeholder="${placeholder}"${rows ? ` style="min-height:${rows}"` : ''}></pre>
     <button type="button" class="btn btn-secondary btn-sm copy-btn" data-copy="${ref}">Copy</button>
   </div>`;

/** Key/value row with its own copy button. */
const kvRow = (key, value) =>
  `<div class="kv-item">
     <span class="kv-key">${QA.escapeHtml(key)}</span>
     <span class="kv-value">${QA.escapeHtml(value)}</span>
     <button type="button" class="btn btn-secondary btn-sm" data-copy-value="${QA.escapeHtml(value)}">Copy</button>
   </div>`;

const HTTP_STATUS = [
  [100, 'Continue', 'The client should continue with its request.'],
  [101, 'Switching Protocols', 'The server is switching protocols (e.g. to WebSocket).'],
  [102, 'Processing', 'The server has received the request and is still processing it.'],
  [103, 'Early Hints', 'Preliminary headers sent before the final response (e.g. preload links).'],
  [200, 'OK', 'The request succeeded.'],
  [201, 'Created', 'The request succeeded and a new resource was created. Check the Location header.'],
  [202, 'Accepted', 'The request was accepted for processing but is not finished yet (async job).'],
  [203, 'Non-Authoritative Information', 'Returned metadata comes from a proxy / copy, not the origin server.'],
  [204, 'No Content', 'Success with no response body. Common for DELETE and PUT.'],
  [205, 'Reset Content', 'The client should reset the document view (e.g. clear a form).'],
  [206, 'Partial Content', 'Only part of the resource is returned, in reply to a Range header.'],
  [207, 'Multi-Status', 'WebDAV: the body contains multiple status codes.'],
  [208, 'Already Reported', 'WebDAV: members were already listed earlier in the response.'],
  [226, 'IM Used', 'The response is the result of instance manipulations (delta encoding).'],
  [300, 'Multiple Choices', 'The resource has several representations to choose from.'],
  [301, 'Moved Permanently', 'The resource has a new permanent URL. Clients may change POST to GET.'],
  [302, 'Found', 'Temporary redirect. Clients may change POST to GET.'],
  [303, 'See Other', 'Redirect to another resource using GET (typical after a form POST).'],
  [304, 'Not Modified', 'Cached version is still valid (conditional request with ETag / If-Modified-Since).'],
  [307, 'Temporary Redirect', 'Temporary redirect that keeps the original method and body.'],
  [308, 'Permanent Redirect', 'Permanent redirect that keeps the original method and body.'],
  [400, 'Bad Request', 'Malformed request: invalid syntax, body or parameters.'],
  [401, 'Unauthorized', 'Authentication is missing or invalid. Check the token / credentials.'],
  [402, 'Payment Required', 'Reserved; some APIs use it for billing or quota problems.'],
  [403, 'Forbidden', 'Authenticated but not allowed to access this resource.'],
  [404, 'Not Found', 'The resource does not exist (or is hidden from this user).'],
  [405, 'Method Not Allowed', 'The HTTP method is not supported for this endpoint. Check the Allow header.'],
  [406, 'Not Acceptable', 'No representation matches the Accept headers sent by the client.'],
  [407, 'Proxy Authentication Required', 'The client must authenticate with the proxy.'],
  [408, 'Request Timeout', 'The server timed out waiting for the request.'],
  [409, 'Conflict', 'The request conflicts with the current state (e.g. duplicate or version conflict).'],
  [410, 'Gone', 'The resource was permanently removed.'],
  [411, 'Length Required', 'The Content-Length header is required.'],
  [412, 'Precondition Failed', 'A precondition header (If-Match, If-Unmodified-Since) did not match.'],
  [413, 'Content Too Large', 'The request body is larger than the server allows.'],
  [414, 'URI Too Long', 'The request URL is longer than the server allows.'],
  [415, 'Unsupported Media Type', 'The Content-Type of the body is not supported.'],
  [416, 'Range Not Satisfiable', 'The requested Range cannot be served.'],
  [417, 'Expectation Failed', 'The Expect header could not be met.'],
  [418, "I'm a teapot", 'Easter egg from RFC 2324. Sometimes used for blocked bots.'],
  [421, 'Misdirected Request', 'The request was sent to a server that cannot produce a response.'],
  [422, 'Unprocessable Content', 'Valid syntax but semantic validation failed (typical for form/field errors).'],
  [423, 'Locked', 'WebDAV: the resource is locked.'],
  [424, 'Failed Dependency', 'WebDAV: a previous request this one depends on failed.'],
  [425, 'Too Early', 'The server refuses to process a request that might be replayed.'],
  [426, 'Upgrade Required', 'The client should switch to a different protocol.'],
  [428, 'Precondition Required', 'The server requires a conditional request (e.g. If-Match).'],
  [429, 'Too Many Requests', 'Rate limit exceeded. Check the Retry-After header.'],
  [431, 'Request Header Fields Too Large', 'Headers (often cookies) are too large.'],
  [451, 'Unavailable For Legal Reasons', 'Blocked for legal reasons (e.g. censorship, GDPR).'],
  [500, 'Internal Server Error', 'Unhandled error on the server. Check server logs.'],
  [501, 'Not Implemented', 'The server does not support the requested functionality.'],
  [502, 'Bad Gateway', 'A gateway / proxy got an invalid response from the upstream server.'],
  [503, 'Service Unavailable', 'The server is overloaded or down for maintenance. Check Retry-After.'],
  [504, 'Gateway Timeout', 'A gateway / proxy did not get a response from upstream in time.'],
  [505, 'HTTP Version Not Supported', 'The HTTP version used is not supported.'],
  [506, 'Variant Also Negotiates', 'Server configuration error in content negotiation.'],
  [507, 'Insufficient Storage', 'WebDAV: the server cannot store the representation.'],
  [508, 'Loop Detected', 'WebDAV: infinite loop detected while processing.'],
  [510, 'Not Extended', 'Further extensions to the request are required.'],
  [511, 'Network Authentication Required', 'The client must authenticate to gain network access (captive portal).'],
];

const HTTP_CLASSES = {
  1: 'Informational',
  2: 'Success',
  3: 'Redirection',
  4: 'Client Error',
  5: 'Server Error',
};

const FAKE = {
  firstNames: ['James', 'Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Elijah', 'Sophia', 'Lucas', 'Mia', 'Mason', 'Amelia', 'Ethan', 'Harper', 'Benjamin', 'Ella', 'Henry', 'Zoe', 'Leo', 'Nora', 'Ali', 'Elif', 'Mehmet', 'Zeynep'],
  lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Martin', 'Lee', 'Clark', 'Walker', 'Young', 'Yilmaz', 'Kaya'],
  streets: ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd', 'Elm St', 'Lake View Blvd', 'Sunset Ave', 'Hillcrest Rd', 'River Rd'],
  cities: [['Springfield', 'IL'], ['Austin', 'TX'], ['Denver', 'CO'], ['Portland', 'OR'], ['Madison', 'WI'], ['Raleigh', 'NC'], ['Boise', 'ID'], ['Columbus', 'OH']],
  companies: ['Acme Corp', 'Globex', 'Initech', 'Umbrella Labs', 'Stark Industries', 'Wayne Enterprises', 'Hooli', 'Vandelay Industries'],
};

const TOOLS = [
  /* ------------------------------------------------------------------ */
  {
    id: 'timestamp',
    icon: '⏱',
    title: 'Timestamp Converter',
    category: 'Data & Format',
    keywords: 'unix epoch date time utc iso milliseconds seconds',
    info: 'Convert Unix timestamps to readable dates and back. Seconds, milliseconds and microseconds are detected automatically. Example: 1709899200 → 2024-03-08T12:00:00Z.',
    template: `
      <div>
        <label for="ts-unix">Unix timestamp → Date</label>
        <div class="row">
          <input type="text" inputmode="numeric" id="ts-unix" data-ref="unix" data-persist placeholder="e.g. 1700000000 or 1700000000000">
          <button type="button" class="btn btn-secondary" data-ref="now">Now</button>
        </div>
      </div>
      ${outputBox('unixOut')}
      <div>
        <label for="ts-date">Date → Unix timestamp</label>
        <div class="row">
          <input type="datetime-local" id="ts-date" step="1" data-ref="date" data-persist>
          <select data-ref="zone" data-persist aria-label="Time zone" style="flex:0 0 7rem">
            <option value="local">Local</option>
            <option value="utc">UTC</option>
          </select>
        </div>
      </div>
      ${outputBox('dateOut')}`,
    setup(ui) {
      const unix = ui.$('unix');
      const date = ui.$('date');
      const zone = ui.$('zone');
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

      const relative = (ms) => {
        const diff = (ms - Date.now()) / 1000;
        const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
        const [unit, secs] = units.find(([, s]) => Math.abs(diff) >= s) || units[units.length - 1];
        return rtf.format(Math.round(diff / secs), unit);
      };

      const fromUnix = () => {
        const text = unix.value.trim();
        if (!text) return QA.setOutput(ui.$('unixOut'), '');
        if (!/^-?\d+(\.\d+)?$/.test(text)) return QA.setOutput(ui.$('unixOut'), 'Please enter a numeric timestamp', 'error');

        const n = Number(text);
        const abs = Math.abs(n);
        let ms, unit;
        if (abs < 1e11) { ms = n * 1000; unit = 'seconds'; }
        else if (abs < 1e14) { ms = n; unit = 'milliseconds'; }
        else if (abs < 1e17) { ms = n / 1e3; unit = 'microseconds'; }
        else { ms = n / 1e6; unit = 'nanoseconds'; }

        const d = new Date(ms);
        if (Number.isNaN(d.getTime())) return QA.setOutput(ui.$('unixOut'), 'Timestamp is out of range', 'error');

        QA.setOutput(ui.$('unixOut'), [
          `Detected:  ${unit}`,
          `UTC:       ${d.toISOString()}`,
          `Local:     ${d.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
          `Relative:  ${relative(ms)}`,
        ].join('\n'));
      };

      const fromDate = () => {
        if (!date.value) return QA.setOutput(ui.$('dateOut'), '');
        // datetime-local has no zone; append "Z" to read it as UTC.
        const d = new Date(zone.value === 'utc' ? `${date.value}Z` : date.value);
        if (Number.isNaN(d.getTime())) return QA.setOutput(ui.$('dateOut'), 'Invalid date', 'error');
        QA.setOutput(ui.$('dateOut'), [
          `Seconds:      ${Math.floor(d.getTime() / 1000)}`,
          `Milliseconds: ${d.getTime()}`,
          `ISO 8601:     ${d.toISOString()}`,
        ].join('\n'));
      };

      unix.addEventListener('input', fromUnix);
      date.addEventListener('input', fromDate);
      zone.addEventListener('change', fromDate);
      ui.$('now').addEventListener('click', () => {
        unix.value = String(Math.floor(Date.now() / 1000));
        unix.dispatchEvent(new Event('input', { bubbles: true }));
      });

      fromUnix();
      fromDate();
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'http',
    icon: '📡',
    title: 'HTTP Status Code Lookup',
    category: 'Web & API',
    keywords: 'status code response api rest 404 500 error',
    info: 'Look up an HTTP status code by number (e.g. 429) or search by name (e.g. "timeout"). Use it to check what an API response really means.',
    template: `
      <input type="text" data-ref="query" data-persist aria-label="Status code or name" placeholder="Enter status code (e.g. 404) or text (e.g. timeout)">
      ${outputBox('out', 'Type a code or a word to search')}`,
    setup(ui) {
      const query = ui.$('query');
      const format = ([code, name, desc]) => `${code} ${name}  ·  ${HTTP_CLASSES[Math.floor(code / 100)]}\n${desc}`;

      const lookup = () => {
        const q = query.value.trim().toLowerCase();
        const out = ui.$('out');
        if (!q) return QA.setOutput(out, '');

        if (/^\d+$/.test(q)) {
          const exact = HTTP_STATUS.find(([code]) => String(code) === q);
          if (exact) return QA.setOutput(out, format(exact));
          const cls = HTTP_CLASSES[Number(q[0])];
          if (q.length === 3 && cls) return QA.setOutput(out, `${q} is not a standard code, but ${q[0]}xx means: ${cls}`);
          const partial = HTTP_STATUS.filter(([code]) => String(code).startsWith(q));
          if (partial.length) return QA.setOutput(out, partial.map(format).join('\n\n'));
          return QA.setOutput(out, 'Unknown status code', 'error');
        }

        const matches = HTTP_STATUS.filter(([code, name, desc]) => `${code} ${name} ${desc}`.toLowerCase().includes(q));
        QA.setOutput(out, matches.length ? matches.slice(0, 8).map(format).join('\n\n') : 'No matching status code', matches.length ? '' : 'error');
      };

      query.addEventListener('input', lookup);
      lookup();
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'json',
    icon: '{ }',
    title: 'JSON Formatter & Validator',
    category: 'Data & Format',
    keywords: 'json pretty print beautify minify validate lint api response',
    info: 'Format, minify and validate JSON. Errors show the line and column so you can find broken API responses quickly.',
    template: `
      <textarea data-ref="input" data-persist rows="7" spellcheck="false" aria-label="JSON input" placeholder='Paste JSON here, e.g. {"name":"John","tags":["qa"]}'></textarea>
      <div class="row wrap keep">
        <div class="btn-group">
          <button type="button" class="btn" data-action="format">Format</button>
          <button type="button" class="btn btn-secondary" data-action="minify">Minify</button>
          <button type="button" class="btn btn-secondary" data-action="validate">Validate</button>
        </div>
        <select data-ref="indent" data-persist aria-label="Indentation" style="flex:0 0 8rem">
          <option value="2">2 spaces</option>
          <option value="4">4 spaces</option>
          <option value="tab">Tab</option>
        </select>
        <label class="check"><input type="checkbox" data-ref="sort" data-persist> Sort keys</label>
      </div>
      ${outputBox('out')}`,
    setup(ui) {
      const sortKeys = (value) => {
        if (Array.isArray(value)) return value.map(sortKeys);
        if (value && typeof value === 'object') {
          return Object.keys(value).sort().reduce((acc, k) => { acc[k] = sortKeys(value[k]); return acc; }, {});
        }
        return value;
      };

      const run = (action) => {
        const input = ui.$('input').value;
        const out = ui.$('out');
        if (!input.trim()) return QA.setOutput(out, '');
        ui.save('action', action);

        let data;
        try {
          data = JSON.parse(input);
        } catch (e) {
          return QA.setOutput(out, QA.jsonError(input, e), 'error');
        }
        if (ui.$('sort').checked) data = sortKeys(data);

        const indent = ui.$('indent').value === 'tab' ? '\t' : Number(ui.$('indent').value);
        if (action === 'format') QA.setOutput(out, JSON.stringify(data, null, indent));
        else if (action === 'minify') QA.setOutput(out, JSON.stringify(data));
        else {
          const type = Array.isArray(data) ? `array with ${data.length} item(s)` : data === null ? 'null' : typeof data === 'object' ? `object with ${Object.keys(data).length} key(s)` : typeof data;
          QA.setOutput(out, `✓ Valid JSON (${type})`, 'success');
        }
      };

      ui.$$('[data-action]').forEach((btn) => btn.addEventListener('click', () => run(btn.dataset.action)));
      run(ui.load('action', 'format'));
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'jwt',
    icon: '🔑',
    title: 'JWT Decoder',
    category: 'Encoding',
    keywords: 'json web token auth bearer oauth claims exp decode',
    info: 'Decode a JWT to inspect its header, payload and signature. Time claims (exp, iat, nbf) are shown as dates and the token expiry is checked. The signature is NOT verified.',
    template: `
      <textarea data-ref="input" data-persist rows="3" spellcheck="false" aria-label="JWT" placeholder="Paste a JWT (with or without the 'Bearer ' prefix)"></textarea>
      <div data-ref="status"></div>
      ${outputBox('out', 'Decoded header and payload will appear here')}`,
    setup(ui) {
      const input = ui.$('input');
      const timeClaims = ['exp', 'iat', 'nbf', 'auth_time'];

      const decode = () => {
        const out = ui.$('out');
        const status = ui.$('status');
        status.innerHTML = '';
        const token = input.value.trim().replace(/^Bearer\s+/i, '');
        if (!token) return QA.setOutput(out, '');

        const parts = token.split('.');
        if (parts.length !== 3) return QA.setOutput(out, `Invalid JWT: expected 3 parts separated by ".", got ${parts.length}`, 'error');

        let header, payload;
        try {
          header = JSON.parse(QA.base64.decode(parts[0]));
          payload = JSON.parse(QA.base64.decode(parts[1]));
        } catch (e) {
          return QA.setOutput(out, `Invalid JWT: header or payload is not Base64URL-encoded JSON (${e.message})`, 'error');
        }

        const claimNotes = timeClaims
          .filter((k) => typeof payload[k] === 'number')
          .map((k) => `${k.padEnd(9)} ${new Date(payload[k] * 1000).toISOString()}`);

        QA.setOutput(out, [
          'Header:', JSON.stringify(header, null, 2), '',
          'Payload:', JSON.stringify(payload, null, 2),
          ...(claimNotes.length ? ['', 'Time claims (UTC):', ...claimNotes] : []),
          '', 'Signature (not verified):', parts[2] || '(empty)',
        ].join('\n'));

        const now = Date.now() / 1000;
        if (typeof payload.exp === 'number') {
          status.innerHTML = payload.exp < now
            ? '<span class="badge badge-err">Expired</span>'
            : '<span class="badge badge-ok">Not expired</span>';
        }
        if (typeof payload.nbf === 'number' && payload.nbf > now) {
          status.innerHTML += ' <span class="badge badge-warn">Not valid yet (nbf)</span>';
        }
        if (header.alg === 'none') status.innerHTML += ' <span class="badge badge-warn">alg: none</span>';
      };

      input.addEventListener('input', decode);
      decode();
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'base64',
    icon: '🔤',
    title: 'Base64 Encoder / Decoder',
    category: 'Encoding',
    keywords: 'base64 base64url encode decode auth header basic',
    info: 'Encode and decode Base64 with full UTF-8 support (emoji, Turkish characters…). Decoding also accepts Base64URL. Useful for tokens and Basic auth headers.',
    template: `
      <textarea data-ref="input" data-persist rows="3" spellcheck="false" aria-label="Text or Base64" placeholder="Enter text or Base64"></textarea>
      <div class="row wrap keep">
        <div class="btn-group">
          <button type="button" class="btn" data-action="encode">Encode</button>
          <button type="button" class="btn btn-secondary" data-action="decode">Decode</button>
        </div>
        <label class="check"><input type="checkbox" data-ref="urlSafe" data-persist> URL-safe (Base64URL)</label>
      </div>
      ${outputBox('out')}`,
    setup(ui) {
      const run = (action) => {
        const value = ui.$('input').value;
        const out = ui.$('out');
        if (!value) return QA.setOutput(out, '');
        ui.save('action', action);

        if (action === 'encode') {
          let encoded = QA.base64.encode(value);
          if (ui.$('urlSafe').checked) encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          return QA.setOutput(out, encoded);
        }
        try {
          QA.setOutput(out, QA.base64.decode(value));
        } catch (e) {
          QA.setOutput(out, 'Invalid Base64 (or the decoded bytes are not valid UTF-8 text)', 'error');
        }
      };

      ui.$$('[data-action]').forEach((btn) => btn.addEventListener('click', () => run(btn.dataset.action)));
      run(ui.load('action', 'encode'));
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'url',
    icon: '🔗',
    title: 'URL Encoder / Decoder',
    category: 'Encoding',
    keywords: 'url uri percent encode decode escape query string',
    info: '"Component" encodes everything except letters/digits (use it for query values). "Full URL" keeps characters like : / ? & = intact.',
    template: `
      <textarea data-ref="input" data-persist rows="2" spellcheck="false" aria-label="URL or text" placeholder="Enter a URL or text, e.g. name=John Doe&city=İstanbul"></textarea>
      <div class="row wrap keep">
        <div class="btn-group">
          <button type="button" class="btn" data-action="encode">Encode</button>
          <button type="button" class="btn btn-secondary" data-action="decode">Decode</button>
        </div>
        <select data-ref="mode" data-persist aria-label="Encoding mode" style="flex:0 0 10rem">
          <option value="component">Component</option>
          <option value="full">Full URL</option>
        </select>
      </div>
      ${outputBox('out')}`,
    setup(ui) {
      const run = (action) => {
        const value = ui.$('input').value;
        const out = ui.$('out');
        if (!value) return QA.setOutput(out, '');
        ui.save('action', action);

        const full = ui.$('mode').value === 'full';
        try {
          if (action === 'encode') QA.setOutput(out, full ? encodeURI(value) : encodeURIComponent(value));
          // "+" means space in form-encoded query strings
          else QA.setOutput(out, (full ? decodeURI : decodeURIComponent)(value.replace(/\+/g, ' ')));
        } catch (e) {
          QA.setOutput(out, `Cannot ${action}: the input contains a malformed % sequence`, 'error');
        }
      };

      ui.$$('[data-action]').forEach((btn) => btn.addEventListener('click', () => run(btn.dataset.action)));
      run(ui.load('action', 'encode'));
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'regex',
    icon: '🔍',
    title: 'Regex Tester',
    category: 'Testing',
    keywords: 'regular expression pattern match test validate log',
    info: 'Test a JavaScript regular expression live. Matches are highlighted and capture groups are listed. Flags: g = all matches, i = ignore case, m = multiline ^ $, s = dot matches newline.',
    template: `
      <div class="row keep">
        <input type="text" data-ref="pattern" data-persist spellcheck="false" aria-label="Regex pattern" placeholder="Pattern, e.g. \\b[\\w.-]+@[\\w.-]+\\.\\w+\\b">
      </div>
      <div class="row wrap keep">
        <label class="check"><input type="checkbox" data-ref="g" data-persist checked> g</label>
        <label class="check"><input type="checkbox" data-ref="i" data-persist> i</label>
        <label class="check"><input type="checkbox" data-ref="m" data-persist> m</label>
        <label class="check"><input type="checkbox" data-ref="s" data-persist> s</label>
      </div>
      <textarea data-ref="text" data-persist rows="4" spellcheck="false" aria-label="Test string" placeholder="Test string"></textarea>
      <div>
        <span class="label">Highlighted</span>
        <div class="output" data-ref="preview" data-placeholder="Matches will be highlighted here"></div>
      </div>
      ${outputBox('out', 'Match list')}`,
    setup(ui) {
      const MAX_MATCHES = 1000;

      const test = () => {
        const pattern = ui.$('pattern').value;
        const text = ui.$('text').value;
        const out = ui.$('out');
        const preview = ui.$('preview');
        preview.innerHTML = '';
        if (!pattern) return QA.setOutput(out, '');

        const flags = ['g', 'i', 'm', 's'].filter((f) => ui.$(f).checked).join('');
        let re;
        try {
          // Always iterate with "g"; without the user's g flag we stop after the first match.
          re = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
        } catch (e) {
          return QA.setOutput(out, `Invalid regex: ${e.message}`, 'error');
        }

        const matches = [];
        let m;
        while ((m = re.exec(text)) && matches.length < MAX_MATCHES) {
          matches.push(m);
          if (m[0] === '') re.lastIndex++; // avoid infinite loop on empty matches
          if (!flags.includes('g')) break;
        }

        // Highlight
        let html = '';
        let last = 0;
        matches.forEach((match) => {
          html += QA.escapeHtml(text.slice(last, match.index));
          html += `<mark>${QA.escapeHtml(match[0])}</mark>`;
          last = match.index + match[0].length;
        });
        preview.innerHTML = html + QA.escapeHtml(text.slice(last));

        if (!matches.length) return QA.setOutput(out, 'No match', 'error');
        const lines = matches.map((match, i) => {
          const groups = match.slice(1).map((g, j) => `\n    group ${j + 1}: ${g === undefined ? '(undefined)' : JSON.stringify(g)}`).join('');
          const named = match.groups ? Object.entries(match.groups).map(([k, v]) => `\n    ${k}: ${JSON.stringify(v)}`).join('') : '';
          return `#${i + 1} at ${match.index}: ${JSON.stringify(match[0])}${groups}${named}`;
        });
        const suffix = matches.length >= MAX_MATCHES ? ` (stopped at ${MAX_MATCHES})` : '';
        QA.setOutput(out, `${matches.length} match(es)${suffix}\n\n${lines.join('\n')}`);
      };

      ui.$$('input, textarea').forEach((el) => el.addEventListener('input', test));
      test();
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'password',
    icon: '🔐',
    title: 'Password Generator',
    category: 'Generators',
    keywords: 'password random secure strong test account credentials',
    info: 'Generate secure random passwords (Web Crypto) for test accounts. At least one character from every selected set is guaranteed.',
    template: `
      <div>
        <label for="pw-length">Length: <strong data-ref="lengthLabel">16</strong></label>
        <input type="range" id="pw-length" data-ref="length" data-persist min="4" max="128" value="16">
      </div>
      <div class="row wrap keep">
        <label class="check"><input type="checkbox" data-ref="upper" data-persist checked> Uppercase</label>
        <label class="check"><input type="checkbox" data-ref="lower" data-persist checked> Lowercase</label>
        <label class="check"><input type="checkbox" data-ref="digits" data-persist checked> Numbers</label>
        <label class="check"><input type="checkbox" data-ref="symbols" data-persist checked> Symbols</label>
        <label class="check"><input type="checkbox" data-ref="noAmbiguous" data-persist> Exclude look-alikes (O0Il1)</label>
      </div>
      <div class="row keep"><button type="button" class="btn" data-ref="generate">Generate</button><span data-ref="strength"></span></div>
      ${outputBox('out')}`,
    setup(ui) {
      const SETS = {
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lower: 'abcdefghijklmnopqrstuvwxyz',
        digits: '0123456789',
        symbols: '!@#$%^&*()-_=+[]{};:,.?/',
      };
      const AMBIGUOUS = /[O0Il1]/g;

      const strengthBadge = (bits) => {
        if (bits < 40) return '<span class="badge badge-err">Weak</span>';
        if (bits < 60) return '<span class="badge badge-warn">Fair</span>';
        if (bits < 80) return '<span class="badge badge-ok">Strong</span>';
        return '<span class="badge badge-ok">Very strong</span>';
      };

      const generate = () => {
        const length = Number(ui.$('length').value);
        const sets = Object.keys(SETS)
          .filter((k) => ui.$(k).checked)
          .map((k) => (ui.$('noAmbiguous').checked ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));

        if (!sets.length) {
          ui.$('strength').innerHTML = '';
          return QA.setOutput(ui.$('out'), 'Select at least one character set', 'error');
        }

        const pool = sets.join('');
        const chars = sets.map((s) => QA.pick(s)); // one from each set
        while (chars.length < length) chars.push(QA.pick(pool));
        for (let i = chars.length - 1; i > 0; i--) { // Fisher–Yates shuffle
          const j = QA.randomInt(i + 1);
          [chars[i], chars[j]] = [chars[j], chars[i]];
        }

        QA.setOutput(ui.$('out'), chars.slice(0, length).join(''));
        const bits = Math.round(length * Math.log2(pool.length));
        ui.$('strength').innerHTML = `${strengthBadge(bits)} <span class="hint">≈ ${bits} bits of entropy</span>`;
      };

      ui.$('length').addEventListener('input', () => {
        ui.$('lengthLabel').textContent = ui.$('length').value;
        generate();
      });
      ui.$$('input[type="checkbox"]').forEach((el) => el.addEventListener('change', generate));
      ui.$('generate').addEventListener('click', generate);

      ui.$('lengthLabel').textContent = ui.$('length').value;
      generate();
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'uuid',
    icon: '🆔',
    title: 'UUID Generator',
    category: 'Generators',
    keywords: 'uuid guid v4 random id identifier mock',
    info: 'Generate RFC 4122 version 4 UUIDs (cryptographically random) for test data or mock records.',
    template: `
      <div class="row wrap keep">
        <label class="check" for="uuid-count">Count:</label>
        <input type="number" id="uuid-count" data-ref="count" data-persist min="1" max="500" value="1" style="flex:0 0 6rem">
        <label class="check"><input type="checkbox" data-ref="upper" data-persist> Uppercase</label>
        <label class="check"><input type="checkbox" data-ref="noHyphens" data-persist> No hyphens</label>
        <button type="button" class="btn" data-ref="generate">Generate</button>
      </div>
      ${outputBox('out')}`,
    setup(ui) {
      const generate = () => {
        const count = Math.min(500, Math.max(1, Math.floor(Number(ui.$('count').value)) || 1));
        ui.$('count').value = count;
        const ids = Array.from({ length: count }, () => {
          let id = QA.uuid();
          if (ui.$('noHyphens').checked) id = id.replace(/-/g, '');
          return ui.$('upper').checked ? id.toUpperCase() : id;
        });
        QA.setOutput(ui.$('out'), ids.join('\n'));
      };

      ui.$('generate').addEventListener('click', generate);
      ui.$$('input[type="checkbox"]').forEach((el) => el.addEventListener('change', generate));
      generate();
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'hash',
    icon: '#️⃣',
    title: 'Hash Generator',
    category: 'Generators',
    keywords: 'hash md5 sha1 sha256 sha512 checksum digest',
    info: 'Generate MD5, SHA-1, SHA-256, SHA-384 and SHA-512 hashes of UTF-8 text. MD5 and SHA-1 are not secure — use them only for checksums and test data.',
    template: `
      <textarea data-ref="input" data-persist rows="3" spellcheck="false" aria-label="Text to hash" placeholder="Enter text"></textarea>
      <div class="kv" data-ref="out"></div>`,
    setup(ui) {
      const ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
      let runId = 0;

      const hash = async () => {
        const text = ui.$('input').value;
        const id = ++runId;
        const results = [['MD5', QA.md5(text)]];

        if (crypto.subtle) {
          const data = new TextEncoder().encode(text);
          for (const algo of ALGOS) {
            const buf = await crypto.subtle.digest(algo, data);
            results.push([algo, [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')]);
          }
        } else {
          results.push(['SHA-*', 'Web Crypto is unavailable here (open the page over https or localhost)']);
        }

        if (id === runId) ui.$('out').innerHTML = results.map(([k, v]) => kvRow(k, v)).join(''); // ignore stale runs
      };

      ui.$('input').addEventListener('input', hash);
      hash();
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'query',
    icon: '🔎',
    title: 'Query Parameter Parser',
    category: 'Web & API',
    keywords: 'url query string parameters search params utm parse',
    info: 'Paste a full URL or just a query string (?a=1&b=2). Parameters are decoded and listed; repeated keys are kept.',
    template: `
      <input type="text" data-ref="input" data-persist spellcheck="false" aria-label="URL" placeholder="https://example.com/search?q=qa&page=2&utm_source=mail">
      <div class="kv" data-ref="list"></div>
      ${outputBox('out', 'Parameters as JSON')}`,
    setup(ui) {
      const parse = () => {
        const value = ui.$('input').value.trim();
        const list = ui.$('list');
        const out = ui.$('out');
        list.innerHTML = '';
        if (!value) return QA.setOutput(out, '');

        let params;
        const rows = [];
        try {
          const url = new URL(value);
          params = url.searchParams;
          rows.push(['Base', url.origin + url.pathname]);
          if (url.hash) rows.push(['Hash', url.hash]);
        } catch (e) {
          if (!value.includes('=')) return QA.setOutput(out, 'Invalid URL or query string', 'error');
          params = new URLSearchParams(value.slice(value.indexOf('?') + 1));
        }

        const json = {};
        params.forEach((v, k) => {
          rows.push([k, v]);
          if (k in json) json[k] = [].concat(json[k], v);
          else json[k] = v;
        });

        list.innerHTML = rows.map(([k, v]) => kvRow(k, v)).join('');
        QA.setOutput(out, Object.keys(json).length ? JSON.stringify(json, null, 2) : 'No query parameters found');
      };

      ui.$('input').addEventListener('input', parse);
      parse();
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'jsoncsv',
    icon: '📊',
    title: 'JSON ↔ CSV Converter',
    category: 'Data & Format',
    keywords: 'json csv convert export import excel spreadsheet table',
    info: 'Convert an array of JSON objects to CSV and back. Values with commas, quotes or line breaks are quoted correctly; nested objects are written as JSON.',
    template: `
      <textarea data-ref="input" data-persist rows="6" spellcheck="false" aria-label="JSON or CSV" placeholder='[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]'></textarea>
      <div class="row wrap keep">
        <div class="btn-group">
          <button type="button" class="btn" data-action="toCsv">JSON → CSV</button>
          <button type="button" class="btn btn-secondary" data-action="toJson">CSV → JSON</button>
        </div>
        <select data-ref="delimiter" data-persist aria-label="Delimiter" style="flex:0 0 9rem">
          <option value=",">Comma ,</option>
          <option value=";">Semicolon ;</option>
          <option value="tab">Tab</option>
        </select>
        <label class="check"><input type="checkbox" data-ref="types" data-persist checked> Detect numbers / booleans</label>
      </div>
      ${outputBox('out')}`,
    setup(ui) {
      const delimiter = () => (ui.$('delimiter').value === 'tab' ? '\t' : ui.$('delimiter').value);

      const cell = (value, delim) => {
        if (value === null || value === undefined) return '';
        const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return /["\r\n]/.test(s) || s.includes(delim) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      /** RFC 4180 CSV parser (handles quoted fields, escaped quotes and newlines). */
      const parseCsv = (text, delim) => {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          if (quoted) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') quoted = false;
            else field += c;
          } else if (c === '"' && field === '') quoted = true;
          else if (c === delim) { row.push(field); field = ''; }
          else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); rows.push(row); row = []; field = '';
          } else field += c;
        }
        if (quoted) throw new Error('Unclosed quote');
        if (field !== '' || row.length) { row.push(field); rows.push(row); }
        return rows.filter((r) => r.some((v) => v !== ''));
      };

      const convertType = (v) => {
        if (v === 'true') return true;
        if (v === 'false') return false;
        if (v === 'null') return null;
        if (v.trim() !== '' && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim()) && !/^-?0\d/.test(v.trim())) return Number(v);
        return v;
      };

      const toCsv = (input) => {
        let data = JSON.parse(input);
        if (!Array.isArray(data)) data = [data];
        if (!data.length) throw new Error('The JSON array is empty');
        if (!data.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
          throw new Error('Expected an array of objects');
        }
        const delim = delimiter();
        const keys = [...new Set(data.flatMap(Object.keys))]; // union of all keys, in first-seen order
        return [keys.map((k) => cell(k, delim)).join(delim), ...data.map((r) => keys.map((k) => cell(r[k], delim)).join(delim))].join('\n');
      };

      const toJson = (input) => {
        const [header, ...rows] = parseCsv(input, delimiter());
        if (!header) throw new Error('CSV is empty');
        const detect = ui.$('types').checked;
        return JSON.stringify(rows.map((r) => Object.fromEntries(header.map((k, i) => {
          const v = r[i] ?? '';
          return [k, detect ? convertType(v) : v];
        }))), null, 2);
      };

      const run = (action) => {
        const input = ui.$('input').value;
        const out = ui.$('out');
        if (!input.trim()) return QA.setOutput(out, '');
        ui.save('action', action);
        try {
          QA.setOutput(out, action === 'toCsv' ? toCsv(input) : toJson(input));
        } catch (e) {
          const msg = e instanceof SyntaxError ? QA.jsonError(input, e) : e.message;
          QA.setOutput(out, `${action === 'toCsv' ? 'JSON → CSV' : 'CSV → JSON'} failed: ${msg}`, 'error');
        }
      };

      ui.$$('[data-action]').forEach((btn) => btn.addEventListener('click', () => run(btn.dataset.action)));
      run(ui.load('action', 'toCsv'));
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'fakedata',
    icon: '🎭',
    title: 'Fake Test Data Generator',
    category: 'Generators',
    keywords: 'fake mock test data name email phone address user person',
    info: 'Generate a random test person: name, username, email, phone, address, company, birth date, UUID and IP. Emails use the reserved example.com domain, so they never reach a real inbox.',
    template: `
      <div class="kv" data-ref="list"></div>
      <div class="btn-group">
        <button type="button" class="btn" data-ref="generate">Generate New</button>
        <button type="button" class="btn btn-secondary" data-ref="copyJson">Copy as JSON</button>
      </div>`,
    setup(ui) {
      const digits = (n) => Array.from({ length: n }, () => QA.randomInt(10)).join('');

      const createPerson = () => {
        const first = QA.pick(FAKE.firstNames);
        const last = QA.pick(FAKE.lastNames);
        const [city, state] = QA.pick(FAKE.cities);
        const username = `${first}.${last}${QA.randomInt(100)}`.toLowerCase();
        const birth = new Date(Date.UTC(1950 + QA.randomInt(55), QA.randomInt(12), 1 + QA.randomInt(28)));
        return {
          name: `${first} ${last}`,
          username,
          email: `${username}@example.com`,
          phone: `+1 (${200 + QA.randomInt(800)}) 555-${digits(4)}`, // 555 numbers are reserved for fiction
          address: `${100 + QA.randomInt(9900)} ${QA.pick(FAKE.streets)}, ${city}, ${state} ${digits(5)}`,
          company: QA.pick(FAKE.companies),
          birthDate: birth.toISOString().slice(0, 10),
          uuid: QA.uuid(),
          ip: `192.0.2.${1 + QA.randomInt(254)}`, // TEST-NET-1, documentation range
        };
      };

      const render = (person) => {
        ui.$('list').innerHTML = Object.entries(person).map(([k, v]) => kvRow(k, v)).join('');
      };

      ui.$('generate').addEventListener('click', () => {
        const person = createPerson();
        ui.save('person', person);
        render(person);
      });
      ui.$('copyJson').addEventListener('click', () => QA.copy(JSON.stringify(ui.load('person'), null, 2)));

      let person = ui.load('person');
      if (!person) {
        person = createPerson();
        ui.save('person', person);
      }
      render(person);
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'deeplink',
    icon: '📱',
    title: 'Deep Link Tester',
    category: 'Web & API',
    keywords: 'deep link universal link app link mobile ios android scheme adb simctl',
    info: 'Open a deep link (myapp://…) or universal link on this device, or copy a ready-made command to open it in an Android emulator (adb) or iOS simulator (simctl). Your last links are remembered.',
    template: `
      <div class="row">
        <input type="text" data-ref="input" data-persist spellcheck="false" aria-label="Deep link" placeholder="myapp://product/42?ref=qa">
        <button type="button" class="btn" data-ref="open">Open</button>
      </div>
      <div class="chips" data-ref="history"></div>
      <div class="kv" data-ref="parts"></div>
      ${outputBox('out', 'adb / simctl commands will appear here')}`,
    setup(ui) {
      const BLOCKED = ['javascript:', 'data:', 'vbscript:', 'file:'];
      const MAX_HISTORY = 6;

      /** Returns a URL object or an error message. */
      const validate = (value) => {
        if (!value) return null;
        let url;
        try { url = new URL(value); } catch (e) { return 'Invalid link: it must include a scheme, e.g. myapp://path or https://…'; }
        if (BLOCKED.includes(url.protocol)) return `The ${url.protocol} scheme is blocked for safety`;
        return url;
      };

      const shellQuote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

      const renderHistory = () => {
        const history = ui.load('history', []);
        ui.$('history').innerHTML = history
          .map((link) => `<button type="button" class="chip" data-link="${QA.escapeHtml(link)}" title="${QA.escapeHtml(link)}">${QA.escapeHtml(link.length > 40 ? `${link.slice(0, 40)}…` : link)}</button>`)
          .join('');
      };

      const inspect = () => {
        const value = ui.$('input').value.trim();
        const result = validate(value);
        ui.$('parts').innerHTML = '';
        if (!result) return QA.setOutput(ui.$('out'), '');
        if (typeof result === 'string') return QA.setOutput(ui.$('out'), result, 'error');

        const rows = [['Scheme', result.protocol.replace(':', '')]];
        if (result.host) rows.push(['Host', result.host]);
        if (result.pathname && result.pathname !== '/') rows.push(['Path', decodeURIComponent(result.pathname)]);
        result.searchParams.forEach((v, k) => rows.push([`?${k}`, v]));
        ui.$('parts').innerHTML = rows.map(([k, v]) => kvRow(k, v)).join('');

        QA.setOutput(ui.$('out'), [
          '# Android emulator / device',
          `adb shell am start -W -a android.intent.action.VIEW -d ${shellQuote(value)}`,
          '',
          '# iOS simulator',
          `xcrun simctl openurl booted ${shellQuote(value)}`,
        ].join('\n'));
      };

      const open = () => {
        const value = ui.$('input').value.trim();
        const result = validate(value);
        if (!result || typeof result === 'string') {
          QA.toast(result || 'Enter a link first');
          return;
        }
        const history = [value, ...ui.load('history', []).filter((l) => l !== value)].slice(0, MAX_HISTORY);
        ui.save('history', history);
        renderHistory();

        // An anchor click works for custom schemes without leaving a blank tab behind.
        const a = document.createElement('a');
        a.href = result.href;
        if (/^https?:$/.test(result.protocol)) { a.target = '_blank'; a.rel = 'noopener'; }
        a.click();
      };

      ui.$('input').addEventListener('input', inspect);
      ui.$('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
      ui.$('open').addEventListener('click', open);
      ui.$('history').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-link]');
        if (!chip) return;
        ui.$('input').value = chip.dataset.link;
        ui.$('input').dispatchEvent(new Event('input', { bubbles: true }));
      });

      renderHistory();
      inspect();
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'cron',
    icon: '⏰',
    title: 'Cron Expression Reader',
    category: 'Testing',
    keywords: 'cron crontab schedule job scheduler next run time',
    info: 'Explain a cron expression in plain English and list the next run times (in your local time zone). Format: minute hour day-of-month month day-of-week. Macros like @daily are supported.',
    template: `
      <input type="text" data-ref="input" data-persist spellcheck="false" aria-label="Cron expression" placeholder="*/15 9-17 * * MON-FRI">
      <div class="chips" data-ref="presets"></div>
      <p class="hint">Format: minute hour day-of-month month day-of-week</p>
      ${outputBox('out', 'Description and next runs')}`,
    setup(ui) {
      const PRESETS = [
        ['Every 5 min', '*/5 * * * *'],
        ['Hourly', '0 * * * *'],
        ['Daily 00:00', '0 0 * * *'],
        ['Weekdays 09:00', '0 9 * * 1-5'],
        ['Mondays 08:30', '30 8 * * MON'],
        ['Monthly 1st', '0 0 1 * *'],
      ];
      ui.$('presets').innerHTML = PRESETS
        .map(([label, expr]) => `<button type="button" class="chip" data-expr="${expr}" title="${expr}">${label}</button>`)
        .join('');

      const read = () => {
        const value = ui.$('input').value.trim();
        const out = ui.$('out');
        if (!value) return QA.setOutput(out, '');
        try {
          const parsed = QA.cron.parse(value);
          const runs = QA.cron.nextRuns(parsed, 5);
          const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          QA.setOutput(out, [
            QA.cron.describe(parsed),
            '',
            'Next runs:',
            ...(runs.length ? runs.map((d) => `  ${fmt.format(d)}`) : ['  (none in the next 5 years)']),
          ].join('\n'));
        } catch (e) {
          QA.setOutput(out, `Invalid cron expression: ${e.message}`, 'error');
        }
      };

      ui.$('input').addEventListener('input', read);
      ui.$('presets').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-expr]');
        if (!chip) return;
        ui.$('input').value = chip.dataset.expr;
        ui.$('input').dispatchEvent(new Event('input', { bubbles: true }));
      });
      read();
    },
  },
];
