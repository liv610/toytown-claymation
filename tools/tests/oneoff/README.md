# One-off diagnostics (kept so no work is lost)

Small scripts written while debugging on `experiment/textile-toytown`. They are not part of the regular checks and may
assume a dev server on :8765 (`cd web && python3 -m http.server 8765`) and the state of the code at the time.
Paths inside some of them point at a temporary scratch folder; pass your own output folder instead.

| Script | What it was for |
|---|---|
| `blackbox.js` | locating the black blocks in textile renders (NaN from the bump shader) |
| `nanrun.js` | an earlier NaN probe (superseded by `../nan_hunt.js` and `../post_black.js`) |
| `drag.js` | checking that mouse drag turns the camera in each look (the `.backdrop` overlay bug) |
| `feltposes.js` | trying camera poses for the felt street |
| `transition.js` | stepping the map → felt street crossfade |
| `shot.js`, `story_shots.js` | single screenshots / Marine story frames for review |
| `natsmoke.js`, `natsmoke2.js` | smoke tests of the national map prototype (`web/national`) |
| `paneltest.mjs` | felt panel triangulation experiments (`web/textile/src/construct.js` panelGeo) |
| `kinds.mjs` | lists material kinds in a .glb (copy into `web/` to run, it needs `@gltf-transform`) |
