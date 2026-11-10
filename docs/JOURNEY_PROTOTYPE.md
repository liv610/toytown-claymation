# Journey prototype: three paths to one action

Branch `experiment/journey` (from `experiment/map-scale`). This is a concept prototype for a Toys for Tots-related
project, not a live service.
- **Placeholder only:** every action and every data point is a placeholder. The ZIP search returns invented
  locations.
- **No production systems:** no real campaign data, payments or analytics service are connected.
- **Untouched:**
  - the existing claymation scenes (`web/realtime`, `web/sequence`, `web/region`);
  - the Marine model and the village set;
  - the national folk-art map (not accessed).

  The prototype loads their assets read-only.

**Run locally:**

```bash
cd web
python3 -m http.server 8765
```

Then open `http://localhost:8765/journey/`.

**Package as an artifact:** `tools/build_journey.sh OUTDIR`

## What it tests

One action, **Find a toy drop-off** (a ZIP search over placeholder data), reached three ways:

| Path | How the visitor gets there | `source` logged |
|---|---|---|
| Direct | The landing's primary button, or **Give Toys** in the always-visible bar | `direct-landing`, `direct-bar` |
| Exploration | Enter Toy Town → tap the toy shop window → "Find a toy drop-off near you" | `explore-shop` |
| Storytelling | Enter Toy Town → follow the Marine → the end card's button (or the button shown during the story) | `story-end`, `story-pill` |

**The Marine's moment (about 15 s).** A new toy has just been left at a "Toy drop-off" box beside the toy shop.
1. The Marine walks over, lifts it out and pauses to look at it.
2. He carries it to the wagon where a second Marine is loading toys.
3. He sets it in, the second Marine nods, and the town's lights warm up.

Three captions carry the meaning:
- a neighbour donated a toy;
- Marines and volunteers collect every donated toy;
- it reaches a child in the same community.

It ends on "Toys given here stay close to home", followed by the drop-off button.

**Interruptions are always allowed.** It never blocks:
- the drop-off button is on screen for the whole moment;
- **Skip** jumps straight to the end card;
- the action bar works throughout.

**Draft copy.** The story and card copy are drafts and need review by the organisation before any real use.

## Conditions

| Address | Condition |
|---|---|
| `#direct` | Landing page and actions only. No 3D is downloaded, and a still of the village sits behind the landing. |
| `#explore` | Map and Toy Town with hotspots. The Marine is there but not interactive. |
| `#story` | Map and Toy Town. On arrival a card invites the visitor to follow the Marine. The toy shop hotspot unlocks after the story, so the story is the world's route to the action. |
| *(none)* or `#all` | Everything, for demos. |
| `#flat` | The 2D flat-map stand-in in place of the diorama, an integration test of the hand-off. |
| `#simple` | The illustrated fallback. |
| `#research` | Opens the test log on load. |

Locally the same work as query strings: `?variant=story`, `?map=flat`, `?lite=1`, `?research=1`, and `?q=high|medium|low` to force a quality tier.

## Components

```
web/journey/
  index.html                 action layer markup + styles (the page works with no 3D)
  src/main.js                orchestrator: states, variants, hand-offs, action wiring
  src/track.js               event log (local only), path attribution, funnel summary, CSV
  src/research.js            observer panel: participant, conditions, funnel, sessions, export
  src/fallback.js            illustrated version of the same journey (stills, keyboard-first)
  src/actions/dropoff_data.js  PLACEHOLDER drop-off generator (deterministic per ZIP)
  src/world/diorama.js       3D host: renderer, set, trees, trains, lights, snow, camera moves, loop
  src/world/map_diorama.js   MapProvider implementations: 'diorama' (3D) and 'flat' (2D stand-in)
  src/world/village.js       Toy Town street level: arrival, free look, hotspots, surprises, story props
  src/world/marine_story.js  the Marine's moment (pure function of time; skip/replay exact)
  src/world/pins.js          DOM hotspot buttons that follow 3D points
  assets/stills/             renders used by the fallback and as the backdrop before 3D loads
```

**How they depend on each other:**
- The action layer and tracking never import the 3D code.
- `main.js` loads the world lazily (a separate chunk, about 0.9 MB of JS plus about 6 MB of models).
- The direct condition and the simple view never download the 3D world.
- The map, the village and the story only talk to the host (`diorama.js`) and to callbacks the orchestrator passes in.
- Neither the map nor the village imports the other.

## Connecting the real national map later

The orchestrator only ever calls the `MapProvider` interface:

