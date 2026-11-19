# Phase 1 · Milestone 2A: the red truck, alive

Branch `experiment/milestone2a`, from `experiment/phase1-build` at `cc8184f`, which stays as the Milestone 1 state.

The first finished story moment: the donation and the collection of one small red toy truck, about 29 seconds of live
animation in two visitor-paced beats in the Toy Town street. It plays in Chapter 2 ("How does it work?"), as its first
two beats.

## The sequence

**Beat 1 · The donation (0–13.5 s)**

1. The establishing shot is low at the end of the street: snow, lamps, the hall's lit windows and the tree. A neighbour shovels at the far end, and the Marine tidies the wagon of toys by the hall.
2. A parent and child walk up the sidewalk (the camera tracks them). The child carries the red truck steadily in both hands, in front of the chest, and watches it.
3. At the toy drop-off box, the child lifts the truck over the box, holds it a moment and lowers it into the slot. The camera is close, so the truck is recognisable.
4. The child lets go and the truck drops onto the toys inside the box. The box glows and gives off a few sparks.
5. The child looks up at the parent, who nods. The volunteer by the hall waves and nods.
6. The family steps aside, beside the box, and turns to watch. Then the beat waits, while the town keeps moving.

**Beat 2 · The collection (13.5–29.5 s)**

1. The Marine looks up from the wagon and walks to the box.
2. The Marine bends, takes the lid by its front lip and lifts it. The lid falls open against its stay and settles.
3. The Marine reaches into the box, grips the carton of toys, takes its weight for a beat and lifts it straight up, clear of the walls. The red truck is on top, where it fell in Beat 1.
4. The Marine settles the carton against the chest and carries it to the community hall. The hands stay on the carton's sides.
5. The volunteer has gone to the door and pulls it open, stepping back along its swing. Warm light spills onto the snow.
6. The Marine carries the toys through the lit doorway.
7. The volunteer pushes the door shut along the same arc (a small settle at the frame), steps aside and turns to the street.
8. The camera holds on the hall's door and lit window: the toys are inside, which sets up sorting. Then the beat waits.

**The town while it waits:** snow falling, chimney smoke from 9 chimneys (soft cotton puffs), lamps, lit windows, the tree's lights, the neighbour shovelling, passers-by, and characters idling with small head turns.

## How it was built

**Reused**

- The street, the cast (Marine, parent, child, volunteer, neighbours) and their clips (walk, carry, idle, give, wave, look).
- The Chapter 1 paths and timing style; the truck, carton and wagon models.
- The box's glow and sparks; the snow, lamps and windows.
- The one-world flights, the story controller, the finder, the stills fallback and the tests.

**New**

- `scene_donation.js`, the scene. Every pose is a pure function of story time, so play, wait, pause and replay are exact.
- **A drop-off box rebuilt so it can open:** walls, a dark inside, a hinged lid with a slot, and the carton of toys on its floor. It replaces the solid red block in the street model.
- **A hinged hall door** with a warm doorway behind it, a pool of light on the snow and a light in the doorway. Whoever walks in is cut at the doorway, so they walk into the light rather than through a wall.
- **Gestures on the bones:**
  - a two-bone arm reach (hands on the truck, the lid, the carton, the door handle, the shovel);
  - a waist bend;
  - head turns with eye lines: the child watches the truck, then looks up at the parent; the parent watches the child; the volunteer watches the gift; everyone watches the Marine.
- **Physical continuity of the truck.** It is carried, lowered through the slot and dropped onto the toys. From then on it moves only as part of the carton.
- **Ground following.** Steps such as the hall's doorstep are climbed rather than popped onto, and walkers follow the street's average surface instead of hopping from cobble to cobble.
- **Town life:** chimney smoke found from the chimneys' own bricks, the shovelling neighbour (with a shovel and tossed snow), and passers-by.
- **The camera.** One directed path per screen shape: desktop compositions and separate phone compositions, not a crop.
  - It glides within shots, with two deliberate cuts where a move would have swept across the set.
  - It follows the smooth paths even though the puppets move on twos.
- **Story control.** A beat plays a stretch of the scene, then waits:
  - **Next mid-action** fast-forwards the rest if 4 s or less is left (the action resolves); otherwise it dips through the night colour.
  - **Back** replays the previous beat from its start.
  - **The finder** freezes the story clock at that moment while the town keeps moving, and resumes on close.
  - **Skip and Exit** work as before.
  - **Reduced motion** keeps the animation and replaces camera moves with steady framings and gentle dips.
- **No 3D:** new stills rendered from the scene itself (`donation.jpg`, `collection.jpg`) and full scene descriptions.

