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
| `index.html` | Markup, CSS, HUD, overlays. Loads the four scripts in order. |
| `game-1.js` | Globals, run/player/defender/ball state, audio, helpers, stance + read system |
| `game-2.js` | Run flow: possessions, upgrades, moves (hesi, cross, stepback, drive), shot resolution |
| `game-3.js` | `update()`, all canvas rendering, the main `loop()` |
| `game-4.js` | Input handling and mobile browser lock |

The scripts share plain `var` globals and **depend on load order**. Keep the four
`<script>` tags in sequence; don't add `defer`, `async`, or `type="module"`.

## Deploy

Netlify, publish directory `.`, no build command. `netlify.toml` sets a
`frame-ancestors` policy so Nobody Arcade can embed the game.

## Connecting to Nobody Arcade

Add an entry to `data/games.js` in the arcade repo:

```js
playUrl: "https://YOUR-SITE.netlify.app",
sourceUrl: "https://github.com/kylozenzen/buckets",
embed: true
```

The arcade listens for optional `postMessage` events from the game iframe
(`game_started`, `game_completed`, `score_submitted`, and others) to feed the
Arcade Passport. Buckets doesn't emit these yet.

## Notes

- Safe-area insets (`env(safe-area-inset-*)`) resolve to `0` inside an iframe, so
  HUD spacing differs between standalone and embedded play. Test both.
- `#app` is capped at 560px wide and uses `100dvh`.
