# Phase 1 · Milestone 1: the continuous-world spike

Branch `experiment/phase1-build`, from the Milestone 1 visitor flow (`625a80b`). Approved scope: prove one continuous
miniature world with the existing assets. No cinematic interface, no Chapters 2–4. Earlier branches are untouched.

Preview (prototype): [Railroad of Hope](https://claude.ai/artifact/RPMJvLSQ3wNfAiyAbQi5ts). Frames: `docs/milestone1-spike/frames`;
screenshots with the story interface: `docs/milestone1-spike/screens`.

## What was built

- **One Toy Town.** The Maple Hollow street now stands at the Toy Town hub, where the three railroad lines meet (one site setting in `main.js`). `?town=maple` puts it back in Ohio.
- **The descent.** Explore Toy Town (the landing button or the Toy Town label on the map) flies from wherever the map is down into the street. It lands on the story's first shot, and the story opens there with focus on its text. The existing flight function is reused.
- **Live story shots.** A first `shot` stage shows Chapter 1's three beats in the live 3D street rather than as stills. Each shot is a frozen moment of the existing Chapter 1 timeline, so the townspeople and the Marine are where that animation puts them. Next moves the camera between shots. Beats without a shot (Chapters 2–4, not built) fall back to their stills cleanly.
- **The rise.** The finale, Exit Toy Town and Back to the map rise back to the whole country. The rise is the descent played backwards. The old direct path skimmed low over the snow and looked empty halfway.
- **The finder over the live street** keeps the shot and the beat, as in Milestone 1.
- **Reduced motion:** no camera travel; a short fade through the night colour (opacity only).
- **Skip the flight:** a button shown and focused during every long flight. Escape skips too. Each flight is announced to screen readers.
- **The gold felt star** over the hub shrinks away as the camera nears the town, so it never hangs in the street's sky.
- **No 3D (`?map=off`):** Explore Toy Town opens the story with its stills, as before.
- **Fixed during the spike:**
  - **The finale's framing.** The country view was sized from the camera's current lens, which is wide in the street, so the rise stopped short of the whole country. It now uses the country view's own lens. Measured: the finale's camera now equals the landing's (target, distance, heading, tilt).
  - **Phone flights clipped a roof.** On a tall screen the descent's last stretch came in sideways through the houses. The camera now finishes turning by 70% of the flight and keeps roof height until it is over the street.
  - **A campaign picked inside Toy Town** is framed and pinned on the map after the rise, as in Milestone 1.
  - **The page's top bar showed through** the live story's bar; it is hidden while the story is live.
  - **The rise** now replays the descent backwards.

## Findings

- **Feasibility: yes, without a rebuild.** The flights, the street, the townspeople and the story controller all worked together with about 120 lines changed across five files.
- **The railroad lines did not need trimming.** They and their trains already fade out as the camera comes down, before they could cross the street.
- **Scale at the hub.** The street is small next to the map's felt house icons. Halfway down it reads as a tidy snowy diorama at the junction, then it fills the screen. Whether that feels right is a judgement for your review of the frames and the preview.
- **Phones: the country view is letterboxed.** On a tall screen the whole board sits in a band with dark space above and below. This is the existing framing, unchanged by the spike. The landing milestone (Milestone 3) is where it gets fixed.
- **Performance: not measurable here.**
  - The cloud machines have no GPU (SwiftShader). A frame can take seconds, and the 23 s "arrival" in the reduced-motion test is that software renderer, not the design.
  - Nothing new is heavy: the street, people and Marine were already loaded with the map (about 2 MB of models).
  - Two things to watch on a real phone: the map and the street drawn together during the last seconds of the flight, and keeping the 3D drawing while the story is open (Milestone 1 paused it).
  - Please try the preview on your phone; quality tiers exist (`?q=low|medium|high`) if it stutters.

## Existing Toy Town assets that could strengthen Chapters 2–4

Chapter 2 has to show collection, sorting and distribution. Collection is covered by the existing Chapter 1 animation (a family at the drop-off box, a Marine carrying a carton into the hall). For the other two:

| Asset | Story value | Reusable on its own? | Download and runtime | Extra hours |
| --- | --- | --- | --- | --- |
| **Felt storybook hall** (`textile/src/storyshop.js`) as the sorting room | High: long tables, shelves of toys, room for the townspeople and Marines to sort | Yes. `buildStoryShop()` is self-contained procedural code, no models | About 67 KB of code; about 90,000 unique triangles (about 0.5 million drawn, with instancing); 2.0 s to build on the cloud CPU, likely slower on phones, so it is built in the background during Chapter 1 | 8–12 |
| **Map trains and lit homes** (already in the national app) for distribution | High: a train leaves the Toy Town hub and homes along its line light up. Symbolic, with no family shown | Already loaded | None | 3–5 |
| Train station (`scripts/tt/region.py`) | Medium: \"the lines meet at Toy Town\" as a real station | Needs a Blender export of the station alone from the 4.1 MB region model, then the felt re-skin ported | Estimated 0.3–0.8 MB (not measured) | 6–10 |
| Felt toy shop front (`textile/src/felt_corner.js`) | Medium for identity, low for how Toys for Tots works | Built for the journey's village layout; needs re-placing | Code plus a 1.1 MB corner model | 8–12 |
| Textile puppet Marine (`textile/src/puppet.js`) | Low to medium: matches your earlier choice of puppet Marines | Yes: it dresses an existing Marine | Code only | 2–4 |
| Journey Marine scene (`journey/src/world/marine_story.js`) | Low: overlaps the existing collection animation | Tied to the journey's host | None | Not recommended |

### A Chapter 2 that follows the red toy truck

The existing assets support the four-step sequence, with the little red truck from the Chapter 1 animation as the thread:

1. **A toy is donated** (existing). A child sets the red truck in the toy drop-off box.
2. **The toy is collected** (existing). A Marine carries a carton of toys from the wagon into the Community Hall. The truck rides in that carton: the same truck model, placed in it.
3. **Toys are sorted and organized** (sorting room). Through the hall doors, the felt hall becomes the sorting room. The Marine sets the carton on a long table. Volunteers and a Marine take toys out and place them in boxes, and the red truck goes into one box.
   - This uses the existing townspeople and Marine, their existing walk, carry and idle clips, and simple felt boxes.
   - The hall's whimsical pieces (castle, balloon, giant teddy) come out, so it reads as a working room.
   - Sorting "by age" stays on the list of facts to confirm with Toys for Tots before it is shown.
4. **Toys reach families through local campaigns and community partners** (distribution). The camera rises above Toy Town and a felt train leaves the hub. Homes light up along its line, and others light up away from the railroad.
   - The railroad is the network's reach, not a delivery method.
   - No family or child is shown receiving a gift.
   - The caption names local campaigns and partner organisations, from the existing draft.

| Addition | Hours | Confidence |
| --- | --- | --- |
| Red truck carried from the box into the hall (step 2) | 1–2 | High: an existing prop and timeline |
| Sorting room with people sorting (step 3) | 9–13 | Medium: interior lighting, placing and animating people at tables, background build on phones |
| Distribution: train from the hub, homes lighting up (step 4) | 3–5 | High: existing trains and houses |
| **Total** | **13–20** | |

**Recommendation:** decide after you have tried this preview.

- **If you add them,** take them in this order: distribution first (cheap, high value), then the truck's continuity, then the sorting room.
- **Paying for them:** drop these Phase 1 enhancements (about 11–15 hours):
  - felt station signs;
  - smooth camera moves between beats;
  - railroad lines lighting up, which the distribution beat replaces;
  - the "Give the toy" tap.
- **Net effect:** the essential scope becomes about 72–92 hours instead of 61–75.
- **If the 80-hour ceiling must hold,** simplify the sorting room first: people at tables with a short loop of boxing toys, no free walking. That holds it to about 6–8 hours, for a total of about 69–85.
- **Phase 2 candidates:** the station and the toy shop front.

## Tests (final build)

| Test | Result |
| --- | --- |
| `toytown_spike.js` (new) | 25 / 25 |
| `visitor_flow.js` | 140 / 140 (two Toy Town checks updated for the flight) |
| `national_shell.js` | 42 / 42 |
| `finder_e2e.js` | 75 / 75 |
| `finder_map.js` | 39 / 39 |
| `finder_states.js` | 47 / 47 (the old Maple Hollow scenario now runs with `?town=maple`) |
| `finder_unit.mjs` | all pass |

## Effort

| | Hours |
| --- | --- |
| Plan estimate for Milestone 1 | 9–11 |
| Session time, 17 Nov 21:26 to 18 Nov 00:32 UTC | 3.1 |
| of which unattended waits for the software renderer (frames, test runs) | about 1.7 |

The plan's estimates are developer hours; this was AI session time, so the two are not the same unit. Count whichever your budget tracks.
Milestone 1 needed less than estimated for two reasons: the flights and the street already existed, and the lines needed no trimming.
The rest of the estimate stands, because the remaining milestones are mostly new interface and content work, where this kind of reuse does not apply.
The biggest unknown is still phone performance.

## How to run

```
cd web && npm run build:national && python3 -m http.server 8765    # http://localhost:8765/national/
URL=http://localhost:8765/national/index.html node tools/tests/toytown_spike.js OUTDIR    # functional checks
URL=… node tools/tests/toytown_frames.js OUTDIR [desktop|phone]                            # descent and rise frames
```