**A fix that mattered.** three.js's animation mixer only rewrites a bone when the clip's value changes. Puppets moving on
twos therefore leaked the last frame's reaches and bends into the next frame, which made the carton jitter. Each
character now snapshots the clip pose after every update and restores it before the next.

## Refinement pass (after the owner's review, 18–19 November)

The owner's screenshots of the first cut showed problems the tests could not see. Each fix below was judged on rendered
frames (desktop and phone), not only on the test log.

**Grounding**
- **The floating Marine** stood beside the wagon on a spot inside the bench's end. The town's ground lookup takes the first surface below it, so it put him on the snow on top of the bench. The scene now has its own ground lookup that only sees the street, sidewalk, curb, drifts and steps. The Marine waits clear of the bench.
- **The family** walked along the drifts and the curb stones. They now walk the clear sidewalk: the child leads, eager, and the parent catches up at the box.
- **Contact shadows.** At night the moon's shadow is faint and the lamps cast none. Every puppet now has a soft shadow under the body and one under each foot, darkest when the foot is planted. They are multiplied into the ground's light, because the snow is brighter than white before tone mapping and a dark overlay barely showed.

**Physical interactions**
- **The box.** The street model's cream top and dark slot were still drawn over the box built for this scene, so the child's arms, the truck and the carton went through a solid top. They are cut out of the street model. The box has a cream lid that the Marine lifts by its lip; it tips back and rests against the sign.
- **The door.** The wreath and the handle are part of the town's merged holly and brass, so they stayed hanging in the doorway when the door opened. They are cut out and hung on the door.

**Lighting**
- **The doorway** was a flat card that burned out to white. A real hole is now cut through the hall's wall and its door surround. Behind it is a small entrance room: plaster over a wooden wainscot, a plank floor, a table with cartons of toys waiting to be sorted, paper bunting, and a hanging lamp, the room's only light. The Marine walks in silhouetted against it, and the room sets up the sorting scene.
- **Lit windows** burned out to flat white rectangles. Each window now shows a lamp-lit room behind curtains: golden in the middle and low, darker towards the frame, at a lower intensity.

**Camera**
- **The collection** is now filmed from the Marine's left and a little in front, wider and higher: his hands, the lid, the carton rising out of the box with the red truck on top, and the family watching beyond him.
- **The carry** starts on a cut. The glide passed right by the Marine's face.

**Materials**
- **The cobbles** are pressed lower and shaded as rounded pebbles rather than facets, in a softer colour, with snow on their tops.
- **The puppets** get a gentle hand-pressed unevenness (silhouette and shading), and a faint clay "boil" that changes on twos.

**Second review (19 November):**
- **Hall sign:** the "Community Hall" board ran across both upper windows. It is now narrowed to the wall between the windows' inner shutters, with the lettering scaled to fit.
- **Drop-off box:** the opened lid went through the drop-off sign behind the box. The sign (post, board and lettering) now stands 0.185 further back, on a post of its own reaching the ground. The lid stops on its hinge just past upright, a finger's width short of it.

## Visual polish pass 1 (19 November)

Reviewed with the new QUICK / INTERACTIVE tools: 18 moments from the visitor's camera at both sizes, plus close
inspection views (feet, hands, the box, the doorway). Each fix was judged on before-and-after frames. Pairs, review sheets
and short clips are in `docs/milestone2a/polish/`.

**Audit, most distracting first:**
1. **Snow:** the drifts were hard-faceted shards, the brightest thing in most close shots, reading as broken paper or glass.
2. **The drop-off box:** an untextured red slab that dominated the donation close-up (half the phone frame).
3. **The glow when the truck goes in:** a point light above the lid burned its cream top to white.
4. **The puppets:** smooth painted plastic next to the felt town.
5. **The donation close-up:** the box filled the lower half of the frame, the parent was cut in half and the sign's post stood in the corner.
6. **The sparks:** they read as large white confetti.
7. **Grounding:** checked close up and sound since the first refinement. Feet rest on the snow with contact shadows, at the wagon, at the box and on the doorstep. No change needed.

**Changes (all in `scene_donation.js`):**
- **Snow:** the snow and ground-snow meshes are welded and smooth-shaded (the street model flat-shades them), so the drifts are soft mounds. Steep sides take a cool, slightly deeper tone.
- **Box:** painted planks (five boards per face, dark seams, brush strokes, a light bump), cream corner posts and a plinth. It reads as a crate someone built and painted.
- **Glow:** it now comes from inside the box. The light sits under the lid, so it warms the child's face and the snow, and the slot shines softly amber; it is no longer a light above the lid.
- **Puppets:** a pressed-wool surface on top of the felt look. The wool varies in colour and has fine fibre and a relief the light can catch, gentler on skin, and it fades below pixel size. The felt look's own relief is sized for walls and was invisible at puppet scale.
- **The donation close-up:** it is now filmed from beside the box on the hall side. The truck is held up over the slot, the child's face is seen as it goes in, the parent watches in full, and the lamp-lit street is behind.
  - The phone composition looks down from higher, so the volunteer's wave doesn't cross the lens and the slot stays in the narrow frame.
