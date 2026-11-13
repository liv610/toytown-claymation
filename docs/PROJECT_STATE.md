# Project state and hand-off

Last updated: 11 November 2026. Repo: github.com/liv610/toytown-claymation (private).

## The vision, in one paragraph

**Railroad of Hope** is a concept for a Toys for Tots-related website that tells the organisation's mission as a
handcrafted miniature world:
- an illustrated (folk-art) national map criss-crossed by red, blue and green trains;
- **Toy Town**, an imaginative claymation hub visitors can explore;
- local community stories that pop up out of the map.

The goal is understanding and participation, not a game. Every scene offers a relevant real-world action, and the
actions are always available without the world.

## Where we are now (updated)

**Newest: `experiment/campaign-finder` (from `experiment/textile-toytown` at `1f6a4f1`). Milestone 1, "Find your local
campaign".** Plan: [Milestone 1 technical plan](https://claude.ai/artifact/K1gtbYErahn9pzdwAvDdVV). The owner approved
it one step at a time and reviews each step before the next one starts.
- The state before Milestone 1 is kept as the branch `preserve/pre-m1` on GitHub. That is the same commit as
  `experiment/textile-toytown`. A `pre-m1` tag exists locally only: this environment's GitHub proxy refuses tag pushes.
- **Step 1 (done, approved): the national page works before and without the 3D map.**
  - `web/national/src/app.js` is the new entry (`dist/national.js`, under 1 KB). It wires the ways-to-help bar and the
    dialogs, then lazily imports `main.js`, which loads the 3D map and three.js as a separate `main-HASH.js` chunk (shared code goes in `chunk-HASH.js`). This
    is the same split the journey uses.
  - If the map can't start (no WebGL, network error) or `?map=off` is set, the page says so and stays usable.
  - Nothing else in `main.js` changed.
  - Builds (`npm run build:national`, `tools/build_national.sh`) use esbuild code splitting. **Publishing now needs
    every `.js` file in the output folder** (`national.js`, `main-*.js`, `chunk-*.js`).
  - Check: `tools/tests/national_shell.js OUTDIR`. It covers map off (desktop and phone), WebGL unavailable, actions
    before the map is ready, drag/zoom, the descent into Chapter 1, skip, look around, replay, and back to the map.
