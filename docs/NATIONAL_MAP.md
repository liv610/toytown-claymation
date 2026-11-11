# The national story: clay map + chapter system

Branch `experiment/national` (from `experiment/storybook`). Prototype: [Railroad of Hope National Map](https://claude.ai/artifact/Ljs6JaGJYW1kMGijHRKaZ1).
Toy Town, the journeys, the regional diorama and the storybook test are untouched.

Goal: *Follow the Journey — discover how a little generosity becomes holiday joy*, told in five short chapters across a
clay miniature of the United States.

## Plan, in increments

1. **Step 1 (built, awaiting review).** A recognisable clay national map and one continuous descent into a detailed
   community (Maple Hollow, Ohio, fictional).
2. **Step 2.** The chapter engine plus Chapter 1 (*It Starts With You*: family, child, donation box, volunteer; optional
   "Find a Toy Drop-Off") and Chapter 2 (*A Community Comes Together*: the Riverton sorting centre with Marines and volunteers;
   optional "Volunteer Locally").
3. **Step 3.**
   - Chapter 3: the nationwide illumination moment.
   - Chapter 4: another community, where toys are prepared for distribution, shown with dignity.
   - Chapter 5: ZIP code → the camera travels to the visitor's region → a local campaign lights up, with placeholder actions.

## Architecture

```
web/national/
  index.html          action bar (always available), caption, pins, controls
  src/geo.js          projection (Albers USA, same as the us-atlas data), land mask, height model, colours,
                      forests, generic towns, story sites, symbolic lines
  src/relief.js       clay slab + sculpted heightfield (coastline clipped per pixel), sea, base, instanced
                      firs and town clusters, three symbolic rail lines with trains
  src/community.js    Maple Hollow: a detailed diorama modelled in metres, placed at miniature scale (S = 0.12)
  src/clay.js         the clay surface shader with screen-space detail fade (works across a 1000× zoom)
  src/main.js         renderer, camera rig, the descent, scale-aware lighting/haze/focus/AO/shadows, UI
```

**Nested dioramas, not a street-level country.**
- **The national level is one lightweight relief.** It has:
  - a heightfield with about 320k vertices on desktop and fewer on phones;
  - about 7,000 instanced trees in two draw calls;
  - about 400 instanced town houses in one draw call;
  - three rail tubes and three trains.
- **Each story place is a small diorama** built at life scale (metres) and parented to its spot on the map with a scale
  factor. The map is levelled and snowed under at each story site (`SITES` in `geo.js`), so the diorama meets the
  country without a seam.
- **Dioramas are invisible until the camera is close.** In step 2 they load on demand, so the cost of a chapter is only paid
  when it is visited.

**One continuous camera.**
- **The rig:** a target, a distance, a heading and a tilt.
- **The descent:** interpolates the logarithm of the distance (a steady perceived zoom). The target arrives first, and the
  camera tilts down to eye level last.
- **Scaled with distance, so it stays a miniature at every height:**
  - near/far planes (with a logarithmic depth buffer);
  - shadow area;
  - haze density;
  - focus distance and aperture;
  - ambient-occlusion radius;
  - lens (50° near the ground, 32° over the country).
- **Lighting runs from golden hour over the map to blue-hour lamplight in the street.**
- **The symbolic lines fade out on the way down,** because they belong to the map view.

**How it joins Toy Town.**
- Toy Town sits on the map as the glowing hub where the three symbolic lines meet; its pin opens the existing Toy Town
  experience.
- Later, Toy Town can become a descent destination like any story site. The journey prototype already accepts a camera-pose
  hand-off from a map (`MapProvider` in `web/journey/src/world/map_diorama.js`), so neither side needs rewriting.

**The chapter engine (step 2).**
- **Script, not code:** each chapter is data — a destination, camera beats, character cues, caption lines and an optional
  action — so the organisation can review the copy in one file.
- **One timeline:** a pure function of time drives camera, characters and captions, giving exact play / pause / skip / jump.
- **The same script also produces** the text-and-image alternative (stills rendered from the same beats) and a
  reduced-motion version (cuts instead of flights).
- **The actions bar never depends on the story.**

## Data and accuracy

| Item | Source / status |
|---|---|
| State boundaries | US Census cartographic boundaries via `us-atlas` (ISC licence; the data is public domain) |
| Mountains | Mountain ranges and uplands are placed by real longitude/latitude; heights are exaggerated for legibility |
| Towns | Generic regional places, not Toys for Tots campaign locations |
| Story communities | Maple Hollow and Riverton are fictional |
| Rail lines | Storytelling devices, not routes |
| Statistics and process claims | None in the prototype. Any numbers or descriptions of how toys are collected and distributed must come from the organisation. |

## Step 1: what works and what doesn't yet

**Works:**
- The country is recognisable at a glance: Alaska and Hawaii insets, the Great Lakes, the snowy Rockies and northern tier,
  golden plains, red-rock and terracotta Southwest, the green South.
- The descent over Ohio into Maple Hollow at dusk is continuous, with no cuts or loading pauses.
- The street-level view frames the community hall, the toy drop-off box and the lit town tree.

**Not yet:**
- **Placeholder relief, not data:** the relief is stylised rather than an elevation dataset.
- **Basic mid-height terrain:** at mid-height the terrain between towns is plain snowy clay.
- **No characters yet:** they arrive with Chapter 1.
- **Frame rates unmeasured:** frame rates on real devices have not been measured (no GPU here).
