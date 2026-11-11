# The textile world: construction language and the Toy Town proof of concept

Branch `experiment/textile-toytown` (from `experiment/national`). Owner's direction:
- one cohesive handmade textile world across the national map and Toy Town, at two scales of the same handmade creation;
- the national map's functions stay (routes, geography, stops, navigation), but its look can change completely;
- prove the approach in one corner of Toy Town first.

Code: `web/textile/` (shared by every scene). Journey integration: `?look=textile` or `?look=clay` (artifact: `#textile` or `#clay`).

## 1. The construction language

The rule: **the handmade look comes from believable construction, not from texture, noise or decoration.**
Every element is built the way a maker would build it with real material.

| Element | How it is built | Code |
|---|---|---|
| Any cut piece (walls, doors, signs, patches) | felt or cloth with real thickness and a rolled cut edge, a little stuffing behind the face, soft puckers only along the seams that hold it | `panelGeo` / `k.panel` in `construct.js` |
| Walls | several vertical panels, each a hair out of square, lapped over the next and **sewn along the lap**; seams never cross an opening | `k.sewnWall` |
| Roofs | individually cut tabs in overlapping rows, widths and angles varying, a few corners lifted, the rows sagging toward mid-span; mostly one fabric with occasional patches of two others; a felt strip folded over the ridge and blanket-stitched down | `k.shingleRoof` (felt tabs); stuffed calico pillows for the pink house (from the experiment) |
| Window frames | three ways, used deliberately: **painted wood strips** (mitred, a touch off true) for shop displays; **layered card** for upper windows; **bound cloth** (a padded binding, whip-stitched) for the pink house | `k.woodFrame`, `cardFrame`, `k.boundFrame` |
| Lit windows | a gathered strip of thin cotton behind the opening, lit from inside (threads darker, gaps bright) | `curtain` + `glow` material |
| Awnings | sewn stripes that sag between wall and rod, a scalloped valance bound in bias tape | `awning` (from the experiment) |
| Snow | cotton batting draped over surfaces, thinning and tucking under at a ragged edge; batting drifts along streets and walls | `k.drape`, `k.lump` |
| Trees | felt branches (pinked leaves) radiating in tiers from a dowel, each tilted down and overlapping its neighbours | `k.feltFir` |
| Streets | individually cut stones laid in courses that follow the street, narrower at the edges, joints left open | `k.cutStones` |
| Kerbs, bindings | padded tubes of tweed or cotton | `k.yarnTube` |
| Characters | jointed stuffed puppets on the existing skeletons: a sewn six-panel head, button eyes on felt whites, embroidered brows and smile | `puppet.js` |
| Stitching | **only where it holds something together**: laps, bindings, appliqué edges, ridge strips, quilting. Decorative embroidery is one motif per shutter. | `Stitches` (instanced, 8 triangles each) |

**Materials** (`materials.js`, from the experiment): felt, woven cotton, printed calico, batting, painted wood, glowing fabric, card, metal, glass beads, thread and yarn.
- Each one samples **one** generated detail texture per pixel.
- The texture coordinates are projected per piece, so the grain follows the cut.
- There's no per-pixel noise and no fur shells.

## 2. The proof of concept: the toy shop corner

**What it contains:**
- the blue toy shop and the pink house;
- the town Christmas tree, both lamps, the bench, the wagon, garlands and presents;
- five neighbouring houses and five firs;
- the stretch of street in front, with kerb and drifts.

It is built at the clay village's exact positions.

**How the corner was separated:**
- **Rules:** `scripts/tt/corner.py` lists the corner's builders. The long street mesh is split per triangle.
- **Dry run:** `scripts/corner_dryrun.py` checked the split before anything was exported:
  - all 54 door parts belong to the shop;
  - nothing else overlaps the corner except the left neighbour and one fir, which were then added to it.
