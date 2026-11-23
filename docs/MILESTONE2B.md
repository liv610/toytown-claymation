# Milestone 2B: inside the sorting room (first version, 23 November 2026)

Branch `experiment/milestone2b`, which grows from `experiment/milestone2a`. It is a prototype, and every action and figure in it is a placeholder.

## What the visitor sees

Chapter 2's third beat ("Sorting · usually December") now plays live. It picks up from the collection's last frame, on the same story clock.

1. **Into the hall.**
   - The camera drifts along the hall's front to its lit left window, slows, and passes through the glass in a warm glow.
   - Inside, the Marine stands a moment by the door with the carton, then carries it to the long sorting table.
2. **The handover.**
   - A volunteer (the "host", in a plum cardigan) looks up, smiles and nods. The Marine nods back as he sets the carton down.
   - She draws it towards her.
3. **The reveal.**
   - She lifts the red truck out into the lamplight, with a few gold sparkles and a happy squint.
   - She tips it to look at its wheels.
4. **Made ready.**
   - She turns, carries it to the cart of prepared toys and lays it in the crate (the READY tag).
   - She rests a hand on the crate, a quiet moment, and the Marine nods.
5. **The hand-off.**
   - The Marine comes round and wheels the cart to the back door. Another volunteer pushes it open onto the snowy yard.
   - The host watches with a hand on her heart. The beat waits there for the visitor's Next.

Around them, the room works on its own wall clock, so it keeps living while the beat waits:

- a volunteer moves books from a box to a pile, one at a time;
- another letters labels on boxes (BOOKS, PLUSH, PUZZLES, GAMES, TOYS);
- a third fills gaps on a shelf from a basket of plush. She is the one who later opens the back door.

When the Marine comes in, they look up and one waves. Garlands, pendant lamps and hanging felt stars sway a little, the string lights twinkle, the lamps breathe, and snow drifts past the windows.

## Design decisions

- **The room is the street model's own hall.**
  - It is built inside the hall at its real size: 8 × 6.5 units, with a door 1.4 × 2.4 and four front windows at x ±2.6 (`scripts/tt/community.py`).
  - The inside windows sit exactly behind the windows seen from the street.
  - The open door shows this same room from the street, and it shows it in the collection too.
  - It replaces the small entrance room that used to stand behind the door.
  - Nothing about the exterior changed. The one addition is a back door, cut through the hall's back wall and drawn on its outside face, so the building agrees with itself from every side.
- **Through the window, not a cut.**
  - The lit window is the warmest thing on the street, so the camera goes there.
  - It passes through the lower-right pane, clear of the muntins.
  - A warm glow covers the moment the lens crosses the glass: a page overlay for visitors, drawn into frames for stills and clips.
  - Under reduced motion it is a dip to a still composition inside the room.
- **One controller.**
  - `scene_sorting.js` is built by `scene_donation.js`, with the same puppets, props, posing helpers and clock.
  - The beat is `{ play: 'sorting' }`.
  - Pause, the finder freeze, Next (fast-forward or dip), Back, Skip, Exit and reduced motion all work as they do for the other two beats, with no new controller code.
  - The only main.js additions are the glow overlay and "the camera is indoors" (moonlight and cold sky fill fade, the room's lamps take over).
- **The truck stays the thread.**
  - It is carried by the carton, then the host's hands, then the cart, and is never moved on its own.
  - It is at the centre of the reveal, the check, the crate and the final shot.
  - The other toys are felt and painted and smaller, and no other vehicle is red.
- **Shots designed per screen.**
  - Desktop has six shots. Phones use the same shots from further back and higher, kept inside the room.
  - The reveal is staged across the table's front-right, so the Marine is in profile and the host faces the lens.
  - The last shot looks down over the door-holder's shoulder to the cart, the open door and the snowy yard.
- **Materials.**
  - The established language: waxed plank floor, a painted wainscot, wallpaper with hand-printed holly sprigs, oak shelving, cardboard with hand-lettered labels.
  - Felt toys, felt lamp shades with a warm lining, felt garlands and pennants.
  - All are procedural (canvas textures and primitives) in the felt shader, so no new assets or licences.
- **Story accuracy.**
  - The labels name kinds of toys, never ages, rules or procedures.
  - The banner says "Thank you, Toy Town".
  - The beat's copy is unchanged draft text, including "Each local campaign organizes this in its own way."
  - The no-3D description says what happens, not how campaigns work.

## Files

- `web/national/src/scene_sorting.js` (new): the room, the volunteers, the choreography and the shots.
- `scene_donation.js`: builds it and appends its shots.
- `main.js`: the glow, the indoor light, the frame hooks.
- `community.js`: the falling snow is kept out of the hall.
- `story_data.js`: the beat plays.
- Tests:
  - `tools/tests/scene_m2a.js`: section **S**, plus additions to B and D.
  - `web/national/src/review_views.json`: the named `sorting` and `room` views for `review_shots.js` and the dev panel.
  - `tools/tests/scene_stills.js`: `sorting.jpg`.

## Checkpoint (23 November)

Review material in `docs/milestone2b/`:

- `clip_window_transition_desktop.mp4` / `sheet_window_transition.jpg`: the street to the room through the lit window.
- `clip_truck_sorted_desktop.mp4` / `sheet_truck_sorted.jpg`: the handover, the reveal, the crate and the hand-off.
- `ui_*_desktop.jpg` / `ui_*_phone.jpg`: the beat with the story interface over it, at six moments.

All are SwiftShader captures, not real-device renders. No full-length video was made.

### Test results

- **Full regression: all suites passed.**
  - `scene_m2a`: 56 ok, including the new section **S** (16 checks):
    - the truck's continuity carton → hands → crate, and visibility;
    - the door and the host holding the truck;
    - no character collisions; the table, the cart and the room bounds;
    - the camera glides with no jumps, plus the inside flag and the glow;
    - B: Next plays the sorting beat; D: the no-3D still and description.
  - `dev_review`: 16 ok;
  - `toytown_spike`: 25 ok;
  - `visitor_flow`: 140 ok;
  - `national_shell`: 42 ok;
  - `finder_e2e`: 75 ok;
  - `finder_map`: 39 ok;
  - `finder_states`: 47 ok;
  - `finder_unit` passed.
- **Interface fit and contrast** (`story_fit.js`, six sizes with emulated safe areas): 520 checks, all ok. See `CINEMATIC_INTERFACE.md`.

### Unresolved

- **Real devices.** The frame rate, the indoor lighting cost and the safe areas are only measured or emulated in SwiftShader.
  - The room adds four point lights and a few hundred instanced toys.
  - Phones may need fewer lamps (one light per pair) if the real-device frame rate falls short.
- **The glass moment.** About 0.4 s of warm whiteout. It reads as passing through the light, but it is a dissolve rather than true optics.
- **Background loops repeat.** The book pile and the shelf slots reset on each cycle, which is visible if a visitor waits on the last shot for a minute.
- **Winter hats indoors.** The volunteers keep their knitted hats on. That's charming but maybe odd; easy to change.
- **The yard behind the back door** is a painted backdrop, not the modelled street.
- **Long beat.** At about 28 s, the sorting beat is the longest. Next fast-forwards through it, and Skip and the text version are always there.
- **Copy.** The draft line "sorted and prepared for children of different ages" is unchanged. The scene itself shows no age sorting, so that line is for the organisation to confirm or soften.
