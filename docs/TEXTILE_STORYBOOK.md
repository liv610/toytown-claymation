# Experiment C: mixed-media textile storybook

Branch `experiment/textile-storybook` (from `experiment/handmade-styles`). Code: `web/handmade/src/textile/`.
Review images: `renders/textile/`.

It is the third option in the handmade style test:
- the selector now reads **Paper · Felt · Textile · Compare**;
- Compare can pair any two styles, picked from the menus in the top corners.

Paper and Felt are unchanged. Two things are shared by all three styles and were adjusted here:
- the **Side** and **Marine** camera presets were re-aimed, so they work in the denser street;
- a frame-timing hook (`timeFrames`) was added for measurement.

```bash
cd web && npm run dev        # → http://localhost:8765/handmade/?style=textile
node tools/tests/handmade_views.js OUT textile                  # every preset
node tools/tests/handmade_interact.js OUT                       # compare split, door / lamp / tree, real clicks
node tools/tests/handmade_measure.js OUT.json                   # the three styles measured under identical conditions
```

## 1. What was there

| | Paper (A) | Felt (B) |
|---|---|---|
| Construction | hand-cut card slabs (3 cm at village scale), real openings with vellum behind, layered trims, scalloped tile rows | bevelled felt slabs, stuffed "pillow" shapes, about 15,000 instanced capsule stitches |
| Surface | paper tile sampled triplanar (3 samples) + per-pixel value noise | felt tile sampled triplanar + a per-pixel fibre-noise shader on 5 "fuzz shells" (each felt mesh drawn 5 more times, pushed out, fibres cut out by `discard`) |
| Lights | key + rim + 7 point lights (1 shadow-casting) | the same |
| Marine | the existing rig and Walk clip; rigid parts attached to each bone (one mesh per bone per material) | the same |

Interactions (door, lamp, tree), the camera presets and the Marine's path all live in the shared host (`src/main.js`).

### Why Felt is so much slower

Measured under identical conditions:
- Hero view, 1280×720, with ambient occlusion, depth of field and bloom on;
- `tools/tests/handmade_measure.js`.

Frame times come from a CPU renderer (SwiftShader), so only their ranking means anything. Raw numbers: `renders/textile/measurements.json`.

| | Frame time (CPU, ranking only) | Triangles drawn per frame (all passes) | Scene triangles | Draw calls |
|---|---|---|---|---|
| Paper | 7.9 s | 3.2 M | 0.56 M | 247 |
| Paper, no AO/DOF | 5.4 s | 1.1 M | 0.56 M | 90 |
| Felt, 5 shells | 15.8 s | 9.3 M | 4.65 M | 324 |
| Felt, no AO/DOF | 13.3 s | 6.1 M | 4.65 M | 148 |
| Felt, no shells | 6.6 s | 6.2 M | 1.53 M | 304 |
| **Textile** | **4.3 s** | **3.1 M** | **0.67 M** | **186** |
| Textile, no AO/DOF | 2.7 s | 1.1 M | 0.67 M | 76 |

**The fibre shells cost more than half of the felt frame.** Switching them off saves 9.2 s of 15.8 s, yet removes only a third of the triangles. So the cost is per pixel, not geometry:
- every shell re-shades the same pixels (heavy overdraw);
- each shell pixel evaluates three stretched-noise fibre families;
- `discard` stops the GPU rejecting hidden pixels early.

Triangle count alone does not explain the difference.

**The felt base is also heavy without shells: 1.5 M triangles.** That comes from:
- bevelled, smooth-shaded slabs with finely resampled outlines;
- 15,000 capsule stitches;
- each of these drawn again in the shadow, ambient-occlusion and depth-of-field passes.

**Paper is slower than its triangle count suggests** because its surface shader does three texture samples plus per-pixel noise.

**Lights add up for every pixel.** Each pixel evaluates every point light (three.js has no per-object light culling). Paper and Felt have 7 point lights; Textile has 5.

**The post passes cost a lot in all three.** Ambient occlusion and depth of field take 30–40% of each frame. They also re-draw the scene for normals and depth, which is why "triangles per frame" is about three times the scene count.

## 2. The approach for Textile

**Material identity comes from construction.** Each material is built the way the real thing is built:

