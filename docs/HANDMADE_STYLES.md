# Handmade style test: paper-cut storybook vs. felt and textile

Branch `experiment/handmade-styles` (from `experiment/storybook`). Prototype: `web/handmade/`.
Nothing in the earlier prototypes, the Blender scene or the Marine was changed.

**Question:** can the Toy Town world look like a genuinely handmade miniature set, not a conventional 3D game,
while staying real-time, explorable 3D?

**Method:** build the same small corner twice, from code, and put the two side by side:
- the blue toy shop and the pink house;
- one Christmas tree;
- one street lamp;
- a short cobbled street with snow;
- one Marine.

## How to run and compare

```bash
cd web && npm install && npm run dev        # → http://localhost:8765/handmade/
```

- **Paper / Felt / Compare** (keys 1, 2, 3). Compare renders both styles from the same live camera; drag the handle to move the dividing line.
- **Camera presets.** The same positions are used for both styles:

  | Preset | What it shows |
  |---|---|
  | Hero | the main composition |
  | Elevated | the whole set from above |
  | Close-up | the display window, awning and door: the construction |
  | Street | low, eye-level |
  | Side | the shop's side and back, chimney and tree |
  | Roof detail | tiles and snow |
  | Marine | follows the walking puppet |

- **Interactions** (both styles, applied together so the comparison stays like-for-like):
  - tap the shop door: it swings open on its hinge and shows the room behind;
  - tap the lamp: it switches on or off, and its light and shadows go with it;
  - tap the tree: its lights twinkle or hold steady.
- **Toggles:**
  - Marine walks.
  - Stop-motion: the puppet is posed 12 times a second, "on twos".
  - Felt fibres: switches the shell fuzz on and off, to see what it adds and what it costs.
- **URL options:**
  - `?style=paper|felt|split` and `?cam=Close` choose the starting style and view.
  - `?fuzz=0..8` sets the number of felt shells.
  - `?ao=0` and `?dof=0` turn off ambient occlusion and depth of field.
  - `?capture=1` is the headless test mode.
- **Checks:**
  - `node tools/tests/handmade_views.js OUTDIR` renders every preset for both styles.
  - `node tools/tests/handmade_interact.js OUTDIR` renders the comparison split, door, lamp and Marine views and checks a real click on the door.
- **Packaging:** `tools/build_handmade.sh OUTDIR` produces `handmade.html` + `handmade.js` + the Marine rig as base64.
- **Review images:** `renders/handmade/` holds every preset for both styles, at 1280×720.

## What was there, and why it read as a game

- The village is generated in Blender by Python (`scripts/tt/*`), baked into merged glTF, and lit in Three.js.
- One shared shader (`patch()` in `journey/src/world/diorama.js`) adds a world-space clay bump and colour drift.
- The Marine is one skinned mesh on an 18-bone rig, with four hand-made clips.

Every object is a smooth, bevelled solid with a noise bump. Nothing shows how it was physically made:
- no material thickness;
- no cut edges;
- no layers casting shadows on each other;
- no seams or joins.

That missing evidence of construction is what makes it read as "3D game", more than the colours or the lighting.
So both experiments rebuild the objects from the stock they would really be made from, instead of re-texturing the
existing meshes.

## Architecture

| File | Role |
|---|---|
| `src/main.js` | Host: one renderer, one camera and OrbitControls, presets with eased moves, the Marine's beat (same path and pace for both styles), clicks, split-screen compare, capture hooks |
| `src/layout.js` | The shared section: building positions and dimensions (same as the clay scene), cameras, Marine path |
| `src/kit.js` | Shared construction kit (details below) |
| `src/puppet.js` | Reuses the existing Marine's skeleton and clips but discards its clay skin; each style attaches rigid parts to the bones, so it moves like a real jointed puppet |
| `src/paper/*` | Experiment A |
| `src/felt/*` | Experiment B |

