# Living Toy Town: assessment and recommendation (planning only)

Repository copy of the doc https://claude.ai/artifact/Ryi9vqPYzXaDfEaS5E4xof (which also holds the drawings). Written after
Milestone 1, when the owner asked for a living, animated miniature world rather than camera moves between static scenes.
No application code was changed.

## Summary

- **The experience is incomplete, not built on the wrong approach.**
  - The app already holds a fully animated 15-second scene (`chapter1.js`): the family walks, the child places the red truck in the box, the Marine carries a carton into the hall, and the camera follows.
  - The Milestone 1 spike froze three moments of it to test the flights.
  - Chapters 2–4 show stills only because they are not built.
- **The architecture supports animated beats.** Everything is a function of story time, so a beat can play a stretch of time, then wait. Back, Next, Skip and the finder land on exact frames.
- **What is missing is content and craft:** choreography, gestures (lifting, sorting), doors, smoke, camera work, and a crafted railroad.
- **Recommendation:** Milestone 2A, the red truck sequence at final quality (24–30 developer hours), judged on the owner's phone before choosing between the two options.

## Current state

| What | How it is shown |
| --- | --- |
| Map, descent, rise, finale | Live 3D, moving |
| Chapter 1 beats (Milestone 1) | Live street, characters frozen at moments of the Chapter 1 animation |
| Chapters 2–4 | Stills and "Scene in development" cards |
| Old Chapter 1 | Live, fully animated; `?town=maple&maplehollow=1`, then Visit Maple Hollow |

- **Characters:** the Marine (walk, carry-walk, idle, carry-idle), and the parent, child, volunteer and three neighbours on the same rig (waves, nods, the hand-over).
- **Journey extras:** the journey's Marine lifts a toy with arm reaches; a textile puppet can dress any Marine.
- **Already moving:**
  - the red truck (handed over, into the box) and the carton (carried);
  - the box's glow and sparks;
  - snow, lit windows, lamps;
  - the felt trains on the map, clouds, the star.
- **Not moving yet:** doors, chimney smoke, background townsfolk loops, the wagon.

## Approach

- **One story clock per scene** drives the characters, objects and camera. The environment runs on its own clock and never stops.
- **A beat plays once, then waits** with idle life.
- **Reduced motion:** characters still animate; the camera holds framings and crossfades instead of moving.
- **Next:** jump to the beat's end state and start the next beat.
- **Back:** replay the previous beat from its start.
- **Finder, Read as text, a hidden tab:** pause the story clock while the environment keeps going.
- **Performance budget:**
  - about 8 animated characters on screen;
  - key-light shadows only;
  - particle smoke and snow;
  - phones on the medium tier;
  - interiors built in the background.

## The proof-of-concept storyboard (about 24 s)

**Beat 1, the donation (about 13 s)**

| Time | What happens |
| --- | --- |
| 0–3 s | Establishing push-in: a neighbour shovels; smoke, lamps |
| 3–8 s | Tracking the family up the sidewalk; the child carries the red truck |
| 8–10.5 s | Close: the truck goes in the box; the box glows |
| 10.5–13 s | Ease back; the volunteer waves |

Then it waits, with idle life.

**Beat 2, the collection (about 11 s)**

| Time | What happens |
| --- | --- |
| 0–2 s | The Marine walks to the box |
| 2–5 s | Lifts the carton; the truck is on top |
| 5–9 s | Carries it along the sidewalk; the volunteer opens the hall door; light spills |
| 9–11 s | The door closes; the camera holds on the glowing window |

Then it waits. Captions come from the existing draft copy.

## Railroad direction (not started)

- **The look:**
  - a felt roadbed in the route colour;
  - two couched cord rails;
  - stitched felt ties, slightly irregular;
  - bridges at lakes and rivers, tunnel portals at ranges, a crossing, small stations, a Toy Town station at the hub;
  - felt trains with boilers, carriages, glowing windows and batting smoke.
- **Performance:** the detail fades in by distance and the ties are instanced. Estimated 10,000–15,000 ties, about 150,000 triangles, drawn only up close.
- **Effort:** 25–42 developer hours in total, or a 6–8 hour look test first.

## Estimates (developer hours, remaining work)

| | Hours |
| --- | --- |
| Option A, essential animated | about 100–130 (itemised: 99–129) |
| Option B, more cinematic | about 160–220 (itemised: 157–220) |
| Original target | 60–80, which the owner says is not a hard ceiling |

- **Option A includes:**
  - the animated beat engine (6–8);
  - donation, collection and town life (17–20);
  - a simplified sorting room (10–14);
  - distribution with the train and lit homes (3–5);
  - Chapter 1 opening (3–5), Chapter 3 stations (5–7), Chapter 4 (3–5);
  - finale (4–6);
  - railroad rails, ties and trains (12–18);
  - the cinematic interface (8–10) and landing ticket (10–11);
  - accessibility and phone tuning (8–9);
  - testing (10–11).
- **Option B adds:**
  - railroad set pieces (13–23);
  - a puppet cast and the toy shop front (10–16);
  - a fuller sorting room (8–12);
  - Chapter 3 vignettes (8–12);
  - camera moves and more town life (8–12);
  - a soundscape from openly licensed audio (5–8);
  - extra testing (6–8).
- **Session time:** for animation craft, AI session time is expected at roughly 40–60% of developer hours. Both will be reported per milestone.

## Recommended next milestone: 2A, the red truck, alive (24–30 developer hours)

- **Deliverables:**
  - the animated beat engine;
  - Beat 1, re-timed and re-shot from the existing Chapter 1 animation;
  - Beat 2, new: the Marine's lift and carry, the hall door, the light spill;
  - town life: smoke, a shoveller, passers-by;
  - fallback stills;
  - a preview, frames and tests.
- **Not included:** the sorting room, distribution, the railroad, the interface redesign.
- **Gate:** the owner's phone test and judgement of the animation quality; then choose Option A or B.
