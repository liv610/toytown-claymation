# Visual-quality experiment: blue toy shop + pink house

Branch `experiment/visual-quality`. Same buildings, composition, signage, street, cameras and
interaction as the real-time version; only rendering, materials, geometry detail, lighting and
dressing changed. Viewer: `web/hq/index.html` (dev) / the "Toy Town Quality Test" artifact.

## What was done

1. **Dressing and geometry** (`scripts/tt/hq.py`): thicker snow caps; frosting drips on the gables,
   eaves, awning and sign; bulb strings; brick chimneys; terracotta tiles; a door garland and lantern;
   planters with small firs; snow banks; and a frost dusting on up-facing surfaces.
2. **Lighting**: a warmer, stronger key light, a big bounce fill and boosted practical lights. The aim is the
   golden high-key look of the references.
3. **Cycles texture bake** (`scripts/bake_hq.py`, `fix_street_bake.py`, `rebake_props.py`):
   - Full global illumination is baked into five atlases (shop, pink, door, street, props) at 2048²
     (the door at 512²), 48 samples, OIDN-denoised.
   - In the browser these are unlit `MeshBasicMaterial`s with an HDR scale, plus a frost-glitter shader.
4. **Grade**: AgX tone mapping, a pre-tonemap saturation of 1.75 and contrast of 1.25 (approximating Blender's
   "AgX – Punchy" look), a split-tone and a vignette.
5. **Unchanged and still live**: windows, bulbs, lamps, snowfall, smoke, Marine, door swing, DOF, bloom and AO.

## Images (`renders/hq/compare/`)

| File | What it shows |
|---|---|
| `Hero_sbs.jpg` | Matching before / after from the hero camera |
| `Facade_sbs.jpg` | Building materials close-up |
| `SnowCobbles_sbs.jpg` | Snow and cobbles close-up |
| `DownTheStreet_sbs.jpg`, `StreetLevel_sbs.jpg` | Wider street views |
| `cycles_reference_hero.png` | The same scene rendered offline in Cycles, the ceiling for this approach |

## Honest assessment

**Better:**
- Warmer, softer, more "lit miniature" overall: real bounce light and contact shadows under eaves,
  awning and gifts.
- Props (gifts, planters, wagon) read as solid painted objects.
- Ground snow packed between soft clay cobbles at eye level.
- About half the draw calls.

**Worse or not there yet:**
- **Snow surfaces.** The live version's snow has crisp procedural grain and sparkle at any
  distance. Baked at about 1 cm per texel, the new snow reads as smooth plaster up close, and the drips look
  like blobs rather than frosting. User feedback agrees: the previous snow looked better.
- **Close-up materials.** Wall and awning grain is softer than the live procedural bump. Colours are more pastel.
- **Not reference quality.** The ChatGPT references have:
  - much coarser, painterly surface texture;
  - huge glowing windows;
  - thick, glossy, drippy snow;
  - a very shallow-focus macro look.

  This experiment closes part of the lighting gap, but not the material and snow gap.
- **Static lighting.** Baked lighting is fixed: the door opening and the Marine walking don't change it
  (the door's glass and the glows stay live).

**Recommended next step:** a hybrid. Keep the baked light for walls, wood, props and cobbles, but render every
snow surface live (procedural grain, sparkle, subsurface tint), using the bake only as a lightmap for those
surfaces. That keeps the old snow look on the new, thicker geometry.

## Measurements

These come from headless Chromium with **SwiftShader (CPU)**. Frame times there are 5–12 s and say nothing
about a real GPU. Use draws, triangles and memory, and re-measure on a real machine with the in-page
**Measure** button.

| | Before | After |
|---|---|---|
| Draw calls (per camera) | 598–646 | 300–339 |
| Triangles rendered / frame (incl. shadow + AO passes) | 9.3–9.4 M | 8.2–8.3 M |
| Relative frame time (SwiftShader) | 1.0 | ~0.75 |
| Baked triangles (shop, pink, door, street, props) | – | 0.60 M |
| Geometry in GPU memory | 30.8 MB | 27.9 MB |
| Baked textures in GPU memory (RGBA8 + mips) | – | 86.6 MB |
| Download, this version only (binary) | 5.8 MB | ≈ 10 MB (2.4 MB WebP) |

**Desktop target:** 60 fps at 1080p on a mid-range discrete GPU. The after scene costs fewer draws than before,
so it should meet the target wherever the current real-time version does. Verify with **Measure**.

**What mobile would need:**
- KTX2/Basis textures (UASTC or ETC1S): about 86 MB becomes about 15–20 MB of GPU memory.
- 1024² atlases.
- No GTAO.
- Half-resolution bloom and DOF.
- Shadow maps off for baked meshes, which are already lit.
- About 60% fewer `rest` triangles.

## Pipeline notes and bugs found

- `bake_hq.py` read `matrix_world` before `view_layer.update()`, so every root reported (0,0,0). That
  pulled the whole village's roof snow, background houses and firs into the props atlas at a useless
  density, which baked as black flecks.
  - Fixed: `view_layer.update()` plus a bounding-box rule.
  - `rebake_props.py` and `unhide_live.py` repair an existing bake.
- A top-down projection for the street fails: the layered cobbles, grout bed and ground snow share texels, and
  the stone sides pick up base shadows. The street now uses per-face smart UVs with nothing deleted.
- gltf-transform's `prune()` drops UVs that no material uses. Use `prune({ keepAttributes: true })`.
- `tools/fill_gutters.py`: a push-pull fill of the empty atlas texels so mipmaps don't bleed black. It also
  repairs isolated dark flecks.

Rebuild:

```bash
blender -b --factory-startup --python scripts/bake_hq.py -- renders/hq/bake --size 2048 --samples 48
blender -b renders/hq/bake/hq_baked.blend --python scripts/fix_street_bake.py -- --samples 48 --smart --nodelete
bash tools/post_hq.sh
```