`src/kit.js` provides:
- seeded randomness;
- hand-cut outlines: a polygon resampled and pushed in and out by smooth noise, like scissors that wander, with optional torn-edge noise;
- extrusion into real slabs: crisp for card, rolled edges for felt;
- generated, mip-mapped tileable surface textures sampled triplanar in object space (no UVs needed);
- a batcher that merges hundreds of pieces into one draw call per material, keeping per-piece colour, an edge channel and a random seed.

All geometry is generated in the browser at load time: about 1.4 s for paper and 3 s for felt on this CPU-only machine.
Nothing is downloaded except the Marine's existing rig.

## Experiment A: paper-cut storybook

**Built**

- **Card stock** is 3 cm thick at village scale (about 0.8 mm at model scale). Every piece is a real slab with its own hand-cut outline.
- **Walls** are folded card boxes with the window and door openings really cut out. Each opening has card reveals going back into the wall and a vellum pane behind it, glowing with cloudy fibres.
- **Layering:**
  - wall → window frame (one card with the panes cut out) → wider moulding card;
  - louvred shutters with cut slits and a heart, hinged open at an angle;
  - pediments, dentilled belt course, lace eave trim with punched holes, scalloped bargeboards;
  - a sign board standing on spacers, a gilt frame card, and cut gilt letters.

  Each layer is a card thickness or a spacer in front of the one behind it, so each casts a thin shadow.
- **Roofs** are rows of scalloped (shop) or square-tab (house) tiles. Each row is lifted at its lower edge so it overlaps the row below. Torn white paper sheets sit over the upper slopes, with a cut drip line at the eave and a folded ridge cap.
- **The tree** has ten slotted fins of fir silhouette with drooping tier tips:
  - each fin is gently cupped (card sags);
  - snow scraps are glued to the tiers;
  - punched-disc ornaments, a paper-chain garland of interlocking links, glowing beads;
  - a folded ten-facet star.
- **The lamp** is black card:
  - a fluted folded post and filigree brackets with punched holes;
  - a lantern of four framed vellum panes under a folded pyramid roof;
  - its light is the only point light that casts shadows, so the frame throws real shadows on the street.
- **The street:**
  - a laminated base board whose edge shows the stacked card layers;
  - a road of individually cut cobbles, some doubled with a second layer;
  - pavement slabs and a folded kerb;
  - snow drifts built from stacked, torn, slightly curled scraps on spacers.
- **The backdrop** is theatre flats: four layers of cut hills with snow caps, a hillside village with lit cut windows, fir silhouettes, a painted curved sky with punched star holes and a vellum moon.
- **The Marine** is a papercraft puppet:
  - folded prism limbs and body, and a faceted head;
  - glued-on piping, chevrons, buttons and face;
  - brass split-pin fasteners at the shoulders, elbows, hips and knees.
- **Falling snow** is tumbling scraps of white paper, animated on the GPU.

**What worked**

- **Thickness and the cut edge.** The edge gets the paler, rougher "core" colour of real card. This, plus layering with real shadow gaps, is what sells it. The close-up and roof views are the convincing ones.
- **Openings cut out with vellum behind.** The windows glow like a paper theatre, and the toys in the display windows become shadow-puppet silhouettes.
- **Overlapping scalloped tile rows and torn snow sheets.** These give the strongest "physical miniature" read from the Hero and Roof views.
- **Shared GPU techniques.** Ambient occlusion (GTAO) in the gaps between layers and a shallow depth of field ("macro lens") both help the miniature scale a lot.

**What didn't, or needs more work**

- **Procedural noise for paper grain.** My first version computed the grain per pixel, and it aliased into harsh speckle up close. I replaced it with a generated, mip-mapped paper tile mapped in object space; that is stable at every distance and cheaper.
- **The papercraft Marine.** It is convincing as an object, but folded prisms drift towards "low-poly game character". A real paper puppet would want:
  - flatter, layered body pieces;
  - visible glue tabs;
  - a hand-drawn face (an illustrated texture rather than geometry).
- **Big flat surfaces still look clean.** Real card warps a little and picks up handling marks; a subtle panel bow and baked contact shadows would help.
- **The backdrop flats are serviceable but plain.** A proper illustrated backdrop (painted by an artist, then cut into layers) would lift the whole set.

