# Review workflow: QUICK, INTERACTIVE, FULL

Agreed with the owner on 19 November 2026. Small visual changes should be reviewable in minutes, not hours. Full
validation stays, but it runs at milestone checkpoints.

**Why.** Before this, every small fix went through the same steps:
- the whole regression suite, run sequentially;
- both fallback stills;
- a 20-frame screenshot library;
- full desktop and phone videos.

The videos alone took about 1.5 hours per size, because the cloud machine has no GPU (SwiftShader). Narrowing one sign
cost an afternoon.

## The three modes

| Mode | Use it for | Do | Don't |
| --- | --- | --- | --- |
| **QUICK** (the default) | Object positions, signage, materials, lighting, small geometry, small framing changes | Rebuild (about 2 s). Run `tools/quick_review.sh <views>`: 2–4 targeted frames. Add a targeted check if the change can affect movement or collisions (see the table below). Show the frames. | Regenerate videos, fallback stills or the whole screenshot library. |
| **INTERACTIVE** | Choreography, object interactions, camera moves, timing, transitions | Run the relevant scene checks. Update the preview, give a direct `?dev=1` link to the moment, and add a few key frames. Render a short clip only if the motion can't be judged interactively. | Render full videos. |
| **FULL** | A finished story sequence, an architecture change, a milestone review, or an explicit request for videos | `tools/run_regression.sh`. Regenerate the fallback stills (`scene_stills.js`), the review shots (`scene_frames.js`) and the videos (`FULL=1 scene_video.js`). | — |

**Publishing never waits on a video.** Package and publish the preview as soon as the QUICK or INTERACTIVE checks pass.
The repo's videos are then marked out of date until the next FULL review.

## QUICK: targeted screenshots

```bash
tools/quick_review.sh lid
```

```bash
SIZE=desktop,phone tools/quick_review.sh hall-front lid-story
```

```bash
VIEW='sign-close|10|0.5,3.4,2.2|0,3.5,0' tools/quick_review.sh
```

- **The first** renders a group (`lid`, `hall`, `door`) or named views. The output goes to `dist/review/` (git-ignored):
  one JPEG per view, a labelled `sheet_<size>.jpg`, and a dev-panel link for each view.
- **The second** renders both compositions; `-story` views use the visitor's own camera.
- **The third** renders an ad hoc view: `name|time or moment|camera position|look-at point`, in town units.

Named views live in `web/national/src/review_views.json`, which the dev panel shares. A view's time is either seconds or
a mark on the scene's timeline (`lid0`, `lidGo`, `grip`, `door0`, `door1`, `inside`, `shut0` …), optionally with an
offset such as `lidGo+0.8`. The views therefore stay on the right moment when the timing changes. Add a view when a new
object comes under review.

**Measured here:** five views (the lid and hall groups) take about 60 s, including the page load. Most of that is
SwiftShader starting the 3D page; each extra view adds a few seconds. With a GPU it's near-instant.

## INTERACTIVE: the development review panel

Add `?dev=1` to the national page, locally (`http://localhost:8765/national/index.html?dev=1`) or on the published
preview.

The panel:
- doesn't show without `?dev=1`;
- is a separate chunk that visitors never download;
- drives the visitor's own story clock and scene, so no second animation system can drift from what visitors see.

