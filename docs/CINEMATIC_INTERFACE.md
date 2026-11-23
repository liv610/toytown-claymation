# The cinematic story interface (first version, 20 November 2026)

**What changed.** The story interface used to be a purple caption card over the lower left of the scene, plus a bar of chapter pills. It is replaced by a presentation layer that lets the 3D world fill the screen. The story controller, the story copy, the four chapters and the finale, the finder and the 3D scene are unchanged; only the controller hooks the new layer needs were added (see the end).

## Design decisions

- **The scene is full-bleed at every size, phones included.**
  - The old phone layout stacked a header, a squeezed scene and a card. Now the picture keeps the whole screen.
  - Type sits on two soft veils (top and bottom gradients) instead of panels.
  - While the story is open, the picture is lifted slightly with a lens shift (5% on desktop, 10% on phones) so the action sits clear of the captions. The camera itself doesn't move, so the compositions, the camera tests and the fallback stills are unaffected.
- **Where we are, at the top, quietly.**
  - On desktop: an italic gold "Toy Town" wordmark, the chapter's name in Fraunces, and a slim progress rail.
  - The rail has one segment per chapter, each as long as its number of beats, with a gold fill for progress through the chapter.
  - Each segment is still a button (the chapter's name on hover or focus, and to screen readers as "Chapter 2: How does it work?" with `aria-current`). Visitors can jump between chapters as before.
  - On phones the rail runs the full width along the top edge, with the chapter name on one line beneath it.
- **Two standing actions, top right.**
  - **Find Local Campaign** is the only outlined element on screen: a gold-edged pill with a pin. It is the visitor's primary action, but it doesn't compete with the story.
  - **Exit Toy Town** is a quiet text button. On phones it is a × with its full name kept for screen readers.
- **Cinematic captions at the foot, centred under the action.**
  - A small gold, letter-spaced beat label (for example "Collection · October to December").
  - The lead line in Fraunces at film-subtitle size.
  - Secondary lines in a quieter sans.
  - Long beats (the four steps) scroll inside the caption area with a soft fade, so the controls never move.
- **Controls with a clear hierarchy.**
  - **Next** is the one red pill.
  - **Back** and **Pause / Resume** are ghost pills.
  - **Skip story**, **Read as text** and the **Prototype · Draft copy** label are small links beneath.
  - Chapter-end actions (Find My Local Campaign, the placeholder donation) appear above the controls, as before.
- **The interface follows the story.**
  - While a beat's action plays, Next turns to a ghost pill and the secondary controls dim. They stay visible, focusable and clickable.
  - When the action resolves, Next comes back as the red pill with a brief gold glow (twice, then still), so the visitor knows it's their turn.
  - Beats without animation are ready at once.
  - Captions fade up line by line.
  - A new chapter opens with its title, briefly, mid-frame.
  - Pause freezes the story clock the same way the finder does (the town keeps living), and Resume carries on from that frame.
- **Reduced motion.** The caption fades, the chapter title card and the Next glow are switched off. The scene behaviour is unchanged (steady compositions, dips between shots).
- **Without 3D.** The same layout over the stills and the "scene in development" slates.
- **Accessibility.**
  - Every control is a real button with a visible name. The progress segments keep their labels and `aria-current`.
  - The eyebrow still carries the full "Chapter 2 of 4 · How does it work? · Collection" for screen readers; the chapter part is shown at the top instead of being repeated.
  - Each beat is announced in the live region; Pause and Resume announce too.
  - The page behind stays inert while the story is open, as before.

## Sizes reviewed

- Desktop 1280×720.
- Phone 390×844.
- Short phone 375×667.

Phones held sideways (height 500 or less) put the captions to the right of the action over a side veil. That layout is written but not yet reviewed in screenshots.

## Controller changes (the only ones)

- `main.js`:
  - emits `toytown:play` (`playing` / `paused` / `ended`);
  - `__natWorld.pause(on)` sets a pause flag that the existing finder freeze honours;
  - the lens shift while the story is open.
- `story.js`:
  - the progress fill;
  - the chapter name and title card;
  - the caption fade and scroll fade;
  - the play-state classes and the Pause button;
  - `goTo()` (added earlier for development links).
- `index.html`: the story section's markup and styles. Every class the tests and the controller use is kept.

## Tools

`tools/tests/story_ui_shots.js` takes screenshots of the real story interface over the live scene at chosen beats and moments, at desktop, phone and short-phone sizes (QUICK review for interface work).

## Screenshots and comparison (`docs/cinematic-ui/`)

- `new_*`: the new interface over the live scene. Moments:
  - the donation: `how-collect-8.5`, `how-collect-9.85`;
  - the collection: `how-pickup-20.4`, `how-pickup-24.5`;
  - a text-heavy beat: `request-steps-0`.
- Sizes: desktop (1280×720), phone (390×844) and short phone (375×667).
- `how-*_desktop.jpg` / `how-*_phone.jpg` (no prefix): the previous purple-card interface (the last commit before this change, built and captured at the same moments) beside the new one.
  - The phone collection frame also differs because the phone composition was changed in the 2A wrap-up.
- All are SwiftShader captures (`tools/tests/story_ui_shots.js`), not real-device renders.

## Test results (20 November)

- The full regression ran and turned up two problems, both now fixed:
  - **A real bug.** Next didn't come back with its glow when a beat ended, because the scene's `ended` signal wasn't mapped to the ready state.
  - **Four focus checks.** They compared the story text's class name exactly. The text now carries state classes, so the checks look for the class instead. Focus itself was correct.
- After the fixes, the three affected suites were re-run:
  - `visitor_flow`: 140 ok;
  - `toytown_spike`: 25 ok;
  - `scene_m2a` section B: 19 ok.
- The rest of the regression passed unchanged in the full run:
  - `dev_review`: 16 ok;
  - `national_shell`: 42 ok;
  - `finder_e2e`: 75 ok;
  - `finder_map`: 39 ok;
  - `finder_states`: 47 ok;
  - `finder_unit` passed;
  - `scene_m2a` sections A, C and D all ok.

## Interface fixes for Milestone 2B (23 November)

No redesign: the same veils, card and controls, with these corrections.

- **Chapter names on narrow phones.**
  - Phones show the chapter as two lines: a small gold kicker ("Chapter 2") above the title, which wraps instead of being cut.
  - At 360 px wide and below, the top line hides the name and the eyebrow over the captions carries it ("Chapter 2 of 4 · How does it work?"), visible rather than screen-reader only.
- **Contrast.**
  - Dimmed links and tags are brighter, the dimming is lighter (opacity 0.8), and the veils behind the text are deeper.
  - The finder pill has its own dark backing.
- **Phone landscape** (height 500 or less):
  - The captions and controls sit in a right-hand column under a side veil, with the text scrolling if a beat is long.
  - The scene, or a development slate, keeps the left half.
- **Safe areas.** Every fixed element uses `env(safe-area-inset-*)`. The test emulates notch insets in portrait and landscape.

**Test: `tools/tests/story_fit.js`.**

- Six sizes, each with emulated safe-area insets:
  - desktop 1280×720;
  - phone with notch 390×844;
  - short phone 375×667;
  - narrow phone 320×640;
  - landscape with notch 844×390;
  - short landscape 667×375.
- At four story moments, in both the playing state (dimmed) and the ready state.
- It checks:
  - every control and line is inside the safe area;
  - the captions don't touch the top bar;
  - the chapter name is whole;
  - the caption area needs no scrolling as a whole;
  - the WCAG AA contrast (4.5:1) of every visible text run against the actual rendered scene behind it (the 95th-percentile background pixel, with the text hidden).
- **Result (23 November): 520 checks, all ok.** The desktop and portrait sizes ran before the final landscape veil change, which only applies at a height of 500 or less.
  - Lowest margins:
    - the Next button's fixed colours, 5.07:1;
    - "Skip story" and the eyebrow over the brightest collection frames, about 4.6:1.
  - The first run failed in landscape: Next was off-screen and the links were too dim. The second run had two "Prototype · Draft copy" failures in short landscape. The side veil was extended past the card's edge to fix them.
- These are SwiftShader screenshots with emulated insets. Real notched devices, Dynamic Type or large-text settings, and real browser chrome remain a validation item.

## Remaining issues

- **Back during a playing beat** is a ghost pill. It reads correctly but is quieter than Next. Worth confirming that this is the hierarchy wanted.
- **Dimmed secondary controls while a beat plays:** they are still focusable and clickable (on purpose). Their contrast now passes AA (see above).
- **Not reviewed on real devices** (no GPU here). That includes the lens shift, and real notched phones (the safe areas are only emulated).
