# REPO-7

Two self-contained pieces:

| | |
|---|---|
| [`index.html`](index.html) | **The Buyback Counter** — 20 s interactive voxel rehearsal. Open it directly. |
| [`last-block/`](last-block) | **The Last Block** — 12 s voxel short. Clip, poster, storyboard, and the renderer that made it in [`last-block/src`](last-block/src). |

---

**The Buyback Counter** — a twenty-second, self-contained, interactive voxel rehearsal.

Open [`index.html`](index.html) directly in a browser (double-click, `file://`). No server, no
network, no libraries, no build step. Everything — scene, simulation, HUD — lives in that one file.

## The scene

A busy merchant at a night-market stall offers to buy back a souvenir. An emerald on the counter
keeps trying to warn the customer about a concealed trapdoor under the rug.

* **0 – 4 s** the customer walks in, they settle on a price, the souvenir changes hands.
* **4 – 12 s** the emerald works the warning: it points down, tugs at the rug, gets shushed, swatted,
  then lured away by the merchant. Inputs land here and only here.
* **12 – 20 s** one of three endings, latched at exactly t = 12.

## Controls

| Control | What it does |
| --- | --- |
| **Play / Pause** (or `Space`) | runs the clock forward from the current time |
| **Seek slider** (0 – 20 s) | click or drag; seeking backwards and forwards rebuilds the scene, recorded inputs are kept |
| **0.5× / 1× / 2×** | playback rate only — the simulation always runs on scene time |
| **Take** (`Q`) | customer holds the emerald |
| **Return** (`W`) | customer puts the emerald back |
| **Inspect Rear** (`E`) | permanently exposes the mechanism for this run |
| **Reset** (`R`) | pauses, returns to 0, clears every recorded input |
| **Origin X / Y / Z** | moves the world origin; the whole scene and its camera framing follow |

Inputs are accepted only in `4.0 ≤ t < 12.0` — outside the window the button flashes and nothing is
recorded. Recording an input at an earlier time discards every input recorded after it.

## Endings

Latched at `t = 12`, inspection outranks holding:

* **exposed** — inspected: rug torn back, the brass mechanism stands revealed, merchant caught.
* **safe** — holding: the trapdoor never gets its moment; customer walks off with the emerald.
* **trap** — neither: rug whipped away at 13.7 s, floor gives way at exactly 14.0 s, customer drops in.

## `window.sceneBench.evaluate({ time, actions, origin })`

Returns a fresh, JSON-compatible snapshot:

```js
{
  branch: 'pending' | 'exposed' | 'safe' | 'trap',
  held: boolean, inspected: boolean, trapOpen: boolean,
  actors: { merchant: [x,y,z], customer: [x,y,z], emerald: [x,y,z] }
}
```

`time` is clamped to `[0, 20]`; only actions with `time ≤ time` are used, sorted by time then by
position in the array; unknown types are ignored; the argument is never mutated. Actor coordinates
are world coordinates and therefore include the `origin` offset exactly. This is the same
`simulate()` the renderer draws from — it is not a separate model.