- **Export:** `blender -b --factory-startup --python scripts/export_region.py -- web/textile/assets --split-corner` writes:
  - `static_base_raw.glb`: the village without the corner, 10.46 M triangles;
  - `corner_clay_raw.glb`: 2.44 M triangles. Together they equal the original 12.9 M.
  - `corner.json`: positions and build parameters.

  Then optimise:
  ```
  node web/tools_optimize.mjs web/textile/assets/static_base_raw.glb web/textile/assets/static_base.glb 0.1 0.001
  node web/tools_optimize.mjs web/textile/assets/static_base_raw.glb web/textile/assets/static_base_lo.glb 0.017 0.006
  node web/tools_optimize.mjs web/textile/assets/corner_clay_raw.glb web/textile/assets/corner_clay.glb 0.1 0.001
  ```
- **The original assets are untouched.** Without `?look=` the journey loads exactly what it loaded before.

**How it plugs in** (`web/journey/src/world/diorama.js`, only when `look` is set):
- the clay corner and the textile corner are both loaded;
- `host.setLook('clay' | 'textile')` swaps:
  - the two sets;
  - their camera-collision and ground-probe meshes;
  - the shop door, on the same hinge object;
  - the ground cloth (clay snow ↔ batting);
  - the drop-off box;
  - the Marines (clay ↔ puppet, on the same bones, so every clip, blend, IK reach and story beat is unchanged);
  - the story's toy (wrapped present ↔ felt bear, new and unwrapped).
- The lights are the village's own; no lights were added.
- On the page, a Clay / Textile switch appears (press T as a shortcut).

**Comparison and checks:**
- `tools/tests/textile_compare.js OUTDIR`: elevated, street, close-up, side and Marine views in both looks, from identical cameras, plus draw calls and triangles.
- The journey's own tests still run on the default page.

## 3. Performance

Measured in the journey, high tier, 1600×900, SwiftShader (no GPU). Draw calls and triangles are exact; frame times are not
real-device numbers.

See `renders/textile/stats.json` for the latest numbers (written by `textile_compare.js`).

**Expensive:**
1. **In-browser generation:** about 4–6 s of CPU on this machine for the corner, mostly the shop's sewn panels (Delaunay faces with stuffing and seams). It must move to a build step for anything larger.
2. **Fine geometry:**
   - stuffed wall faces;
   - about 2,700 roof tabs;
   - about 550 cut stones;
   - felt-branch firs.
3. **Post passes:** ambient occlusion and depth of field redraw the scene, as in the clay version.

**Cheap:**
- one texture sample per material;
- instanced stitches;
- a few batches per material: roughly 25 meshes for the whole corner, against about 80 for the clay corner;
- the puppet's 7 merged skinned meshes.

**What to move to textures or shaders:**
- stitches beyond a few metres become a texture line;
- the stuffing on far walls becomes a baked normal map;
- roof tabs on background houses become a printed tab pattern on a single sheet.

**What to instance:**
- roof tabs (one tab shape, per-instance width, tilt and colour);
- stones;
- fir branches.

**Level of detail:** the kit already has a detail switch (front row vs the row behind). The background beyond the corner should be built once, offline, with baked lighting.

**Scaling to the whole town:** feasible only with build-time generation (Node → meshopt glTF), instancing and two levels of detail. The construction functions are already pure geometry, so they can run in Node unchanged except for the canvas-generated textures, which should be baked to PNG once.

## 4. Toward the national map

The owner's reference shows the target: a physical textile diorama of the United States.

| In the reference | From this system |
|---|---|
| A navy felt ground ("sea") | one large felt panel, batting clouds |
| Land in felt panels of regional colours | `panelGeo` per state or region, a slight stuffing, cut edges that roll |
| A gold blanket-stitched coastline | `Stitches.blanket` along the outline (instanced; becomes a texture line when far) |
| Dashed running-stitch state borders | `Stitches.running` |
| Red, blue and green rail routes as raised stitching | running stitch in thick floss over a padded cord (`k.yarnTube`) for the main routes |
| Rivers and lakes | ribbons and blue felt cut-outs |
| Wool-roving mountains | stuffed pillows (`pillowGeo`) under draped batting and grey felt, exaggerated like the clay relief |
| Felt firs, tiny lit houses | `k.feltFir` and the house kit at miniature scale, instanced |
| The descent | the same camera rig as the clay map; the textile town loads at the end of the descent |

The national map stays as it is until the owner approves this corner.