**Cost** (CPU-only test machine, so frame rates are not real-device numbers):
- 0.56 M triangles in the scene;
- per frame, including the shadow maps, ambient occlusion and depth of field: 3.2 M triangles drawn in about 250 draw calls;
- built in about 1.4 s.

This is light: it should run comfortably on phones.

## Experiment B: felt and textile village

**Built**

- **Felt panels** are about 3 mm at model scale (8.5 cm world), with rolled, slightly irregular edges. Walls are blanket-stitched all round, with the thread wrapping over the edge.
- **Windows are appliqué, not holes:**
  - a pane of thin golden felt (lit, as if from inside) is sewn on;
  - a cream frame is sewn over it with a running stitch;
  - the glazing bars are embroidered in satin stitch;
  - stuffed sill cushions sit below.
- **Stitching is real geometry.** There are about 15,000 individual thread stitches, drawn as one instanced draw:
  - running stitch, blanket stitch, satin stitch, cross stitch;
  - French knots;
  - "TOYS" embroidered in gold satin stitch;
  - brick courses embroidered on the chimney;
  - sewn-on buttons with thread crosses.
- **Roofs** are scalloped felt rows, each stitched along its top. Fluffy carded-wool snow sits on top, and a wisp of grey wool smoke rises from the shop chimney.
- **The tree** is one firm needle-felted cone with drooping tiers, lumpy from noise. It has:
  - tufts of wool snow on each tier;
  - felt-ball ornaments and a yarn garland;
  - glowing felt-ball lights;
  - a stuffed star blanket-stitched in gold.
- **Cobblestones** are about 900 individually stuffed felt pebbles. Pavement slabs are stuffed felt squares, and the kerb is a stuffed roll.
- **Snow** is drifts of lumpy, very fuzzy carded wool, plus layered white felt.
- **Presents** are soft boxes wrapped in woven fabric (gingham and tartan, with a weave micro-relief), with satin ribbon and bows.
- **The Marine** is a cloth doll:
  - stuffed limbs with stitched seams;
  - button joints, button eyes, an embroidered smile, appliqué cheeks;
  - yarn-loop hair and a felt cap with a gold button.
- **Falling snow** is little puffs of wool.

**Fibres and fuzz without overwhelming the browser**

- **Surface.** A generated 512² felt tile (thousands of short curly fibres plus clumping) gives colour flecks and bump. It is mip-mapped and mapped triplanar, so it does not shimmer.
- **Sheen.** `MeshPhysicalMaterial` sheen gives felt's soft bright rim at grazing angles, with no specular highlight.
- **Silhouette fuzz** comes from GPU "shells":
  - each felt mesh is drawn N more times, pushed out along the normal;
  - each shell is cut down (`discard`) to a sparser set of stray fibres;
  - this softens every edge and silhouette;
  - it costs one instanced draw per mesh, with the shell index from `gl_InstanceID`;
  - a per-piece channel sets the fibre length: about 0.4 on window panes, 1 on panels, about 3 on wool snow and the tree.
- **Cost.** Five shells multiply the fuzzed geometry five times, so the scene grows from about 0.65 M triangles to about 3.4 M. To keep that affordable:
  - far, flat and hidden pieces (backdrop, base board, roof underlay, the inside of the shop) skip the shells;
  - the shells and the stitches are skipped in the helper passes (ambient occlusion normals, depth of field), which don't need them;
  - phones get 3 shells instead of 5;
  - the lamp's six-sided shadow map is re-rendered only when something near it changes (both styles; the walking Marine doesn't throw a lamp shadow, only a key-light shadow).

  Per frame, felt draws about 8.0 M triangles in about 320 draw calls. Before those last two optimisations it was 44 M, and paper went from 12.7 M to 3.2 M.

**What worked**

