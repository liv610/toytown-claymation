# The national story: clay map + chapter system

Branch `experiment/national` (from `experiment/storybook`). Prototype: [Railroad of Hope National Map](https://claude.ai/artifact/Ljs6JaGJYW1kMGijHRKaZ1).
Toy Town, the journeys, the regional diorama and the storybook test are untouched.

Goal: *Follow the Journey — discover how a little generosity becomes holiday joy*, told in five short chapters across a
clay miniature of the United States.

## Plan, in increments

1. **Step 1 (built).** A recognisable clay national map and one continuous descent into a detailed community (Maple
   Hollow, Ohio, fictional).
2. **Step 2.**
   - **Chapter 1 (built, awaiting review): *It Starts With You*.** About 15 seconds in Maple Hollow, described below.
   - **Chapter 2 (next):** *A Community Comes Together*, the Riverton sorting centre with Marines and volunteers; optional
     "Volunteer Locally".
   - **Then:** the general chapter engine, extracted from Chapter 1.
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
  src/community.js    Maple Hollow: loads maple.glb (built in Blender with Toy Town's generators), placed at
                      miniature scale (S = 0.2); lamps, glows, falling snow and the street pose
scripts/tt/community.py      Maple Hollow's buildings, street and props, made with Toy Town's own generators
scripts/export_community.py  builds and exports maple_raw.glb + maple.json; then optimise with tools_optimize.mjs:
  TT_OVERRIDE='{"Snow":[0.12,0.0016],"Needles_0.102":[0.22,0.0012]}' node web/tools_optimize.mjs \
    web/national/assets/maple_raw.glb web/national/assets/maple.glb 0.14 0.001     (4.5 M → 0.21 M triangles, 0.8 MB)
  src/clay.js         the clay surface shader with screen-space detail fade (works across a 1000× zoom)
  src/main.js         renderer, camera rig, the descent, scale-aware lighting/haze/focus/AO/shadows, UI, story clock
  src/chapter1.js     Chapter 1: cast, props, script (pure function of story time), camera shots, draft copy (CH1)
  tests/cast.html     dev page: every character in every clip, side by side
scripts/tt/people.py         parent, child, volunteer: sculpted like the Marine, skinned to his rig (marine.py unchanged)
scripts/tt/toys.py           new, unwrapped toys (red truck, teddy, blocks, ball, doll), a carton of toys, a toy wagon
scripts/export_chapter1.py   exports ch1_parent/child/volunteer (Walk, Idle, + WalkCarry/IdleCarry/Give, Wave, Look)
                             and ch1_props; optimise each with: node web/tools_optimize.mjs IN_raw.glb OUT.glb 0.5 0.0004
                             (props 0.4 0.0005). The Marine is web/sequence/assets/marine.glb, copied.
```

## Chapter 1: *It Starts With You*

**Beats (seconds):**

| Time | Shot | What happens |
|---|---|---|
| 0–3.8 | Wide and low from the street | The family walks up the sidewalk. The Marine carries a carton of toys from the wagon to the hall door; the cut hides him going in. The volunteer waves. |
| 3.8–6.6 | Following the family | The family walks to the drop-off. |
| 6.6–9.8 | Close on the box, at child height | The story waits at 7.3 s (for at most 4.5 s) for "Give the toy", a tap on the button or on the toy itself. The child reaches in, the red truck arcs into the slot, the box glows and a few sparks rise. The volunteer nods, then waves. |
| 9.8–14.4 | Rising to the street | Ends on the end card. |

**Design rules kept:**
- **Actions stay live:** the top/bottom action bar never depends on the story.
- **Never forced:** the tap is optional, and the story waits only briefly.
- **Controls:** pause, skip, replay and "Read as text" (a dialog with the whole chapter in prose).
- **Reduced motion:** cuts instead of dollies and crane moves.
- **Phones:** portrait framings, and the prompt sits below the toy so it never covers the child's face.
- **Dignity and privacy:**
  - nobody is named;
  - the family is fictional;
  - the toy is new and unwrapped;
  - the copy says nothing about where the toy goes.
- **Draft copy:** all text is in `CH1` in `chapter1.js`, for review.

**Checks:** `tools/tests/national_chapter1.js` (stills at given story times; or a real-time run that waits at the box, taps,
checks the end card and that the actions open during the story). SwiftShader only, so no real-device frame rates.

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

**Changed after the first review:** Maple Hollow was rebuilt in Blender with Toy Town's own generators. That fixed:
- the snow drips that looked like eggs (now real icicles and sculpted snow slabs);
- the sign text that overflowed its board (now raised lettering sized to fit);
- buildings that weren't as beautiful as Toy Town.

The descent also now comes down along the street, so it never passes through roofs.

**Not yet:**
- **Placeholder relief, not data:** the relief is stylised rather than an elevation dataset.
- **Basic mid-height terrain:** at mid-height the terrain between towns is plain snowy clay.
- **Chapter 1's open points:** see "Known issues" in `PROJECT_STATE.md`.
- **Frame rates unmeasured:** frame rates on real devices have not been measured (no GPU here).