| Material | Used for | How it's built | How it's shaded |
|---|---|---|---|
| Wool felt | shop walls, shutters, shingles, tree, uniform | slabs with rolled edges, slightly irregular outlines | matte, faint sheen, fibre mottling, darker cut edge |
| Woven cotton | awning, pink house walls, ribbons, sign, the Marine's face | sewn panels, a billowing awning, a bound hem | thread relief and over/under weave, sheen along threads |
| Printed calico | pink house roof, presents, display wallpaper | stuffed pillow shingles in rows | the woven base plus one of four small prints (flowers, dots, stars, sprigs) |
| Cardstock | window frames, door frame, paper lace | crisp, unbevelled, layered | the Experiment A card shader, with its pale cut edge |
| Painted wood | lamp, awning rod, planters, crate, toys, buttons | turned and boxed shapes | brush-stroke relief, soft clearcoat |
| Cotton batting | all snow | a soft heightfield draped over each surface, tapering and tucking under at a ragged edge | high relief, bright sheen, no fibres |
| Embroidery thread | stitches | 8-triangle instanced stitches lying flat on the cloth | ply twist, satin sheen |
| Twisted yarn | garlands | tubes | a two-ply spiral |
| Thin glowing fabric | curtains, lamp panes, tree lights | gathered folds | warm light through the weave (gaps bright, threads darker) |

**Every material samples one generated, mip-mapped texture once per pixel.** The texture holds relief, albedo detail, mottling and a mask. Coordinates are projected per piece on the CPU, so the grain follows the cut and there is no triplanar sampling. There is no per-pixel noise and there are no fuzz shells. "Soft" is carried by geometry (stuffed shapes, draped batting, rolled edges) and by sheen.

**Key constructions:**
- **Toy shop:**
  - felt walls with whipped corner seams;
  - shadow-box display windows with small handmade toys:
    - a stuffed bear with an embroidered nose and a ribbon;
    - stacked painted blocks;
    - a drum with stitched cord;
    - a painted wooden train with button wheels;
    - a dollhouse.
  - the display wallpaper is printed calico;
  - curtained upper windows glowing through gathered cotton, framed in cardstock;
  - felt shutters with lazy-daisy flowers;
  - "TOYS" in two layers of felt letters on a stuffed woven sign, blanket-stitched in gold;
  - an awning sewn from cotton stripes, billowing between wall and rod, with seam stitching and a scalloped valance bound in bias tape;
  - felt shingle rows stitched along their tops, batting snow, paper lace on the gable.
- **Pink house:**
  - pink woven walls, diamond-quilted below the windows;
  - a patchwork roof of stuffed calico shingles;
  - a stuffed bay window, embroidered shutters, a plum felt door with a thread-wrapped wreath.
- **Tree:** felt discs cut with pinking shears, threaded on a dowel and drooping. It is dressed with:
  - wooden button ornaments;
  - fabric bows;
  - a twisted yarn garland;
  - glowing beads;
  - a stuffed felt star.
- **Street:**
  - a narrow lane of rounded cut-felt and tweed "stones";
  - snow showing in the joints, more at the edges;
  - tweed and felt pavements, stuffed kerbs, a painted picket fence;
  - small lost things: footprints, a dropped ribbon, a red mitten, pine needles, a wooden button.
- **Garlands:** twisted yarn swags with wooden buttons and warm lights, across the alley and along the pink house eave.
- **The village around it:**
  - neighbours on both sides, with shutters, scalloped trims and cardstock frames;
  - an alley between the hero buildings, ending at a lit wall;
  - two rows of houses climbing the hill behind, a clock tower with an embroidered face;
  - felt firs in three bands, foreground firs framing the view;
  - one big batting ground, a twilight sky, haze.
- **Light:** twilight sky and haze, a cool soft "moon" key light, warm light only from practical sources:
  - the shop interior;
  - window spill;
  - the lamp (shadow-casting, re-rendered only when something near it changes);
  - the tree.

  The rig is 5 point lights and no rim light. Bloom is low.

### The Marine

Built as a small stuffed stop-motion puppet, on the same skeleton and Walk clip:
- **Head:**
  - about 1.6× the old one, sewn from six panels in fine cotton, with the seams pulled in and stitched;
  - black buttons on felt eye whites, with a catchlight;
  - satin-stitched brows, a backstitched smile;
  - felt cheeks, a stuffed nose, little stuffed ears;
  - a brown felt hair panel with yarn curls;
  - a stuffed white cap crown, a black felt band embroidered in red, a pillowy visor, a gold button.
- **Body:**
  - one pear-shaped felt coat with stitched side seams, a red stitched placket and gold buttons;
  - a cotton belt with a buckle;
  - soft limbs with button shoulder joints and stitched chevrons;
  - red felt cuffs, cotton mittens with thumbs;
  - ribbon trouser stripes sewn down the seams;
  - big round felt shoes.
- **Performance:**
  - a small additive head bob and tilt is layered on the walk;
  - stop-motion "on twos" is still available.
- **Draw calls:** all parts are merged into 7 skinned meshes, each part rigidly weighted to its bone. The puppet is still articulated like a jointed puppet, but costs 7 draw calls per pass instead of about 80. That change alone took the textile frame from 361 to 186 draw calls.

## 3. Assessment

**What worked**