- **The shells.** Fuzzy silhouettes, wool snow and the needle-felted tree are what make it unmistakably textile, not "a smooth object with a fabric texture".
- **Stitches as real instanced geometry.** They catch light and cast tiny shadows, and are much more convincing than painted-on stitch lines. The blanket stitch over the panel edges explains how the house was made.
- **Appliqué windows.** They are more textile-true than cut holes, and suit the medium.
- **Stuffed pillow shapes** (cobbles, sills, sign board, valance scallops) carry the "soft and handmade" feel very cheaply.

**What didn't, or needs more work**

- **Cost.** Shell fuzz is the expensive part. Five shells should be fine on desktop GPUs, and phones get three. It still needs a proper quality ladder, measured on real devices:
  - shells only near the camera;
  - fewer shells on phones;
  - fins at silhouettes as an alternative.
- **Fuzz tips can sparkle into salt-and-pepper noise.** I toned them down; temporal anti-aliasing would clean it up properly.
- **Large walls are flat panels with a texture.** They are convincing at Hero distance but a little "printed" in the close-up. Slight puckering where stitches pull, and stuffing bulges between seams, would help.
- **The felt Marine is cute and textile.** The limbs are lathe shapes, though, so up close they read more "plush toy" than "hand-sewn doll"; real seams and darts would sharpen that.

## Comparison

| | Paper storybook | Felt and textile |
|---|---|---|
| Distinctiveness | high: reads as a pop-up book or paper theatre, close to the existing storybook pop-up transition | very high: unusual on the web, warm and tactile |
| Clarity at a distance | crisp silhouettes, strong layered shadows | softer, warmer; silhouettes blur slightly (that's the point) |
| Close-up payoff | cut edges, layers, vellum glow | stitches, fibres, wool |
| Real-time cost (per frame, all passes) | low: 3.2 M triangles, about 250 draw calls | moderate to high: 8.0 M triangles, about 320 draw calls with five shells; needs a quality ladder |
| Fit with the existing pop-up map transition | natural continuation (map → pop-up book → paper diorama) | a change of material at the transition |
| Phones | easy | needs reduced shells |

## What it would take to scale each style to the full world

Both styles are generated by rules, not modelled by hand. Scaling is mainly about turning these rules into a reusable
"building kit" and budgeting the expensive bits.

**Shared**

- **One parametric building generator per style.** It would replace the hand-placed shop and house code with a description (footprint, storeys, roof type, window rhythm, colour set, trims) that the generator turns into paper or felt construction. The two buildings here are effectively the first two entries.
- **Run the generators offline.** At the scale of a village they should write optimised glTF (meshopt) at build time, as the clay village does now, instead of building in the browser. Load times stay short, and the batching (one draw call per material) already matches the existing export pipeline.
- **Streaming and level of detail:**
  - per-block chunks;
  - distant buildings as simplified flats (paper) or panels without shells (felt);
  - full detail only near the camera.
- **Art direction.** An illustrator should own the palette, trims and the backdrop. The procedural kit then builds what they draw, rather than inventing it.

**Paper**

- Cheap to scale. The main costs are the number of cut pieces and shadow-casting point lights.
- Needs:
  - a library of trims (lace, bargeboards, dentils, shutters) as reusable cut profiles;
  - one or two illustrated backdrops;
  - baked contact shadows for distant blocks;
  - more character work on the puppets (flatter layered pieces, drawn faces).

**Felt**

- Budget the shells:
  - distance-based shell count;
  - shells only on hero objects and silhouettes;
  - a phone tier with 0–2 shells and the texture plus sheen only.
- Stitches are cheap per stitch, but there are many. Generate them only near the camera, or bake distant stitching into a normal map.
- Temporal anti-aliasing for the fibres.
- A small "fabric library" of tileable textures: felt, wool, gingham, tartan and so on.

**Honest caveats**

- Everything was rendered on a cloud machine with no GPU (SwiftShader). The triangle and draw-call numbers are real; frame times are not. Measure on real phones before deciding.
- "Looks handmade" was judged from screenshots in this session. Neither style has been compared side by side with a photograph of a real paper or felt model.
