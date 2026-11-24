# Smoother flow (24 November 2026)

Branch `experiment/smooth-flow`, which grows from `experiment/milestone2b` (the 2B checkpoint stays as it was). This is a prototype.

The owner's feedback on the 2B checkpoint:

- the zoom into the town felt jumpy;
- the train came over the town;
- the camera angles felt wrong in places;
- entering through the window was odd;
- it felt janky overall;
- the yard outside the back door looked 2D.

## What was wrong, measured

The descent and the story camera were sampled frame by frame, without rendering. Each problem was found that way, then checked in frames.

- **The descent rushed in the middle and crept at the end.**
  - Zoom was eased on a quintic curve, so most of the distance went by in the middle third.
  - The camera's pitch was then yanked by the roof-clearance rule. That rule treated the town as a circle and forced the camera up whenever it was more than a short distance from the target, even over the open street. The pitch went from 20° up to 59° and back down to 3°.
  - Peak turn rate was 112°/s, in the last second.
- **The trains drove over the town.**
  - Toy Town is the hub where all the felt rail lines meet. A train car is as long as the whole town at map scale, so every train passed through it.
  - The lines themselves crossed the town until the camera was close.
- **The story camera cut four times:**
  - beside the drop-off box (7.2 s);
  - after the donation (10.7 s);
  - when the Marine turned for the hall (22.3 s);
  - at the reveal (35.7 s).

  Each cut teleported the camera. The largest frame-to-frame change of velocity was about 1.07, against about 0.002 for a smooth move.
- **The window.** The collection already ended with the Marine walking in through the door and the door shutting. The sorting beat then took the camera back out along the hall's front and in through a window, crossing the same threshold twice by two routes.
- **The yard** behind the back door was a painted picture on a flat plane.

## What changed

- **The descent** (`main.js`, `makeTownFlight`):
  - One even move. Zoom and pan follow the optimal "constant apparent speed" path (van Wijk & Nuij), on a gentle ease in and out.
  - The turn happens while the camera is still high.
  - It then glides down the middle of the street, threading between a street lamp and the Christmas tree, and settles on the first shot.
  - The roof rule now knows the street: the camera may be low only in line with the street shot, where nothing stands.
  - Measured on the path: even apparent speed (peak 1.39 per second); peak turn rate 36°/s, previously 112°/s.
- **The rail lines** fade before the town is big enough for one to cross it.
- **The trains** slip away as they near Toy Town, like a train into a tunnel, and shrink away with the lines instead of vanishing at once (`felt_relief.js`).
- **No cuts in the story.** Every change of shot is a camera move. The view turns at an even rate (direction, not look-at point, is blended), and moves near people arc over or behind them (`scene_donation.js`, `scene_sorting.js`):
  - **The donation:** the camera follows the child down the street, stays out in the street until the parent has passed, then comes in behind the family and down on the hall side of the box, in time for the truck held over the slot.
  - **After the drop:** the camera lifts and draws back out into the street.
  - **The collection:** as the Marine turns with the carton, the camera turns with him and draws in behind him. The beat rests at the open door, looking past him into the warm room.
  - **The sorting room:** Next follows him in over the threshold and round to the table's front-right, where he is seen three-quarter beside the host as she comes to meet him. The camera then settles down into the reveal.
  - The door stays open until the camera is inside; the volunteer outside shuts it a few seconds later.
  - The window path and its glow are gone.
  - The room's timings moved 1.4 s earlier, so the beat is about 26.5 s.
- **Clearance, measured** (head positions are now a test hook):
  - adults' heads top out near 2.0 units outside and 2.3 inside;
  - the camera keeps at least 1.1 from anyone's head, except in two approved compositions:
    - beside the door volunteer's shoulder for the donation (0.6);
    - high above a seated volunteer in the hand-off view (0.9).
- **The yard** is modelled. It has:
  - a stone step and a trodden path with footprints;
  - a lantern on a post that lights when the door opens;
  - a picket fence with snow on its rails;
  - felt firs at different depths, so they move against each other through the doorway;
  - soft drifts.

  The town's own snow falls on it. All of it is procedural, so there are no new assets or licences.

## Tests

- `tools/tests/scene_m2a.js`:
  - A and S now require no cuts at all, a step under 0.05 and a change of velocity under 0.006 per frame (it was about 1 at a cut);
  - S checks that the camera follows the Marine in through the front door (across the doorway, below its top, within 3.2 s) and stays inside the hall afterwards;
  - S checks that there is no glow.
- New test hooks:
  - `__nat.travelPath(n)`: the descent's camera, sampled;
  - `__nat.sceneHeads(t)`: everyone's head position;
  - `__nat.azIn(v)`: the descent's street-approach offset, for review.
- `review_views.json`: the window views are replaced by `sort-door-out`, `sort-threshold` and `sort-door-in`.
- `scene_stills.js`: the collection still moved to 22.2 s, before the camera turns with the Marine.

## Not changed / still open

- **Real devices.** Frame rate on real devices is still unmeasured: SwiftShader only, no GPU here. A slow device will still show steps, though no longer jumps.
- **The front windows** seen from inside are still painted views of the street. They are mostly behind the camera now.
- **Reduced motion** keeps its still compositions with a dip between them.