- **Material contrast.** Felt, cotton, crisp card, painted wood and batting side by side read as different things. Less fuzz turned out to be more believable: the softness comes from shape (stuffed, draped, rolled), not from hair.
- **Building assembled things, not textured boxes.** These carry most of the handmade read:
  - the sewn awning with its bound scallops;
  - card frames over glowing gathered curtains;
  - layered felt letters;
  - the patchwork roof;
  - batting draped over and tucked under the edges.
- **The village around the hero buildings.** It changes the feeling more than any material:
  - neighbours, the alley, rows of rooftops climbing into haze, the clock tower;
  - foreground firs and the fence;
  - the hero view no longer shows a board edge or empty space.
- **The Marine as a stuffed puppet:**
  - the oversized sewn head, button eyes with felt whites and an embroidered face give him a personality the earlier versions lacked;
  - the head bob makes the walk feel performed.
- **Performance:** one texture sample per material, cheap stitches, merged characters, and background batches that skip shadows and the helper passes. Textile is the cheapest of the three per frame, with about the same triangles as Paper and far fewer than Felt.

**What still looks like a video game**

- **The background houses** are simple boxes with glowing rectangles. They work through the haze, but up close they are generic.
- **Large flat walls** read as "textured plane" at Hero distance. Real felt walls would show slight puckering at seams, stuffing bulges and pins.
- **The lighting.** It is soft but uniform: everything is lit by the same key and sky. A real miniature photograph has more falloff, darker corners and a single dominant warm source.
- **The street stones** are better than raised cobbles, but their layout is still visibly algorithmic from the Elevated view.
- **The tree** reads as felt discs from the side but as a stack of plates from eye level.

**Most successful techniques**

1. Construction-led modelling: stitched seams, bound edges, layered appliqué, stuffed pillows, draped batting.
2. One detail texture per material, with UVs that follow each piece's cut, and relief from that texture. Cheap, stable at every distance, and distinct per material.
3. Instanced 8-triangle stitches. Real geometry where it is seen, at a fraction of the capsule cost.
4. Composition: haze, layered rows of buildings, foreground framing, warm practical lights against cool twilight.

**What is computationally expensive**

- **Ambient occlusion and depth of field:** 30–40% of the frame, plus the extra scene re-draws for normals and depth.
- **Shadow maps:** the key-light map redraws every caster each frame.
- **Point lights:** every pixel evaluates every point light.
- **Build time:** about 3.7 s of geometry generation in the browser at load. Fine for a test; at village scale it should move to a build step.
- **Draw calls:** now about 186. Most come from separate batches per material and per kit, and from the helper passes.

**What I would improve next**

1. Bake the background houses (and later whole blocks) offline to optimised glTF, with lighting and AO baked into textures. Keep live shading for the hero street only.
2. Add sewing details to large walls: puckers along seams, a little stuffing relief, a few visible pins and tacking stitches.
3. Rework the lighting towards a photographed miniature:
   - one warmer, lower key from the street lamp's side;
   - darker edges;
   - a slight vignette;
   - stronger falloff on the shop interior light.
4. Lay the stones by hand-designed patterns (a few authored tiles) instead of a jittered grid.
5. Make the tree from overlapping, tilted felt "branches" per layer, so it reads as a tree from every height.
6. A quality ladder for phones: half-resolution AO, no DOF, a smaller shadow map.

## 4. Could this scale to the national quilt map?

**Yes, and better than the other two directions.** The techniques used here map directly onto the quilt idea:

| National-map element | Technique from this experiment |
|---|---|
| States or regions | stitched fabric panels (woven or calico) with blanket-stitched borders; one generated texture per fabric, UVs that follow each panel's cut |
| Mountains | quilted, stuffed pillow forms (`pillowGeo`) under the fabric |
| Rivers | ribbons (woven strips) |
| Railroads | embroidered lines (instanced stitches) |
| Forests | felt firs (the cheap pinked-disc firs) |
| Snow | batting drapes |
| Communities | small versions of this street, loaded on demand |
| Lights appearing as communities join | the glow-fabric material and bead lights |

**Costs at that scale:**
- **The quilt itself is cheap.** Mostly large panels, one texture sample each, stitches only where the camera is close. Stitches can become a normal-map line at a distance.
- **Towns must be streamed.** The national view shows each town as a cheap silhouette with glowing windows; the full street loads only when the camera descends.
- **Generate assets offline.** Generating everything in the browser does not scale. At map scale the same generators should run at build time and write meshopt-compressed glTF, as the clay village already does.

The visual metaphor works in this style without any special-case technology.

## Honest notes

- Every image was rendered on a cloud machine without a GPU (SwiftShader). Triangle and draw-call counts are exact; frame times only rank the configurations. Real-device frame rates need a measurement on actual phones and laptops.
- "Looks handmade" was judged from screenshots in this session. It has not been compared with photographs of real textile models.
