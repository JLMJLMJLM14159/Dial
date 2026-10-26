# Dial

**Try it: <https://jlmjlmjlm14159.github.io/Dial/>**

A small browser app for drawing a single-cycle waveform out of exact pieces (Bézier curves, sine pieces, straight lines and exponential curves), playing it as a synth, and saving or exporting it.

Everything runs in the browser, with no install, build step or server.

## Running it

- **Online:** <https://jlmjlmjlm14159.github.io/Dial/> (GitHub Pages, updated automatically on every push to `main`).
- **Locally:** download the repo and double-click `index.html`. The scripts are plain files, not modules, so they load straight from disk.
  - MIDI needs a "secure" page; Chrome and Edge treat local files as secure.
  - Waves saved in the browser are kept separately for the local copy and the online one. Use **Save** and **Open** to move waves between them.
  - To serve it anyway (for example to try it on a phone over Wi-Fi): `python3 -m http.server` in the folder.
- **Offline and as an app:** once the online version has been opened, it keeps working without internet. It can also be installed like an app (the install button in Chrome or Edge's address bar, or Share → Add to Home Screen on a phone). Online, it always loads the latest version.

## How the wave works

- The wave is a chain of **sections**. Each one starts where the previous one ends.
- **x** runs left to right. The whole chain is **one cycle**, repeated forever when played.
- **y** is a height above or below the middle line, from −1 to 1.
- The **start** is the square at the left. It can't be dragged: the wave always ends at the start's height, so the loop has no jump. The last section's End y is linked to it.

The editor always keeps three rules:

1. **Never backwards.** x never decreases along a section, so every moment has exactly one height.
2. **Inside the band.** The curve itself never leaves −1 to 1.
3. **Closed loop.** The end height is always the start height.

**Half-wave symmetry** (the **Symmetry** button) makes the sections the first half of the cycle; the second half is the same shape upside down (y → −y), drawn dashed in the preview. Such waves contain only odd harmonics (a hollow, square/triangle-like sound). In this mode the last end is linked to the *opposite* of the start's height so the halves join without a jump, and Scale to fit only scales (the wave is already centred).

### Section types

| Type | Controls | Shape |
|---|---|---|
| **Bézier** | Length, End y, Handle 1 x/y, Handle 2 x/y | A cubic Bézier, for anything freeform. Handle x is measured from the section's start. Handle 1 x goes up to 4/3 of the length and Handle 2 x down to −1/3 of it, but each depends on the other (see below). Handle heights can go past ±1 (up to ±5) as long as the curve stays in the band. |
| **Sine** | Length, End y, Smooth at | Part of a sine wave between the start and end heights. "Both ends" is half a cycle; "End only" and "Start only" are quarter cycles, smooth at that end. |
| **Line** | Length, End y | Straight from start to end. Keep End y equal to the start for a level stretch, or set Length to 0 for an instant jump. |
| **Curve** | Length, End y, Bend (−20 to 20) | An exponential, `(1 − e^(−b·u)) / (1 − e^(−b))`. Bend 0 is straight, positive moves fast then levels off (decay or charge), negative starts slowly. |

Every standard waveform is exact:

| Wave | Recipe |
|---|---|
| Sine | 2 Sine sections, both "Both ends" (or 4 quarter Sines to start from 0) |
| Square or pulse | 4 Lines: level, jump (length 0), level, jump |
| Saw | 2 Lines: a ramp and a jump |
| Triangle | 2 Lines |
| Rectified sine | 2 quarter Sines (plus a level Line for half-wave) |
| Exponential decay or rise | 1 Curve (heights 1 → e⁻⁴ with Bend 4 is exactly e^(−4x)) |

Switching a section to Bézier sets handles that copy its current shape as closely as possible.

### The never-backwards rule for Bézier sections

With `a = handle1.x` and `d = length − handle2.x`, a section never goes backwards exactly when `a ≥ 0`, `d ≥ 0` and `a + d − √(a·d) ≤ length`. This comes from x′(t) ≥ 0, which is a quadratic Bézier in `a`, `length − a − d` and `d`. If a shorter length leaves the handles no room, they are scaled towards the start just enough to fit. Limits are rounded inwards to 4 decimals, so stored values always pass the check.

## The page

On laptop and desktop screens (at least 900 × 640 pixels) everything fits on one screen with no scrolling: the toolbar on top, the preview with its strip on the left, the section editor and Harmonics on the right, and the piano along the bottom. Only the section editor scrolls (inside itself) if a screen is too short for it. Smaller screens and phones get the same parts stacked, and scroll.

- **Toolbar:**
  - The wave's name, with a `*` while there are unsaved changes (also shown in the browser tab).
  - Save, **Link** (copies a share link, see below), Open, **Presets** (Sine, Saw, Triangle or Square to start from), New.
  - Undo and Redo.
  - Play, Frequency (slider from 20 to 2000 Hz, box from 20 to 20,000 Hz, with the nearest note) and Volume.
  - **⋯ (More):** a menu that opens **Export**, **Data (JSON)** and **Help**, each in its own pop-over window (closed with ×, Esc or a click outside it).
  - **Theme** (Teal, Studio, Ocean, Synthwave, Paper, Contrast) and **mode** (Auto follows your device, or Light or Dark). Every theme has its own light and dark version, and its two curve colours are checked to stay distinguishable for colour-blind viewers. Remembered per browser.
- **Preview:**
  - Click a section's curve to select it. The selected section is drawn bold with its handles.
  - Drag dots to edit: hollow dots are Bézier handles, dark dots are section ends.
- **View buttons** under the preview: **Snap** (dragged dots land on a grid, every 0.25 across and every 0.1 in height, drawn faintly) **Ghost copies** (faint copies of the cycles before and after), **Reference…** (load a single-cycle WAV, at most 4,096 samples, or another `.dial.json`; longer WAVs are refused with a message asking for them to be shortened to one cycle; it's drawn as a faint highlighter line stretched across one cycle, to trace over; × clears it; kept in the browser but never saved with your wave) and **?** (the keyboard shortcut list). The page remembers them. On touch screens the dots and their grab areas are enlarged to fingertip size.
- **Section strip:** the section numbers (click one to select it), **+ Add section**, **− Remove section** (removes the selected one) and **Scale to fit**. Scale to fit moves the start onto the middle line and makes the wave as large as fits, without changing its shape.
- **Section editor:** the controls for the selected section.
- **Harmonics:** a view-only chart of the first 32 harmonics, each as a share of the strongest, with a table of numbers. It fills the space under the section editor.
- **Piano** along the bottom: two octaves (press, tap or slide across the keys; − and + change octave), plus the computer keys A W S E D F T G Y H U J K O L P ; with Z and X to change octave. Keys light up while their note sounds. **Connect MIDI** works in Chrome, Edge and Firefox (not Safari); its sustain pedal holds notes and its pitch-bend wheel bends them by up to 2 semitones, and the bar shows which keyboard is connected.
- **Pop-over windows** from ⋯:
  - **Export:** **Download cycle (WAV)** is one cycle, 2048 samples, 24-bit, exactly as drawn, for wavetable synths and samplers such as Vital or Serum. **Download note (WAV)** is the current frequency held for a set length (up to 60 seconds), to drop onto a DAW track.
  - **Data (JSON):** the recorded values, with Copy JSON.
  - **Help.**

### Sound

The cycle is sampled at 2048 points, turned into harmonics with an FFT and played through the browser's built-in oscillator (a `PeriodicWave`). That means:
- The pitch can change smoothly while a note plays.
- Sharp jumps are smoothed automatically, so they don't alias.
- The average height (the off-centre part) is left out.

Several notes can play at once, with a limiter so they don't clip.

### Keyboard shortcuts

The editing keys work whenever you aren't typing in a box, using a slider or choosing from a menu.

| Keys | Action |
|---|---|
| Space | Play / stop (except while typing in a box or choosing from a menu) |
| ← / → | Select the previous / next section |
| ↑ / ↓ | Move the selected section's end up / down by 0.05 (Shift: 0.01) |
| [ / ] | Shorten / lengthen the selected section by 0.1 (Shift: 0.01) |
| Delete or Backspace | Remove the selected section |
| Q | Snap on / off |
| ? | Show the list of shortcuts |
| Ctrl+Z (⌘Z) | Undo (up to 200 steps; a whole drag or a typed number counts as one step) |
| Ctrl+Y or Ctrl+Shift+Z (⌘⇧Z) | Redo |
| A W S E D F T G Y H U J K O L P ; | Play notes while held |
| Z / X | Octave down / up |

Opening a wave or starting a new one asks whether to save first, but only if there are unsaved changes.

## Saved files (`.dial.json`)

**Save** downloads a readable JSON file that **Open** (or dropping the file on the page) loads back. Send the file to share a wave.

```json
{
  "format": "dial-wave",
  "version": 4,
  "name": "My wave",
  "start": { "y": 0 },
  "sections": [
    { "section": 1, "type": "bezier", "length": 2, "end": { "y": 0.8 },
      "handle1": { "x": 0.6, "y": 1.1 }, "handle2": { "x": 1.3, "y": 0.9 } },
    { "section": 2, "type": "sine",  "length": 1.5, "end": { "y": -0.7 }, "smooth": "both" },
    { "section": 3, "type": "line",  "length": 0,   "end": { "y": 0.3 } },
    { "section": 4, "type": "curve", "length": 1.5, "end": { "y": 0 },    "bend": 4 }
  ]
}
```

- `"symmetry": "half"` appears (after `start`) only when half-wave symmetry is on; then the sections are the first half of the cycle and the second half is them upside down.
- Every section has `type`, `length` and `end.y`. Sine sections add `smooth` (`"both"`, `"end"` or `"start"`), Curve sections add `bend`, and Bézier sections add `handle1` and `handle2`.
- All numbers are rounded to 4 decimals. The last section's `end.y` always equals `start.y` (or `−start.y` with symmetry).
- **Versions:**
  - Version 1 had Flat and Jump types, which now open as Lines.
  - Version 2 introduced Line.
  - Version 3 added Curve.
  - Version 4 added `symmetry`.
- When a file is opened, anything that breaks the rules is fixed and the page says so. Files from a newer version open with a warning.

In your own code on the page, `getDialValues()` returns the same `start` and `sections` data.

## Share links

**Link** copies a web address that contains the whole wave, e.g. `https://jlmjlmjlm14159.github.io/Dial/#w=1.fZBBTsMw…`. Nothing is uploaded: the part after `#` holds the same data as a saved file, compressed (deflate) and written in URL-safe base64, and browsers never send that part to the server. Typical waves give links of about 150–350 characters.

- Opening a link loads the wave like opening a file (asking to save first if there are unsaved changes), then tidies the address so a reload doesn't load it again. Pasting a new link into an open tab works too.
- `#w=1.` means compressed and `#w=0.` uncompressed (used if a browser can't compress); the number lets the link format change later without breaking old links.
- Links made from a copy opened from disk point at the online site.

## Files

| File | What it does |
|---|---|
| `index.html` | The page layout |
| `styles.css` | Styles, including light and dark themes |
| `js/state.js` | Section types, rules (never backwards, inside the band, closed loop), saving to the browser, file format, sampling one cycle |
| `js/preview.js` | Draws the preview |
| `js/controls.js` | Section strip, section editor, sliders and number boxes, the ⋯ menu and pop-over windows, keyboard editing |
| `js/drag.js` | Dragging dots in the preview |
| `js/reference.js` | The reference trace |
| `js/synth.js` | Playing (Play button, computer keyboard, MIDI), WAV export |
| `js/harmonics.js` | The harmonics chart |
| `js/files.js` | Save, Open, New, presets, share links, unsaved-changes tracking |
| `js/history.js` | Undo and redo |
| `js/theme.js` | Colour theme and light/dark mode menus |
| `js/main.js` | Start-up, and turning on offline support |
| `sw.js` | Offline support: keeps a copy of the files, always trying the network first |
| `manifest.webmanifest`, `icons/` | App name, colours and icons, for installing |

The scripts share one `window.Dial` object and load in the order listed in `index.html`. The browser keeps the current wave under the storage key `dial-sections-v3`, synth settings under `dial-synth-v1`, the view buttons under `dial-view-v1`, the theme under `dial-theme-v1`, and the reference trace under `dial-ref-v1`.
