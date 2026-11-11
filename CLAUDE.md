# Toy Town / Railroad of Hope — instructions for Claude

Read `docs/PROJECT_STATE.md` first. It has:
- what exists, branch by branch, with the published links;
- the decisions made so far and why;
- known issues;
- the agreed next step.

## The owner's standing rules (do not break these)

1. **This repo is standalone.** It is NOT connected to the owner's existing project repository. Never access, copy from or
   modify the owner's national folk-art map code. If the national map is needed, use a placeholder or an export the
   owner provides.
2. **Free and open tools only.**
   - No paid APIs, subscriptions or commercial asset requirements.
   - Note the licence of anything new you add (see the licence table in PROJECT_STATE).
3. **This is a concept for a Toys for Tots-related project, not a live site.**
   - Label prototypes as prototypes.
   - Every action and data point stays a placeholder (drop-offs, campaigns, toys, prices, checkout) until the owner says the
     organisation has approved connecting real services.
   - Do not integrate real campaign data, payments or analytics services.
   - Do not present a page as the organisation's own site.
4. **Dignity and privacy.**
   - Never show a specific child or family receiving a toy, a child's name or an address.
   - Deliveries are shown symbolically (a lit window, a region lighting up).
   - The train and the recurring red toy are storytelling metaphors for the nationwide network, not literal logistics.
   - Story copy that describes how Toys for Tots works is a draft for the organisation to review.
5. **Actions before spectacle.**
   - The main actions (give toys, donate, request toys, find local campaign) must always be reachable without entering the
     3D world and without waiting for an animation.
   - Families requesting help are never routed through the world.
   - Everything must work on phones and have an accessible non-3D fallback.
6. **Preserve existing work.**
   - New ideas go on a new `experiment/...` branch.
   - Don't redesign or modify earlier scenes, the Marine, or earlier journeys unless asked.
7. **Be honest about quality and measurements.**
   - Don't claim the look matches the owner's reference images unless a side-by-side supports it.
   - The cloud machines have no GPU (SwiftShader). Frame rates measured there are not real-device numbers; say so.

## How to work here

- **Verify, then commit and push.** Check visual changes with the scripts in `tools/tests/` (headless Chromium screenshots +
  the prototypes' event logs) before reporting, then commit and **push** (`origin` = github.com/liv610/toytown-claymation).
  Commit messages explain the why.
- **Running and packaging:**
  - Web prototypes: `cd web && npm install && npm run dev` → http://localhost:8765/journey/, /storybook/ or /national/ (build bundles first: `npm run build:national`).
  - `npm run build` builds the storybook bundle (not committed).
  - Artifacts are packaged with `tools/build_journey.sh` / `tools/build_storybook.sh`. Artifacts can't serve `.glb`, so models
    ship base64-encoded as `.txt` and the pages decode them (`window.TT_B64`).
- **Blender:**
  - Install: `tools/install_blender.sh` (Blender 4.5 LTS); scenes are built procedurally by `scripts/build_scene.py`
    (`scripts/tt/*`).
  - Cycles renders and bakes are CPU-only here and take minutes to hours. Run them detached (`setsid nohup … &`) and poll;
    the container is reclaimed when idle.
  - Don't run two heavy Blender jobs at once (memory).
- **Large intermediates** (bakes, raw exports, render caches) are git-ignored by design; the scripts regenerate them.
