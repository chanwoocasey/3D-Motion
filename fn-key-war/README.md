# fn Key War: Grammarly vs Wispr Flow

A 13-second, 1920×1080, 60fps motion graphic. Grammarly and Wispr Flow fight over the `fn` key: it lifts out of a 3D Mac keyboard, turns Grammarly green with the Grammarly icon, then gets taken over and flips to Wispr Flow.

**Output:** [`out/fn-key-war.mp4`](out/fn-key-war.mp4)

## Beat sheet

| Time | Beat |
|---|---|
| 0.0 – 2.6s | Dark 3D Mac keyboard. A ripple of keys pops from `fn` outward, then the camera swings top-down and pushes in on `fn`, which glows. |
| 2.6 – 3.5s | The `fn` key lifts out of the keyboard and the keyboard falls away, blurred. |
| 3.1 – 3.9s | The Grammarly badge slides in from the left and Wispr Flow from the right. |
| 4.0 – 5.0s | Grammarly fires green streaks. The key fills green, the globe icon drops out and the Grammarly mark pops in, with a shockwave. |
| 5.9 – 8.2s | Tug-of-war. Wispr Flow voice waves hit the key and purple eats into it. Grammarly pushes back twice and the key shakes harder each time. |
| 8.15 – 9.2s | The key squashes, winds up and flips 180° in 3D to reveal the Wispr Flow side, then lands with a shockwave. Grammarly greys out. |
| 9.5 – 10.6s | Both badges leave and the key rises to the top of the frame. |
| 10.35s → | The key gets pressed (hold `fn` to talk) and a dictation waveform pill appears. |
| 10.75s → | Title: "The battle for the `fn` key". |

## Editing

Everything lives in `index.html`:

- **`CONFIG`** (top of the script) sets the names, brand colours, logo files, title text, subtitle, and whether the dictation pill shows.
- **`T`** (just below it) sets every beat in seconds. Change these numbers to retime the piece and keep `CONFIG.duration` in step.
- **Logos:** the four files in `assets/` are **placeholders**. Replace them with the official logos and keep the same filenames:
  - `grammarly-logo.svg` and `wispr-flow-logo.svg` are the full-colour badges on the left and right.
  - `grammarly-mark.svg` and `wispr-flow-mark.svg` are the **white** glyphs shown on the key face. They sit on the brand colour, so they should be white on a transparent background.
  - PNG files work too. Change the paths in `CONFIG` if you do that.
- Update `CONFIG.a.color` and `CONFIG.b.color` to the real brand hex codes. `#7B61FF` for Wispr Flow is a guess.

## Preview

Open `index.html` in Chrome. It plays in a loop with a scrubber. Press space to play or pause, and use ← and → to step 1/30s.

## Render to MP4

Needs Node 18+ and ffmpeg (`brew install ffmpeg`).

```bash
npm install
npx playwright install chromium
npm run render        # out/fn-key-war.mp4, 60fps
npm run render:30     # 30fps version
npm run stills        # PNG stills of key moments in out/stills/
```

Each frame is computed from its timestamp, so renders are frame-exact and identical on every machine. Rendering takes about 4–5 minutes on 4 cores.

There is no audio. Add whooshes on the streaks and the flip, plus a click on the final press, in your editor.
