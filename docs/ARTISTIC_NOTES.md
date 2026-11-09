# Stage 1 — Artistic decisions and honest assessment

**Reference target:** the claymation blue toy shop with its pink neighbour (image 1).
**Baseline to beat:** the earlier clean Blender render (image 2), which was readable
but looked like a smooth CG model instead of a sculpted miniature.

## Workflow chosen

* **Blender 4.5 LTS + Cycles path tracing**, with the whole scene generated from Python.
  Path tracing is what gives soft shadows, subsurface glow in snow and clay, and
  light bouncing between snow and walls, and those carry most of the "real set" feeling.
  EEVEE (real-time) was not usable here (no GPU), and would lose some of that anyway.
* Everything is procedural but **art-directed**: the variation is deliberate
  (dimples, smears, sag, lean) instead of uniform noise.
* Stage 3 plan (not built yet): bake Cycles lighting into textures and export glTF
  to Three.js, compared against a hybrid that keeps pre-rendered Cycles images and
  adds real-time snow, smoke and light changes on top.

## What makes it read as handcrafted (and what didn't work)

1. **Miniature depth of field was the single biggest change.** A real miniature is
   photographed at macro distance, so the background melts. At life scale, f/0.4
   still kept everything sharp; the final uses ~f/0.13 (equivalent to a macro lens on
   a ~1:25 set). Compare `docs/iterations/01` vs `04`.
2. **Nothing is straight.** Every part gets a soft bevel, then a low-frequency
   world-space displacement, so walls bulge and lean slightly and no two shutters
   match. Each building's root is tilted by under 1°.
3. **Surface texture had to be about 10× stronger than first set.**
   The first full-resolution crop (`iterations/05`) showed the facade rendered as smooth plastic:
   the bump distances were tuned for centimetre-scale objects. With them fixed
   (`iterations/06`), the blue wall shows troweled stucco, hairline cracks and thumb-press
   dimples. Edges pick up a rubbed lighter tone (Cycles *pointiness*), and crevices
   collect warm grime (AO).
4. **Snow is sculpted, not painted on.** Roof caps are finely subdivided slabs
   with rounded edges, big lumps and a mid-frequency "crust" displacement. The snow
   shader adds packed curd-like granules, subsurface glow, blue in crevices and rare glints.
   A bug where smoothing turned plain boxes into flat oval pancakes was fixed by
   bevelling before smoothing.
5. **Lighting is like a studio set, not a sun.** A large warm soft key, dim cool fill,
   a warm rim from behind, and practicals: amber windows with frosted corners,
   hidden area lights that pour warm pools onto the cobbles, lamp lanterns, and
   tree lights. AgX Punchy grade, gentle bloom, a little mist and vignette.
6. **Windows have life.** Curtains silhouetted against the glow, toys in the
   display windows (soldier, teddy, spinning top, little engine), a cat and lamp
   in the pink cottage's bay window.
7. **The two buildings differ in silhouette, not just colour.** The shop is a tall,
   steep front gable (53°) with an arched attic window and red plank shutters. The
   cottage is low and side-gabled, with a dormer, a projecting bay window, quoins, a door
   canopy and a stone side chimney.
8. **Trees are not cones.** Stacked, drooping, scalloped clay skirts with irregular
   spacing and lean, with snow clumps pressed onto the branch tips.

## Honest assessment against image 1

**Works**
* It reads as a lit miniature set photographed with a macro lens, clearly past
  image 2. The depth of field, warm window pools and crusty roof snow do most of that work.
* The palette and cast match the reference: blue shop, green and white awning, red shutters,
  holly boxes, green door with wreath, pink cottage, lamps with red bows, red wagon,
  presents, snowy bench, stone viaduct, and a hillside village of glowing houses.
* It is a true 3D scene: every object exists in space, so the camera can move (Stage 2).

**Still short of the reference**
* **Overall richness and glow.** Image 1 is denser and more saturated, with gold light
  everywhere. Mine is more restrained, and the large ground-snow areas are plainer
  than the reference's heaped, crusty drifts.
* **Fine sculpted detail.** Image 1 has hand-carved brick, tiled roofs under the snow,
  frame mouldings and dense pine needles. Mine has the materials, but less modelled
  micro-detail (no individual bricks or roof tiles).
* **Shop window interior.** The reference's display window is a deep glowing room
  with shelves and a rocking horse. Mine has a few toys against a glowing back panel.
* **The tree** is charming but lighter and sparser than the reference's lush,
  ornament-heavy tree.
* **Background houses** are simplified (by design, since they sit in the blur), but they
  are more uniformly lit than the reference's twinkling backdrop.

**If you approve the direction, next improvements I would make (still Stage 1 polish):**
individual bricks on the chimneys, tile rows under the roof snow, a deeper shop
interior with shelves and a rocking horse, a denser tree, heaped crusty foreground
drifts, and more glowing windows and fairy lights in the background.

## Render cost

4 CPU cores, no GPU: about 2.5 min for an 800×450 preview, about 90 min for the 2560×1440 still.
A consumer GPU would cut that roughly 10–20×. This matters for Stage 2, where an
animation at this quality on CPU needs either low resolution or a long render.
