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

## Where we are now

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
| `experiment/storybook` (from journey) | **Current line of work.** Pop-up transition test (`web/storybook`): placeholder illustrated US map (`mapart.js`), pop-up community (`popup_town.js`), timeline + scrubber (`main.js`); plus `tools/tests/`, this doc and `CLAUDE.md` | [Storybook Pop-up Test](https://claude.ai/artifact/4V1Ax45MgzCV2UVdy5a928) |

New work should branch from `experiment/storybook` (it contains master + map-scale + journey + storybook).
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
| Toy Town | Stays the imaginative hub; national-story communities are separate small dioramas | clarity of roles |
| Symbolism | Train and red toy are metaphors, not literal logistics | accuracy; organisation to review the narrative |

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

## Known issues to carry forward

- **Journey:**
  - the station platform shot can have a roof column at the side of the frame;
  - the story shot is tight on portrait phones;
  - "Give Toys" in the bar opens drop-off only;
  - toys are simple shapes.
- **Storybook:**
  - the map is a placeholder drawing;
  - the reverse transition simply replays the forward one at 1.25×;
  - no family, volunteer or interiors yet (that's Chapter 1–2 work).
- **Real-device performance has never been measured** (no GPU here); the in-page Measure / `perf` events are there for it.

## Licences of what's used

| Item | Licence |
|---|---|
| Blender (tool) | GPL |
| three.js | MIT |
| three-mesh-bvh | MIT |
| glTF-Transform | MIT |
| meshoptimizer | MIT |
| esbuild | MIT |
| Playwright (testing) | Apache-2.0 |
| us-atlas | ISC; the data is US Census Bureau boundaries, public domain |
| d3-geo | ISC |
| topojson-client | ISC |
| Fonts: Fraunces, Atkinson Hyperlegible | SIL Open Font License |

All models, textures and illustrations are made in this repo by code; no purchased or third-party art.
