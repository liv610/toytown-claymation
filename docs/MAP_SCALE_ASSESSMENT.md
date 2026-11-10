# Can claymation work at map scale? — Toy Town region experiment

Branch `experiment/map-scale`. The existing village, *The Delivery* sequence and their artifacts are untouched;
everything here is opt-in (`street.REGION`, `export_region.py`, `web/region/`).

## What was built

* **Region:** a 320 × 260 m tabletop diorama around the existing village (board, sculpted edge, painted plinth).
* **Layout first, validated:** `scripts/tt/layout.py` defines station, square, routes, river, roads and farm sites;
  `python3 -m tt.layout` runs 72 checks (all pass) and `scripts/draw_plan.py` draws the plan
  (`renders/region/railway_plan*.png`).
  * Red and blue enter the station's **west** gable on separate tracks 6 m apart, then diverge (red NW, blue SW).
  * Green enters the **east** gable and crosses the river **once**, on its own stone railway bridge.
  * All three terminate at buffer stops beside platforms inside the arched shed; no track touches the square,
    the head house or the village; no level crossings; tightest curve 37 m; each route ends at a tunnel portal
    near the board edge. Gradients are limited to 2.5 % and lifted for bridge clearance.
  * The head house entrance faces the square across a 2.5 m forecourt.
* **Landscape:** heightfield hills shaped by the route/road profiles and carved for the river; painted per vertex
  (warped-Voronoi field patchwork, broken hedgerows, earth banks, snow that settles on heights, north faces and around
  the town); stone road bridge, railway bridge, tunnel portals; 3 farms with barns/silos/paddocks/orchards, cottages
  and a chapel, each with its own silhouette; ~700 trees from 12 hand-varied prototypes in clustered woods.
* **Station:** brick head house with lit arched windows, clock-tower pavilion and "TOYS FOR TOTS" lettering; glazed
  barrel-vault shed on iron ribs with snow lying in drifts; gable screens with track openings and fan lights.
* **Square:** flagstones, a 10 m decorated tree, benches, lamps, houses on three sides, two Marines walking.
* **Browser:** Map / Approach / Village presets, one continuous 13 s *Enter Toy Town* flight and its reverse,
  Explore with a collision spring-arm, moving trains on all three routes, on-device measurement.

## Measurements

Counts are exact and hardware-independent. Frame **times** below were taken on this cloud machine's CPU software
renderer (SwiftShader, no GPU) and are only meaningful *relative to each other*; the artifact's
**Measure performance** button runs the same matrix on a real device.

Per frame (all passes: shadow maps, ambient occlusion, depth of field, main):

| View | Config | Draw calls | Triangles |
|---|---|---:|---:|
| Map | full | 1,615 | 5.3 M |
| Map | no effects | 533 | 1.8 M |
| Map | no shadows | 862 | 2.7 M |
| Map | **no LOD** | 1,582 | **19.1 M** |
| Approach | full | 1,414 | 11.1 M |
| Approach | no effects | 466 | 3.7 M |
| Village | full | 1,245 | 10.9 M |
| Village | no effects | 410 | 3.6 M |
| Village | **lamp cube shadows on** | **5,916** | **69.1 M** |

Relative frame cost (software renderer): effects ≈ +60–70 %; directional shadows ≈ +45–60 %;
turning LOD off doubles map-view cost; lamp-post point-light shadows ≈ ×2.7 at street level; snowfall not measurable.

Memory: geometry buffers 28 MB (village hi + lo, landscape, terrain, prototypes); instance data 0.5 MB;
shadow maps 28 MB; render targets ≈ 4 MB at 480 × 270 (≈ 60 MB at 1080p with effects); JS heap 70 MB;
**196 shader programs**.

Asset sizes (web): static 3.9 MB (1.24 M tris, from 12.9 M in Blender), low-detail static 0.9 MB (214 k),
terrain 0.2 MB (60 k), prototypes 0.17 MB hi / 0.10 MB lo. The village itself is ~1.0 M of the 1.24 M triangles;
the whole landscape around it adds only ~0.25 M plus instances.

Optimisations used: merge by material (≈ 160 meshes instead of ~10,000 objects), GPU instancing with per-instance
LOD (70 m), whole-village LOD swap beyond 150 m, distance-scaled fog/shadow frustum, village lights and lamp shadows
switched off at distance (both lighting variants pre-compiled to avoid hitches), snowfall only near street level,
distance-faded shader detail so clay noise never shimmers from above.

## Assessment

**Visually**

* **Map view: works as a diorama, not yet as an illustration.** It reads immediately as a crafted object on a table —
  board edge, plinth, river, colour-coded railways, farms, station as anchor. But at this distance the handcrafted
  surface detail that makes the village special is sub-pixel: trees become crumbs, the snow-covered civic area is a
  plain slab, and the patchwork, while hand-painted, is closer to a model-railway layout than to a folk-art
  illustration. Making the overhead view as rich as the village would need *map-scale* art (exaggerated landmarks and
  trees, sculpted terrain features, forced perspective), i.e. a second art direction, not a zoomed-out village.
* **Medium view: the strongest result.** During the descent there is a genuine "you're entering a miniature town"
  moment (station clock tower and roof in front, the square's tree, the blue toy shop, houses climbing the hill,
  Marines in the square). This is where the technique is most convincing.
* **Street view:** preserved, identical to the village benchmark.
* **Continuity:** one camera move, no cuts; clearance audited along the whole flight (≥ 2.26 m from any surface).
  LOD swaps happen during the descent (village at 150 m, trees at 70 m); they were not visible in captures but should
  be judged on a real screen.

**Technically**

* One region costs 1.2–1.6 k draw calls and 5–11 M triangles per frame *with* effects and shadows. That is
  workable on a desktop GPU and heavy for phones; it is unmeasured on real GPUs from here.
* **The national map cannot be one scene.** Ten such regions resident at once would be ~300 MB of geometry and
  10–15 k draw calls. Option A requires: regions as separately loaded chunks streamed by camera position; a
  pre-built overview representation per region (one merged mesh or an impostor, 1–3 draw calls) for the high view;
  fewer, consolidated materials (196 programs is a compile-time risk); shadows/effects tuned per distance; no
  point-light shadows (or baked). That is a real engine project, not an extension of this prototype.
* Production art cost scales with regions: each destination needs its own landmark architecture to be worth
  descending into.

**For the A / B / C decision (evidence so far, not a verdict):** Option A is technically feasible only with a
streaming architecture and is visually strongest in the descent, weakest at the top level. Option B keeps the
illustrated map's strength at the top level and uses this experiment's best moment — the descent into a crafted
village — as the transition. Option C is the cheapest path to the best-looking moments. A useful next experiment
would be to test B directly: the folk-art map as a textured board, morphing into this diorama during the first
seconds of the descent.

## Not done / limitations

* No Cycles beauty render of the map view (browser renderer only).
* No real-GPU frame rates; no mobile test; LOD-swap visibility not evaluated on a real display.
* Trains run a simple shuttle; the Delivery cinematic is not embedded in this build.
