# Automated checks (Playwright, headless Chromium)

These scripts drive the prototypes in a headless browser. They take screenshots and read the prototypes' own event logs,
which is how every change in this project has been checked.

**Setup**
- Playwright must be installed. On the cloud machines it already is: `require('playwright')` works and Chromium is pre-installed.
- Start the local server first with `cd web && npm run dev`, which serves `web/` on http://localhost:8765.
- Override the address with `TT_URL=http://host:port`.

**SwiftShader (no GPU)**
- A machine with no GPU renders WebGL on the CPU (SwiftShader), at about 5 fps.
- The scripts pass `?q=low&capture=1`, pause rendering before each screenshot, and use generous timeouts.
- Long runs (the gift walkthrough is about 15 minutes) should be started in the background, e.g. `setsid nohup node … > log 2>&1 &`,
  then polled.
- Frame times measured this way are not real-device numbers. Only draw calls, triangles and memory are meaningful.

| Script | What it checks | Usage |
|---|---|---|
| `journey_dropoff_story.js` | Drop-off journey: landing → enter Toy Town → toy shop card → ZIP search → thanks → the Marine's story; writes `events.txt` | `node journey_dropoff_story.js OUTDIR "q=low&capture=1" 1100 620` |
| `journey_gift.js` | Send-a-toy-online: shop interior → toys → gift steps → departure → line map → back | `node journey_gift.js OUTDIR` |
| `journey_gift_direct.js` | Direct gift path with no 3D, desktop + phone (fast, about 1 minute) | `node journey_gift_direct.js OUTDIR` |
| `journey_devices.js` | `#direct` and ZIP error, simple view on a phone, phone 3D, flat-map hand-off | `node journey_devices.js OUTDIR` |
| `journey_stills.js` | Renders the fallback/backdrop stills into `web/journey/assets/stills/` | `node journey_stills.js ../../web/journey/assets/stills` |
| `journey_toys_departure.js` | Toy thumbnails (stills) + departure frames for review (`NOTOYS=1` skips toys) | `node journey_toys_departure.js STILLSDIR REVIEWDIR` |
| `artifact_smoke.js` | A packaged artifact folder loads with no errors (serve it on :8767) | `node artifact_smoke.js` |
| `storybook_frames.js` | Pop-up transition frames at chosen times | `node storybook_frames.js OUTDIR "0,2.6,4.6,8.2"` |
| `hq_capture.js` / `hq_measure.js` | Visual-quality before/after captures and measurements (`experiment/visual-quality` branch) | see the script headers |
| `region_capture.js` / `region_measure.js` / `region_flight_audit.js` | Map-scale diorama captures, measurements, camera-clearance audit | see the script headers |
| `blender_reference_render.py` | Cycles reference render of the baked HQ scene from the Hero camera | `blender -b renders/hq/bake/hq_baked.blend --python tools/tests/blender_reference_render.py -- OUT.png` |
