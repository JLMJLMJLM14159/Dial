# Notes for Claude

## The owner's preferences

- **Toolbar buttons must not put text in the status line at the top** (`#filestatus`): no "Saved…", "Link copied…", "Opened…" or similar messages from Save, Link, Open, Presets, New or any other toolbar control. Only do so if the owner asks. When something genuinely needs saying (an error, a file that had to be fixed), use the popup (`D.popup(title, message)`) instead.
- Suggest options for design decisions and ask before building; keep the UI simple; ask when the intent is unclear.
- The owner is new to coding: explain things in plain language.

## How the project works

- Plain `<script>` files, not ES modules, so `index.html` works when opened straight from disk. They share `window.Dial` and load in the order listed in `index.html`. New files also go in the `FILES` list in `sw.js` (offline support).
- No server and no network calls: everything stays in the browser.
- See `README.md` for the wave model, rules, file format and file list.