- **Step 2 (done, approved): the campaign finder, with fictional test data.**
  - **Where it appears:** a felt panel under the top bar. It is the right-hand column on wide screens (1100 px and
    up) and a full-width strip on tablets and phones. It is open when the page loads and works before and without the
    3D map.
    - "Find Local Campaign" opens it and focuses the ZIP field. The other three actions keep their placeholder dialog.
    - It tucks into a "Find your local campaign" button when the visitor heads into Maple Hollow, or with "Hide".
  - **Data model:** `web/shared/campaigns.js` holds the directory format, validation, ZIP normalising and the lookup.
    It has no DOM and no three.js.
    - A campaign *serves* a ZIP code only if its `serves.zips` lists it, never because it is near.
    - *Nearby* campaigns (within 60 miles of the ZIP's point, at most 3) are a separate list with a caution.
    - Inactive campaigns are never shown.
  - **Test data:** `web/national/assets/campaigns.test.json`.
    - Six fictional campaigns. Websites are on example.org. ZIP codes are 00101–00401, which USPS has not assigned.
    - The file is marked `"test": true`.
    - Every result, card and the panel carries a "Test data" label.
  - **Safety:** the page declares its source on `#finder` (`data-campaigns="test"` on this prototype).
    - An `official` source refuses test data.
    - A missing, broken or unconnected directory shows a link to the official site instead of results:
      `data-official-url` is currently `https://www.toysfortots.org/` (to be confirmed).
    - `?campaigns=official` previews that production fallback today.
  - **UI:** `web/national/src/finder.js`.
    - Covers search, validation, results, the reusable campaign card (`finder.showCampaign(id)`, for the map in
      step 3) and focus handling. The Escape key leaves a card.
    - Campaign text is always inserted as text, never HTML.
  - **Checks:**
    - `node tools/tests/finder_unit.mjs` (30 checks, no browser);
    - `node tools/tests/finder_e2e.js OUTDIR` (69 checks: validation, outcomes, card, outbound link, keyboard-only,
      phone and tablet, official fallback, before and while the map loads);
    - `tools/tests/national_shell.js` (updated).
  - Not yet: the map link (step 3), events (step 4).
- **Step 3, first part (done, awaiting review): ZIP search drives the map.** The owner asked for Step 3 in increments.
  This is the first; selecting campaigns from the map waits for review.
  - **One source of truth:** `web/national/src/selection.js` (no DOM, no three.js). The page and the lazily loaded map
    share one instance through esbuild's shared chunk.
    - The finder writes the selection: choosing a result selects a campaign, and "Back" or Escape clears it.
    - The card renders from the selection. The map only listens.
  - **Map:** `web/national/src/campaign_focus.js`, about 15 lines of hook-up in `main.js`.
    - **Framing:** a selection over the country view frames the campaign in the open area. `freeArea()` reads the top
      bar, the finder (right-hand panel or top strip) and the bottom controls. The camera target is shifted so the
      campaign lands at that area's centre, using the same lens formula, now `fovFor()`.
    - **Pin:** a felt-headed hat pin with a stitched gold ring, its own layer. It is long enough for its head to clear
      a label pin at the same place (Maple Hollow).
    - **Reduced motion:** the camera jumps instead of flying.
    - **Late map:** a selection made before the map loads is framed when it arrives.
    - **Descent and story:** during the descent, in Maple Hollow or in the story, the card works but the camera stays
      put. "Visit Maple Hollow" can interrupt a campaign move.
  - **Narrow screens:** "See it on the map" on the card tucks the finder away. The pill then reads "Show: <campaign>"
    and brings the same card back. The map re-frames into the newly open space if the visitor hasn't moved it.
  - **Check:** `tools/tests/finder_map.js OUTDIR`.
  - **Recommended for the next parts:**
    - **States:**
      - Clicking a state (there is no state click today) should zoom toward it and list that state's campaigns in the
        finder.
      - It should never select a campaign.
      - Its markers become more prominent.
      - With hundreds of campaigns that list is the scalable path; one pin per campaign at country zoom is not.
    - **Markers at scale:**
      - One instanced mesh for all campaign markers: one draw call whatever the count.
      - Shown progressively by zoom: none, or a quiet stitch dot per state, over the whole country; individual
        markers once a region fills the view.
      - A screen-space spacing pass before any real clustering.
      - The non-3D route to every campaign stays the finder's list.
    - **Pins that coincide:** when a campaign shares a place with a story label pin (Maple Hollow), the label could
      step aside while a campaign is selected. That would change an existing pin, so it needs the owner's go-ahead.

**Newest line of work: `experiment/textile-toytown` (from `experiment/national`). The owner chose a handmade textile direction for the whole project.**
- **Owner, latest: "I want the whole thing to be the felt, we're moving on from the clay."** Order agreed: regional map and
  descent → station/departure and toy shop → national map and Maple Hollow.
  - **Done (Toy Town journey):** the felt street (the felt style test's own scene, `web/textile/src/felt_town.js`) plus a
    felt skin for everything else, switched by one uniform in the journey's surface shader (`feltU` in
    `web/journey/src/world/diorama.js`): the felt test's wool tile, matte with a grazing sheen, quilted ground with
    stitched seams, a navy river with running stitches, batting snow. The region is lit like the felt test (deep-blue
    night, warm key, cool rim, more bloom), so map, descent, street, station and shop share one sky.
  - **The descent** is one continuous move ending on the felt street's storybook camera; the felt street fades in over
    the last ~1.4 s (`renders/textile/felt_descent_sheet.jpg`).
  - **Felt only:** the published build has no look switch and ships felt stills (`web/journey/assets/stills_felt/`).
    Locally, `?look=felt|textile|clay` still compares.
  - **Owner, next round (done):** "fill the region's houses", "a little depth to the toys in the window like the
    paper-cut version", "the toy shop much bigger inside, like a magical storybook world".
    - **Houses:** `export_region.py --split-corner --split-houses` takes all 34 background houses (hillside, square,
      cottages, farmhouses) out of the base village (now 3.7 M triangles) into `houses_clay.glb` + `houses.json`; the
      journey sews each one in felt at the same footprint (`buildFeltHouses`, `web/textile/src/corner.js`).
    - **Window:** the felt shop's display windows are open shadow boxes (felt-lined, lit back with felt hills, firs and
      stars, toys standing at three depths): `displayWindow` in `web/textile/src/vendor/felt_build.js`.
    - **Storybook shop:** `web/textile/src/storyshop.js`, a 20 × 16 × 10 m felt hall (patchwork floor, shelves of felt
      toys, gallery train, giant tree, castle, balloon, mobiles, starry ceiling, sparkles). The six interactive toys,
      their tricks, pins and cards are unchanged (`journey/src/world/toyshop.js`, `storybook` option).
  - **Honest limits:** the region's trees, barns, chapel and station keep their clay *shapes* under the felt skin.
  - **The national map in felt (first version):** [Felt National Map](https://claude.ai/artifact/McR8crJFroPL2dhZJikDTF)
    (a new page; the clay national map link is unchanged). `web/national/src/felt_relief.js` + `felt.js`: each state a
    felt patch in a regional colour, puffed and seamed, dashed running stitch on state borders, gold blanket stitch on
    the coast, navy felt sea with wavy stitching, wool-roving mountains with batting snow, felt firs, felt houses with lit
    windows, padded-cord rail routes, batting clouds. Felt is the default; `?look=clay` shows the clay map. Maple Hollow
    and the Chapter 1 cast and props wear the felt surface but keep their clay shapes (not yet sewn).
    - **Picture-map reference (owner, no labels), 3 sessions.** Session 1 (look: warm patchwork, chunky gold stitching,
      dashed routes to a felt star at Toy Town, blue felt lakes, stitched rivers, edge clouds; stitch thickness follows the
      camera) and session 2 (landmarks, `web/national/src/landmarks.js`: stuffed felt peaks with batting snow, big fir
      clusters, cottages, farms with windmills, cacti, mesas, lighthouses, palms, a moose, a mission; one instanced draw
      per kind; they shrink back on the way down) are done. Session 3: Canada, Mexico and the Caribbean (world-atlas,
      projection change).
    - **Owner's museum brief (latest):** a handcrafted North American diorama — land of layered felt and fabric that
      changes with the **ecosystems, not at state borders**; mountains of folded grey felt and batting; houses glowing
      along the three routes; **Canada and Mexico equally detailed**; a three-quarter overhead camera. Done in this pass:
      the board now spans Canada, Mexico, Central America and the Caribbean (Alaska and Hawaii stay as insets, moved into
      the Pacific); continuous felt land coloured by ecosystem (`web/national/src/ecosystems.js`); bare-rock sierras in
      Mexico; autumn trees in the East; homes along the routes; agave, embroidered flowers and missions in Mexico; moose
      in Canada; the map on a framed board and plinth in a dim gallery, seen from three-quarter overhead.
    - **Tried and dropped (owner: "too much"):** a scrap-quilt land after the "Patchwork quilt" technique (patch.gg/blendi,
      MIT). Removed from the code; nothing of it is shipped.
    - **Sharing:** published pages may only carry HTML, script, style, image, video and audio files. The packaging scripts
      therefore ship models as `NAME.glb.js` and data as `NAME.json.js` (read as text by `web/shared/data.js` and the
      loaders, never run). The packaging also blanks three.js GLTFLoader's built-in 1-px AVIF test image (AVIF is not
      an accepted type; no model uses AVIF textures).
    Package: `tools/build_national.sh OUTDIR` (its Toy Town pin opens Felt Toy Town); checks: `tools/tests/felt_national.js`,
    `tools/tests/national_package_smoke.js`.
  - **Not started:** the national map and Maple Hollow in felt (separate project, `experiment/national`).