- **Sparks:** fewer, smaller, gold.

**Checks:**
- `scene_m2a` sections A and C (continuity, collisions, smooth camera within shots, steady reduced-motion compositions): 15 ok.
- The fallback stills `donation.jpg` and `collection.jpg` are regenerated (the donation shot changed).
- No full videos: three short clips (`polish/clips/`).

**Trade-off:** on phones the truck was framed against the night sky. It now sits against the tree, red on green: still readable, but the old silhouette was crisper. In exchange the shot gains the child's face and the watching parent.

**Still to improve:**
- the cobbles in the opening wide shots (large pale polygons);
- the carton (a plain tan block);
- the volunteer's hat edging into the phone frame just before the cut at 10.7 s;
- faces (no blinks or expressions);
- sound;
- the story card and the chapter bar still sit over the scene.

**Not yet done:** the cinematic interface (the story card and the chapter bar still sit over the scene), faces and blinks, sound. The interface is the planned next step.

## Tests

Headless Chromium with SwiftShader (no GPU). These check behaviour, not real-device speed.

| Test | Result |
| --- | --- |
| `scene_m2a.js` (new): continuity, collisions, camera, controls, reduced motion, no 3D | 33 ok, 0 fail (rerun after the refinement pass) |
| `toytown_spike.js` (Milestone 1 spike) | 25 ok, 0 fail |
| `visitor_flow.js` | 140 ok, 0 fail |
| `national_shell.js` | 42 ok, 0 fail |
| `finder_e2e.js` · `finder_map.js` · `finder_states.js` · `finder_unit.mjs` | 75 · 39 · 47 ok, 0 fail · all passed |

What `scene_m2a.js` measures, sampled every 1/30 s of story time:
- **The truck never jumps:** its move against whoever carries it is under 0.1 a step. A walking carrier moves about 0.1 a step on twos, so a teleport would stand out. Its fall through the slot is a short drop.
- **Continuity:** the truck is in the child's hands until the slot, then in the box, then on the carton, and visible until it goes into the hall.
- **No intersections:** nobody walks into anybody, into the box, into the hall's wall (only the Marine goes in, through the doorway) or through the open door.
- **The camera glides:** the largest move within a shot is under 0.1 town units per 1/30 s on desktop and on phones (cuts only where the film cuts).
- **Controls during the animation:**
  - the finder freezes the story clock and resumes from the same moment;
  - Next near the end fast-forwards the rest of the action, then plays on;
  - the beat waits at its end;
  - Back replays the beat from its start;
  - Back during an animation goes to the previous beat;
  - Exit rises to the map;
  - Skip goes to the finale.
- **Reduced motion:** the characters still animate; the camera holds still within each shot.
- **No 3D (`?map=off`):** the donation shows its still and a description that names the red toy truck.

Two fixes came out of the regression run:
- The 3D chunk no longer poses the town's people on every frame while the country map is shown. It was wasted work, and under SwiftShader it starved the page.
- The Milestone 1 spike test now checks the still fallback on Chapter 3, because Chapter 2 now plays live.