**Controls:**
- **Replay donation / Replay collection:** play a beat from its first frame to its last.
- **Play / Pause:** play or pause the timeline (Space).
- **Step:** one frame (← / →, 1/24 s) or one second (`[` / `]`).
- **Timeline:** the scrubber, with the time and the current beat.
- **Moment:** jump to any timeline mark.
- **Camera:** the visitor's camera, or a named inspection view (lid side, doorway, hall front …).
- **Composition:** this window, desktop 16:9, or phone 390×844 (framed, using the phone's own shot composition).
- **Speed:** 1×, 0.5×, 0.25×, 0.1×.
- **Open this beat in the story:** the same moment with the visitor's story card and controls.
- **Link:** the address always holds a link back to the paused moment (with its camera and composition); a Copy button is included.

**Links** (parameters combine):

| Link | Opens |
| --- | --- |
| `?dev=1&at=lid0` | paused as the Marine starts lifting the lid |
| `?dev=1&view=lid-open-side` | the open lid edge-on, at that view's moment |
| `?dev=1&at=door0&view=doorway&rate=0.25&play=1` | the hall door opening, in slow motion |
| `?dev=1&beat=collection` | the collection beat, playing from its start |
| `?dev=1&frame=phone&at=lid1` | the phone composition at the top of the lid's lift |
| `?dev=1&story=how/pickup` | the visitor's story at chapter "how", beat "pickup" |

## Short clips, when motion needs a video

```bash
T0=lid0-0.3 T1=lidGo+1.2 FPS=12 DPR=1 SIZE=desktop node tools/tests/scene_video.js dist/clip
```

This writes `dist/clip/desktop_<t0>_<t1>.mp4`. Measured here: 2.35 s of story at 12 fps took 3 minutes. `T0` and `T1` take seconds or moments.

`scene_video.js` refuses a full-length render unless `FULL=1` is set:

```bash
FULL=1 SIZE=desktop node tools/tests/scene_video.js dist/video
```

Then copy `dist/video/desktop.mp4` to `docs/milestone2a/m2a_desktop.mp4` (likewise for phone).

## Which checks to run for which change

| Change | Targeted check (QUICK / INTERACTIVE) |
| --- | --- |
| A static prop, sign, material, light or window in `scene_donation.js` | Frames of the affected views. Nothing else unless the object is near a path. |
| Anything people or carried objects can touch (box, lid, door, paths, room) | `ONLY=A node tools/tests/scene_m2a.js`: continuity and collisions, with no story playback |
| Camera segments and framing | `ONLY=A,C`: smooth moves between cuts, steady reduced-motion compositions. Plus `-story` views at both sizes. |
| The story clock or controls (`main.js` scene section, `story.js`, `story_data.js`) | `ONLY=B` (or the whole `scene_m2a`), `visitor_flow.js`, `toytown_spike.js` |
| The finder, page shell, campaign data | `finder_e2e`, `finder_map`, `finder_states`, `finder_unit`, `national_shell` |
| The dev panel | `dev_review.js` |
| Before a milestone review | `tools/run_regression.sh`: all of the above, one suite at a time |

Measured here (SwiftShader):
- `ONLY=A` scene check: about 1.6 minutes.
- `dev_review.js`: about 7.5 minutes.
- QUICK frames: about a minute.

`scene_m2a.js` sections:
- **A:** the scene sampled every 1/30 s, without rendering.
- **B:** the story controls in the page.
- **C:** reduced motion.
- **D:** no 3D.

## What changed in the tooling, and what was repeated work

| Found | Change |
| --- | --- |
| Full videos rendered after every fix (≈ 3 h per round) | Videos are FULL only. `scene_video.js` refuses without `FULL=1`, and `T0`/`T1` render a short clip by moment. |
| Shots taken only from the visitor's camera at ten fixed times, both sizes (20 frames, several minutes), whatever changed | `review_shots.js` and `quick_review.sh`: only the named views, one page load per size, inspection cameras on the object itself |
| The whole `scene_m2a` (four sections, several page loads) for any scene edit | `ONLY=` runs the relevant sections |
| No way to look at one moment except replaying the story | The `?dev=1` panel and its links |
| Fallback stills regenerated on every change | Only when the change shows in the stills' frames (donation at 8.75 s, collection at 22.6 s), and at FULL |
| Regression steps run from ad hoc scratch scripts | `tools/run_regression.sh` for FULL |
| Build | Already about 2 s (esbuild); not a bottleneck. Packaging the artifact (`build_national.sh`) is only for publishing. |

**Known SwiftShader flake:** `national_shell.js` gives the action buttons 5 s to be clickable while the 3D map draws,
which matches the rule that actions are reachable without waiting for the 3D world. On this GPU-less machine that limit
was once missed while the map was busy (19 November); the rerun passed, 42 ok. Rerun it before treating a timeout there
as a regression; it's left strict on purpose.

**Not changed, on purpose:**
- **No test was removed or weakened.** Every check still runs at FULL.
- **The suites stay sequential.** One SwiftShader page already uses all 4 cores here. Two suites at once would save
  little and would make the timing-sensitive checks flaky.
- **Phone review videos stay at 2× resolution.** Only working clips use `DPR=1`.