- **Scope:** one cohesive textile world across the national map and Toy Town, at different scales. The national map keeps its routes, geography, stops and navigation, but its look will change. Prove it in Toy Town first.
- **Built, awaiting review:** the toy shop corner of Toy Town in textile, built from a reusable construction language (`web/textile/`, `docs/TEXTILE_SYSTEM.md`).
  - **The corner:** the shop, the pink house, the tree, the lamps, garlands, five neighbours, firs and the street.
  - **The Marines:** both are stuffed puppets on their existing rig and story.
- **Comparing:** [Textile Toy Town](https://claude.ai/artifact/Ajk5aHEBWDgSDXdZ7j5RZG) (opens in the textile look; Clay / Textile / Felt switch, T cycles). Locally: the journey with `?look=textile|felt|clay`. Without `?look`, the journey is unchanged. Same-camera images and numbers: `renders/textile/`.
- **Decided: FELT** (without fibres) is the direction: "everything feels soft, almost like a toy". Keep the textile puppet Marine. The textile test's twilight light is liked and can be applied to felt. Textile stays on the branch as a reference; the construction kit (`web/textile/src/construct.js`) serves both.
- **Source of the techniques:** `experiment/textile-storybook` (with paper and felt on `experiment/handmade-styles`). It was ported by copying files (`web/textile/src/vendor/`, source commit noted), not merged.
- **National map target:** the owner's reference image (felt land on a navy felt sea, gold blanket-stitched coast, stitched routes, roving mountains). See `docs/TEXTILE_SYSTEM.md` §4. Not started, by agreement.

**Current line of work: `experiment/national`.**
- **The national story in this project is now a 3D claymation map of the US.**
- **The owner explores alternative art styles (paper, felt) in a separate project.**
- **Step 1 (built):** the clay national map and the descent into Maple Hollow.
- **Chapter 1 (built, awaiting review): *It Starts With You*.**
  - **What happens:**
    - A family walks up to the drop-off box; a volunteer waves; a Marine carries a carton of toys into the hall; neighbours
      pass across the street.
    - At the box the story waits a few seconds for the visitor to tap the toy, then carries on by itself.
    - The child sets the red truck in, the box glows, and the camera rises to the street.
  - **Around it:** play, pause, skip and replay; a text version; an end card with a placeholder "Find a Toy Drop-Off".
  - **Prototype:** [Railroad of Hope National Map](https://claude.ai/artifact/Ljs6JaGJYW1kMGijHRKaZ1). Press "Visit Maple
    Hollow", or add `#chapter1` to the link (`?chapter=1` locally) to start in the chapter. Architecture and plan:
    `docs/NATIONAL_MAP.md`.
- **Owner's priorities after Chapter 1:**
  1. National map art direction: sculpted mountains, tree clusters, lit villages along real miniature tracks, composition.
  2. Opening screen and story navigation ("Explore the Journey" / "Find a Way to Help").
  3. UI softening: ivory, evergreen, cranberry, paper.
  4. A magical toy shop.
  5. Chapters 2–5 and the ZIP ending.
- **Copy rule (owner, after review):** story text must not say where a given toy ends up ("given to a child in your own
  community", "on its way to a child"). It also must not build on the unconfirmed online-gift process. Use invitations
  ("Want to give a toy too?") and placeholders until the organisation confirms the wording. The journey copy was revised
  to match and republished.

## Earlier status (storybook branch)

**Waiting on the owner:** the owner is evaluating the **storybook pop-up transition** (branch `experiment/storybook`):
- the illustrated national map;
- a community lights up;
- the drawing pops up like a pop-up book and turns into a clay diorama at dusk;
- it folds back into the map.

**Next, once the owner approves the hand-off:** build the **chapter engine and Chapters 1–2** of *Follow the Journey of a
Toy*, exactly in this order:
1. Begin on the illustrated national map; a community lights up.
2. Transition into its miniature diorama (Maple Hollow, a fictional small town, **not Toy Town**). A family donates a new,
   unwrapped toy at a collection point; a volunteer welcomes them; the visitor can tap the toy to see it placed in the box.
   CTA: *Find a toy drop-off near you.*
3. Return to the national map; follow a symbolic train route.
4. Enter the **sorting-centre diorama** (Riverton, nearby, also fictional): Marines and volunteers sort toys by age group
   and prepare them for distribution. CTA: *Volunteer with your local campaign.*
5. Return to the national map as more communities illuminate.

**Requirements for the chapters:**
- **Length and pace:** short and warm, about 10–15 s per chapter.
- **Controls:** pause, skip and jump between chapters, with CTAs that don't interrupt the story.
- **Accessibility:** an illustrated, text-based version.
- **Continuity:** the recurring red toy as the visual thread.
- **Reuse:** existing assets where possible (the Marine and its rig, the gift, the drop-off box, the clay shader).
- **Later:** Chapters 3–5 (nationwide illumination, the toy reaching a community, ZIP-code ending).

## Branches and what they contain

| Branch | Contents | Published prototype |
|---|---|---|
| `master` | Stages 1–3: procedural Blender village (`scripts/build_scene.py`, `scripts/tt/`), beauty render, snow/flicker loop, real-time Three.js viewer (`web/realtime`), the Marine (rigged, Walk/Idle/Carry clips), *The Delivery* interactive cinematic (`web/sequence`), hybrid viewer (`web/hybrid`) | earlier artifacts (see the session history) |
| `experiment/map-scale` | 320 × 260 m regional diorama around the village, validated railway layout (`scripts/tt/layout.py`, `region.py`), trains, continuous descent (`web/region`), `docs/MAP_SCALE_ASSESSMENT.md` | — |
| `experiment/visual-quality` | Cycles texture-bake experiment on the blue shop and pink house (`scripts/tt/hq.py`, `bake_hq.py`, `export_hq.py`, `web/hq`), before/after images, `docs/VISUAL_QUALITY_EXPERIMENT.md` | [Toy Town Quality Test](https://claude.ai/artifact/3bqaJDnGMco4e3kR83cfXf) |
| `experiment/journey` (from map-scale) | Journey prototype: drop-off reached three ways (direct / explore / Marine story), the toy shop interior and "send a toy online" with the station departure and ZIP line map, illustrated fallback, local event log + research panel (`web/journey`), `docs/JOURNEY_PROTOTYPE.md`, `docs/JOURNEY_TESTING_GUIDE.md` | [Toy Town Journey Prototype](https://claude.ai/artifact/68VGT1ZJfx3HdZF8vPkQNw) |
| `experiment/campaign-finder` (from textile-toytown) | **Newest.** Milestone 1, the campaign finder, built step by step. Step 1: national page shell + lazy 3D map (`web/national/src/app.js`). Step 2: the finder with fictional test data (`web/shared/campaigns.js`, `web/national/src/finder.js`, `web/national/assets/campaigns.test.json`). Step 3 (first part): shared selection + the map following it (`selection.js`, `campaign_focus.js`). Tests: `national_shell.js`, `finder_unit.mjs`, `finder_e2e.js`, `finder_map.js`. `preserve/pre-m1` = the state before it | — (not republished yet) |
| `experiment/textile-toytown` (from national) | **Newest.** Textile construction system (`web/textile/`), the textile toy shop corner + puppet Marines in the journey behind `?look=`, split village export (`scripts/tt/corner.py`, `export_region.py --split-corner`), `docs/TEXTILE_SYSTEM.md` | [Textile Toy Town](https://claude.ai/artifact/Ajk5aHEBWDgSDXdZ7j5RZG) |
| `experiment/textile-storybook`, `experiment/handmade-styles` | The owner's separate style experiments (paper, felt, textile). Source of the textile techniques; not merged | — |
| `experiment/national` (from storybook) | **Current line of work.** Clay national relief + descent into Maple Hollow + Chapter 1 with townspeople (`web/national`, `scripts/tt/people.py`, `scripts/tt/toys.py`), `docs/NATIONAL_MAP.md`; journey copy revised | [Railroad of Hope National Map](https://claude.ai/artifact/Ljs6JaGJYW1kMGijHRKaZ1) |
| `experiment/storybook` (from journey) | Earlier line of work. Pop-up transition test (`web/storybook`): placeholder illustrated US map (`mapart.js`), pop-up community (`popup_town.js`), timeline + scrubber (`main.js`); plus `tools/tests/`, this doc and `CLAUDE.md` | [Storybook Pop-up Test](https://claude.ai/artifact/4V1Ax45MgzCV2UVdy5a928) |

New work should branch from `experiment/national` (it contains everything except visual-quality); previously `experiment/storybook` (it contains master + map-scale + journey + storybook).
`experiment/visual-quality` is a side branch.

## Decisions log

| When | Decision | Why |
|---|---|---|
| Stage 1 | Procedural Blender (Python) clay village, Cycles; Three.js for real time | free tools; reproducible from code |
| Marine | Rigged clay Marine with Walk / WalkCarry / Idle / IdleCarry; two skin tones | reused in every prototype since |
| Map scale | Regional diorama works; full 3D at national scale is costly | led to the later folk-art decision |
| Visual quality | Baked lighting = warmer, but the owner preferred the **live-shaded snow**; reference-image quality is not reachable in real time | prioritise interactivity; reserve offline Cycles for marketing clips |
| Journey | Action layer first, 3D lazy-loaded, simple view, local measurement | usability, mobile, honest testing |
| Online gifting | Placeholder catalogue/checkout; no retailer named; gifts go to the local campaign for a ZIP; delivery shown as a region lighting up | partner and logistics are the organisation's decision; privacy |
| National layer | **Use the existing folk-art national map** (placeholder for now); no second 3D national map | brand consistency; avoid a large build |
| Signature transition | Illustrated map → **pop-up book** → clay diorama, and back | distinctive visual language |
| National story (later) | **A lightweight 3D claymation relief of the US** with nested story dioramas and one continuous camera; folk-art and other styles explored in a separate project | owner's direction for this project |
| Toy Town | Stays the imaginative hub; national-story communities are separate small dioramas | clarity of roles |
| Symbolism | Train and red toy are metaphors, not literal logistics | accuracy; organisation to review the narrative |
| Townspeople | Parent, child and volunteer are sculpted like the Marine and skinned to **his rig and walk/idle cycles** (`people.py` reuses `marine.py` without changing it) | one stop-motion cast; no new rig to maintain |
| Toys in the story | Always **new and unwrapped** (red truck, teddy, blocks, ball, doll); the wrapped-present pile by Maple Hollow's box was removed | matches "new, unwrapped toy"; avoids mixed messages |
| Chapter 1 interaction | One optional tap (give the toy); the story waits ≤ 4.5 s then continues; actions bar always live | meaningful but never forced |
| Visual direction (final) | **Felt without fibres**, chosen after the clay / textile / felt comparison in the journey; textile puppet Marine | owner: soft and toy-like |
| Visual direction (earlier) | **Handmade textile world** for the whole project (national map + Toy Town), textile primary, felt where it helps. The folk-art look is no longer a constraint | owner's decision after comparing paper / felt / textile |
| Textile approach | Port techniques selectively, never merge the style branches; construction over texture (sewn panels, laps, tabs, bindings, batting); stitching only where it holds things together | the experiment still looked like textured 3D in places |
| Corner split | Village exported once more with the test corner separated (`--split-corner`); original assets untouched; both looks swap live | safe A/B in the real journey |
| Story copy | Invitations, not process claims; nothing about where a specific toy goes | owner's review (point 8); organisation to approve wording |

## How to run and rebuild

- **Web:** `cd web && npm install && npm run dev`.
  - Journey prototype: `/journey/` (conditions `?variant=direct|explore|story`, `?map=flat`, `?lite=1`, `?research=1`; in
    artifacts the same as `#direct` etc.).
  - Storybook: `npm run build` then `/storybook/`.
- **Package for artifacts:** `tools/build_journey.sh OUTDIR`, `tools/build_storybook.sh OUTDIR`, then publish
  `journey.html` / `storybook.html` with the folder's other files.
- **Checks:** see `tools/tests/README.md`. Fastest is `npm run test:gift-direct` (about 1 minute, no 3D).
- **Blender assets** (only if the village itself changes):
  - `tools/install_blender.sh`;
  - `blender -b -P scripts/build_scene.py -- …`;
  - exporters in `scripts/` (`export_region.py`, `export_hq.py`);
  - `tools/post_all.sh` / `tools/post_hq.sh` (gltf-transform optimisation).

  The web prototypes use the committed, already-optimised assets in `web/*/assets`.

## Publishing the felt journey (so it can be rebuilt from the repo alone)

1. Assets: `blender -b --factory-startup --python scripts/export_region.py -- <tmp> --split-corner --split-houses`, then
   optimise with `web/tools_optimize.mjs` (commands in `docs/TEXTILE_SYSTEM.md`; houses: `houses_clay_raw.glb →
   houses_clay.glb 0.1 0.001`). The optimised files and `corner.json` / `houses.json` are committed; raw files are not.
2. Felt stills: `QS=look=felt node tools/tests/journey_stills.js web/journey/assets/stills_felt` and
   `QS=look=felt node tools/tests/journey_toys_departure.js web/journey/assets/stills_felt <review dir>`.
3. Package: `TEXTILE=1 tools/build_journey.sh <outdir>`; check it with `tools/tests/felt_package_smoke.js`.
4. Publish `<outdir>/journey.html` with its files to the artifact link above.

## Known issues to carry forward

- **Campaign finder (Milestone 1), open questions for the owner and the organisation:**
  - The exact URL of the official campaign finder. The fallback link points to the official homepage because the site
    refuses automated fetches from here.
  - The format of the official campaign directory. `web/shared/campaigns.js` documents the shape the finder expects.
  - Where ZIP code locations for "nearby" come from in production.
  - Whether nearby campaigns should be shown at all when no campaign serves a ZIP code.
- **Campaign finder while the 3D map is being built:** a search can wait until the browser is free. Under SwiftShader
  that was about 1.3–1.5 s; real devices are expected to be faster, but this hasn't been measured.

- **Felt journey:**
  - region buildings away from the street are clay shapes under a felt skin (no seams or stitches of their own);
  - the station platform shot still sometimes frames a roof column (as before).
- **Fixed on `experiment/textile-toytown`:** black blocks in some frames (a non-finite pixel spread by bloom; it happened
  in clay too, e.g. at 1280×720 mid-descent). A sanitize pass now runs before ambient occlusion and before bloom.
- **Journey:**
  - the station platform shot can have a roof column at the side of the frame;
  - the story shot is tight on portrait phones;
  - "Give Toys" in the bar opens drop-off only;
  - toys are simple shapes.
- **Storybook:**
  - the map is a placeholder drawing;
  - the reverse transition simply replays the forward one at 1.25×;
  - no family, volunteer or interiors yet (that's Chapter 1–2 work).
- **National Chapter 1:**
  - the Marine "enters" the hall on a cut (the door doesn't open);
  - adults are cropped at the head in the close shot (camera at child height, intentional but worth reviewing);
  - characters walk set paths and can brush the snowbanks;
  - passers-by wrap around off-screen;
  - no sound.
- **Real-device performance has never been measured** (no GPU here); the in-page Measure / `perf` events are there for it.

## Licences of what's used

| Item | Licence |
|---|---|
| Blender (tool) | GPL |
| world-atlas 2.0.2 (countries-50m; Natural Earth data): Canada, Mexico, Central America, Caribbean on the felt map (`web/tools_neighbours.mjs` → `web/national/assets/neighbours-albers.json`) | ISC (package); Natural Earth data public domain |
| three.js | MIT |
| three-mesh-bvh | MIT |
| glTF-Transform | MIT |
| meshoptimizer | MIT |
| esbuild | MIT |
| Playwright (testing) | Apache-2.0 |
| us-atlas | ISC; the data is US Census Bureau boundaries, public domain |
| d3-geo | ISC |
| delaunator (textile panels) | ISC |
| robust-predicates (used by delaunator) | Unlicense |
| topojson-client | ISC |
| Fonts: Fraunces, Atkinson Hyperlegible | SIL Open Font License |

All models, textures and illustrations are made in this repo by code; no purchased or third-party art.