After the refinement pass every suite above was run again, with the same counts. One `finder_map` check ("the website link
opens mid-flight") failed twice, and the reason was the test, not the page. The campaign flight lasts 1.4 s. Under
SwiftShader, Playwright's wait for a stable element took about 1.5 s on its own, so the flight had landed before the check
read the camera. The link always opened the right page. The test now clicks without that wait and notes the camera mode
at the moment of the click: 39 ok.

## Review material

- **Screenshots** at ten key moments, desktop (1280×720) and phone (390×844): `docs/milestone2a/shots/`, with contact sheets `contact_desktop.jpg` and `contact_phone.jpg`.
- **Videos** of the whole sequence, rendered frame by frame at 24 fps (so they show the intended timing, not SwiftShader's speed): `docs/milestone2a/m2a_desktop.mp4`, `m2a_phone.mp4`.
- **The interactive preview** is the primary review artifact: [Railroad of Hope · Milestone 2A](https://claude.ai/artifact/BnoagS2GRKUSGLYmYvgEkf) (prototype; Explore Toy Town, then Chapter 2).

## Performance

- **Measurement caveat:** nothing here was measured on a real device. The cloud machine has no GPU (SwiftShader), and its frame rates mean nothing for phones or laptops.
- **Work per frame while the scene plays:**
  - six skinned characters, each with a clip mixer, plus arm IK, bends and head turns (a few dozen bone updates);
  - one instanced mesh for the chimney smoke (72 puffs; 45 on the low tier);
  - one extra point light in the doorway;
  - a clipping plane on the materials of whoever and whatever goes through the doorway.
  
  The point light is the costliest addition, because every lit material pays for it. It can be faded out or made a fake (an emissive card) if phones struggle.
- **Puppets pose on twos (12 times a second).** The camera still moves every frame, so the motion is cheaper to compute but still smooth to look at.
- **On the country map the scene is not evaluated at all** (it was, before this milestone's regression run).
- **Load:** no new downloads. The box, door, light pool and smoke are built in code; the new scene module adds about 25 KB to the 3D chunk.
- **Worth measuring on real devices first:** a mid-range Android phone and an older iPhone. Watch the doorway light, the bloom and the clipping.

## Creative assessment: what still needs refinement

- **Faces:**
  - the characters cannot blink or change expression;
  - eye lines are head turns only;
  - the child's look up at the parent is the emotional beat, and it would gain the most from a blink and a small smile change.
- **The carry:** the Marine carries the carton at waist height. Against the chest would read as more careful and more "precious cargo".
- **The doorway glow** washes the Marine out as he enters. It reads as "into the light", but it loses his silhouette; a dimmer pool and a rim instead of a fill would keep him.
- **Hands and arms:**
  - arm IK is clean but a little mechanical (straight reaches, no overlap or follow-through);
  - the volunteer's wave and the walks are reused clips;
  - a hand-keyed pass on the three key gestures (the release of the truck, the lid lift, the door pull) would add the most stop-motion character.
- **The truck in wide shots** is small. It reads only in the close shots; a slightly larger truck (toy scale allows it) would carry the thread better.
- **Loops show if you wait:** the neighbour's 3.4 s shovelling loop and the passers-by.
- **Stop-motion texture:** the puppets move on twos, but the materials are clean. A subtle "boil" (a tiny per-frame jitter of the clay texture) would complete the look.
- **Sound:** there is none (footsteps in snow, the lid, the door would help a great deal).
- **Fidelity:** no claim is made that the look matches the owner's reference images; there was no side-by-side.

## Effort

- **AI session time:** about 6–7 hours (18 November 2026, 13:22 UTC to the commit). About half of it was spent waiting for SwiftShader renders and tests.
- **Developer hours:** the plan estimated 24–30 developer hours. A developer would likely need about 34–40, because of extras the plan didn't foresee:
  - the box and door rebuilds;
  - the mixer bug;
  - the ground-following and carry fixes;
  - the per-carrier continuity test;
  - the stills and video tools.
- **Refinement pass:** about 10 more hours of AI session time (18–19 November), much of it on SwiftShader renders, and an
  estimated 12–16 developer hours:
  - the ground lookup and contact shadows;
  - the opening lid and the door cut into the wall;
  - the entrance room;
  - the window texture;
  - the camera changes;
  - the material pass.

## Next milestone: recommendation

**Update after the owner's review:** the owner asked to finish refining this sequence before expanding the world, so 2B
waits. The next step on this sequence is the cinematic interface (the story card and chapter bar, which still sit over
the scene), then faces and sound. The original recommendation follows.

**Recommended: the sorting room (Milestone 2B), with interface fixes folded in only where the live scene needs them.**
- It continues the red truck's thread directly: the carton goes in the door, and the next shot is the sorting room.
- Everything built here carries over:
  - the time-driven scene, IK and carry, and continuity tests;
  - the story clock with its finder pause and Next/Back rules;
  - the camera system.

  A sorting interior is the only big new asset.
- The cinematic interface redesign can wait. Today's story controls work over the live scene, and a redesign is easier to judge once two live scenes exist.
- The railroad is the largest asset build (trains, track, stations, the national map connection). It also depends on sorting, which is where the toys leave from, so it should come third.
- **Rough size:** the sorting room at the same quality, about 30–40 developer hours, depending on whether the felt toy-shop interior can be reused as the room.

## How to run

```
cd web && npm run build:national && python3 -m http.server 8765        # http://localhost:8765/national/
URL=http://localhost:8765/national/index.html node tools/tests/scene_m2a.js OUTDIR
URL=… TIMES=8.7,22.6 SIZE=desktop,phone node tools/tests/scene_frames.js OUTDIR
URL=… SIZE=desktop FPS=24 node tools/tests/scene_video.js OUTDIR       # a video, frame by frame, then ffmpeg
URL=… node tools/tests/scene_stills.js web/national/assets/story        # the fallback stills
```

The video uses ffmpeg (LGPL/GPL), installed on the machine; it is not part of the app.
