# BUCKETS — Read the Floor

A one-thumb street basketball game. Ten possessions, a defender with a plan, and a
shrinking window to attack. Built for mobile, playable on desktop.

Part of [Nobody Arcade](https://github.com/kylozenzen/nobodycreative-arcade).

## Run it locally

No build step, no dependencies. Serve the folder over HTTP:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` directly via `file://` works too, but a local server is closer
to how it behaves in production.

## File layout

| File | Contains |
| --- | --- |
| `index.html` | Markup, CSS, HUD, overlays (title, upgrade, pause, end). Loads the scripts in order. |
| `game-1.js` | Globals, saved settings + stats, run/player/defender/ball state, audio, HUD, stance + read system |
| `game-2.js` | Run flow: possessions, upgrades, moves (hesi, cross, stepback, drive), shot resolution |
| `game-3.js` | `update()`, cached court background, all canvas rendering, the main `loop()` |
| `game-4.js` | Input handling (touch + keyboard) and mobile browser lock |
| `shell.js` | Menus, settings, stats, auto-pause, service worker registration, Nobody Arcade events |
| `sw.js` | Network-first service worker (offline play after first visit) |
| `manifest.webmanifest`, `icons/` | PWA install + favicon/app icons |

The scripts share plain `var` globals and **depend on load order**. Keep the five
`<script>` tags in sequence; don't add `defer`, `async`, or `type="module"`.

## Layout notes

- World positions are fractions of the canvas height (`H*.82` etc.), unchanged from v0.3, so
  tuning numbers still mean the same thing.
- `layout()` in `game-1.js` measures the HUD and sets `L.camY`, which shifts the court down if
  the HUD would cover the shot clock (notched phones in standalone mode). `L.topLimit` caps
  shot arcs so the ball never flies behind the HUD.
- The court, skyline, fence and lights are drawn once into an offscreen canvas and rebuilt on
  resize (and once the Inter font loads).

## Saved data

Everything is local (`localStorage` key `buckets.v1`): sound/vibration settings and lifetime
stats (runs, best, buckets, pure makes, reads won, best combo). Sound is **off by default**.

## Controls

| Touch | Keyboard | Move |
| --- | --- | --- |
| Tap | `H` or tap `Space` | Hesi |
| Swipe ← / → | `A` / `D` or ← / → | Crossover |
| Swipe ↑ | `W` or ↑ | Drive (finishes at the rim) |
| Swipe ↓ | `S` or ↓ | Stepback |
| Hold, release | Hold `Space`, release | Jumper |
| Pause button | `Esc` or `P` | Pause menu |

## Deploy

Netlify, publish directory `.`, no build command. `netlify.toml` sets a
`frame-ancestors` policy so Nobody Arcade can embed the game.

## Connecting to Nobody Arcade

Add an entry to the arcade's games list. The `id` must be `buckets` (it has to match
`GAME_ID` in `shell.js`):

```js
id: "buckets",
playUrl: "https://YOUR-SITE.netlify.app",
sourceUrl: "https://github.com/kylozenzen/project-buckets",
embed: true
```

Buckets posts `NOBODY_ARCADE_EVENT` messages to the parent frame when embedded:
`game_started` on every run, then `score_submitted` and `game_completed` (with score,
makes, reads, best combo) when the run ends. Nothing is sent when played standalone.

## Notes

- Safe-area insets (`env(safe-area-inset-*)`) resolve to `0` inside an iframe, so
  HUD spacing differs between standalone and embedded play. Test both.
- `#app` is capped at 560px wide and uses `100dvh`.