```js
provider.id                     // 'diorama' | 'flat' | 'national' …
provider.places                 // [{ id: 'toytown', label: 'Toy Town' }]
provider.onSelect(cb)           // visitor picked a place (pin, click, keyboard)
await provider.mount(opts)      // show the map
provider.unmount()
const handoff = await provider.enter('toytown', { reducedMotion })
// handoff = { kind: 'pose', pose: { pos, look, fov } }   a 3D map that shares the village's world
//        or { kind: 'screen', rect: { x, y, w, h } }      a 2D map: where Toy Town was drawn on screen
await village.enter(handoff, { reducedMotion })
```

**Two kinds of hand-off:**
- **3D map (`pose`):** the diorama flies the camera down to the village's arrival pose, so the hand-off is seamless.
- **2D map (`screen`):** the folk-art national map would work like the `flat` stand-in. It zooms its own
  drawing into the Toy Town marker and fades out. The village then descends from a sky pose to the same arrival.

`#flat` demonstrates the 2D route end to end, with the same events (`handoff kind=screen`).

**Swapping in another map:** a different map only needs those five members. Toy Town, the Marine and the actions are
unchanged, so a fully claymation world and a folk-art map leading into the miniature village can be
compared like for like.

## Measurement

Events are kept in `localStorage` in this browser only (key `rh_journey_sessions_v1`). They are shown in the
**Test log** panel (footer link, `#research`, or Shift+R) and exported as JSON or CSV.

| Event | When | Notable fields |
|---|---|---|
| `landing` | page shown | variant |
| `world_ready` | 3D finished loading in the background | ms, tier, kb |
| `world_enter` / `handoff` / `village_arrive` | entering Toy Town | source, kind, skipped, ms |
| `skip_flight` | visitor skipped the descent | |
| `hotspot_open` | toy shop, tree, lamp | id, via (pin / places list / lite) |
| `story_start` / `story_beat` / `story_complete` / `story_skip` / `story_abandon` | the Marine's moment | source, i, at (seconds) |
| `card_show` / `card_close` | discovery cards | id |
| `action_click` | any of the four actions, anywhere | action, source, context (state when clicked) |
| `dropoff_open` | drop-off search opened | **source, path**, context |
| `zip_invalid` / `zip_submit` / `results_shown` | the search | zip3 (first 3 digits only), count |
| `site_chosen` | "I’ll drop off here" (the conversion) | rank, miles, source, path |
| `directions_click`, `dropoff_close` | after results | stage at close |
| `fallback_shown`, `simple_view_choose`, `perf` | device handling | reason, fps |
| `session_end` | tab closed or left | last milestone |

**Funnel milestones** (the panel shows where each session stopped):
1. landing
2. entered world
3. reached Toy Town
4. opened toy shop or started story
5. opened drop-off search
6. searched
7. saw results
8. chose a drop-off

**Path attribution.** A path is attributed by the `source` of the `dropoff_open` that led to `site_chosen`. The `context`
field records whether a bar click happened while the visitor was in the village or the story, so "used the bar
while watching the story" can be separated from a pure direct visit.

## Usability and accessibility

**The actions come first:**
- The four actions are real buttons in a bar that is always visible (a bottom bar on phones).
- They never wait for an animation; the landing card works before any 3D has loaded.
- Requesting toys and the other actions open directly. Families never pass through the world.

**Keyboard and screen readers:**
- Hotspots are DOM buttons with labels, not canvas clicks.
- A **Places** list offers the same destinations from the keyboard.
- The 3D canvas is `aria-hidden`.
- Story captions are an `aria-live` region.

**Motion and device performance:**
- `prefers-reduced-motion` turns camera flights into cuts and stops the pin pulse.
- Three automatic quality tiers apply:

  | Tier | Settings |
  |---|---|
  | Desktop | Ambient occlusion, depth of field and 2k shadows |
  | Phone or tablet | No ambient occlusion or depth of field, 1k shadows, DPR 1 |
  | Low memory | No post-processing or shadows |

- If the frame rate stays under 15 fps after arrival, the page offers the simple view; it doesn't force it.

**The simple view:** the same journey as captioned stills, with the same actions and the same events (sources end in
`-lite`). It is used when WebGL is missing, chosen by the visitor (for that tab only), or forced with `#simple`.

## Known limits

- **Placeholder actions:** the three actions other than drop-off open a "not connected" explanation. Real
  destinations are a production decision.
- **Draft copy:** the story copy states how local collection works and must be checked by the organisation.
- **Story framing on portrait phones:** the shot is composed for landscape, so on portrait phones the wagon sits at the
  frame edge until the camera drifts to it.
- **Performance unverified on real hardware:** this cloud machine only has a software renderer. Verify on real phones
  before testing with participants (the `perf` event records fps per session).
- **No audio.**
