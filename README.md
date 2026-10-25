# QA Toolbox

Free, browser-only utilities for QA engineers and developers — made by [Huseyin Kesmez](https://github.com/huseyinkesmez).

Tools: Timestamp Converter, HTTP Status Code Lookup, JSON Formatter & Validator, JWT Decoder, Base64 and URL encoders, Regex Tester, Password / UUID / Hash generators, Query Parameter Parser, JSON ↔ CSV Converter, Fake Test Data Generator, Deep Link Tester and Cron Expression Reader.

Features: search (press `/`), category filters, dark / light theme, mobile layout, and your last inputs are remembered in `localStorage` on your device. Nothing is sent to a server.

## Run locally

No build step. Serve the folder with any static server:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Project structure

```
index.html            page shell
assets/styles.css     theme (CSS variables for light / dark)
assets/js/utils.js    shared helpers (storage, copy, toast, base64, uuid…)
assets/js/lib/        md5 and cron parser
assets/js/tools.js    tool definitions – add a new tool here
assets/js/app.js      rendering, search, categories, theme, persistence
```

To add a tool, append an object to `TOOLS` in `assets/js/tools.js` (see the comment at the top of that file).
