# Railroad of Hope: Phase 1 implementation plan (for approval)

Repository copy of the plan doc: https://claude.ai/artifact/DQGUAp7rJPNKFB2BdUvgxo. The doc holds the same content
plus three drawings (architecture, hours chart, milestone roadmap). Planning only: no application code changed.

Approved direction: Landing A, Story A (cinematic) and Transition Concept 1, with Landing B's illuminated Toy Town
marker and Story B's four-station railroad for Chapter 3.

## Summary

Build Phase 1 on the national app and turn Maple Hollow into Toy Town. The essential scope is an estimated
**61–75 hours**, which fits the 60–80 hour target. Adding every enhancement brings it to about 75–95 hours, which
does not fit.

- **The continuous world mostly exists already.**
  - The national app has one 3D scene holding the felt map and the Maple Hollow street.
  - It has a working camera flight down into the street (`descend`, 7.5 s) and one back up to the country (`ascend`, 5.5 s).
- **One Toy Town = the Maple Hollow street, moved to the Toy Town hub and renamed.**
  - The map already reserves a flattened Toy Town site where the three railroad lines meet.
  - The street's signs (General Store, Community Hall, Toy Drop-off) carry no town name.
  - The separate felt Toy Town (toy shop, station, interior) stays in its own prototype for Phase 1. It is a different app at a different scale, with about 4–6 MB of models against about 2 MB.
- **Chapters become camera shots in that one street.** No new environments. Chapter 1's existing animation becomes Chapter 2's collection beats. The Chapter 3 stations are an interface railroad over street shots.
- **The riskiest part comes first.** Milestone 1 is a 9–11 hour spike, tested on the owner's phone, before any other chapters are built.
- **Nothing needs the local-site team.** It is a standalone static bundle published as preview links: no servers, no shared infrastructure.

## A. Architecture

There is one page, one 3D scene and one finder.

- **Page layer:** the landing ticket, the story controls and the finder are plain page elements that work without 3D.
- **Story controller** (`story.js`, `story_data.js`): it still holds one `{chapter, beat}` record. Each beat names a camera `shot` plus a fallback still.
- **New shot stage:** `registerStage('shot')` turns a beat's shot into a camera move by the camera director (`makeFlight`, `descend`, `ascend` in `main.js`).
- **Reduced motion:** every move becomes a crossfade.
- **One three.js scene:** the felt map plus the Toy Town street at the hub, sharing lights, snow and time of day. The street is drawn only when the camera is close.
- **Finder** (`finder.js`, `selection.js`, `shared/campaigns.js`): it opens over the paused scene and keeps the story position (existing). The finale embeds its ZIP field. There is no new lookup logic and no second finder.

## B. Asset inventory

| Asset or system | Phase 1 | What changes |
| --- | --- | --- |
| Felt national map, relief, railroad lines | Reuse | Hub glow becomes the gold Toy Town marker |
| Finder, ZIP lookup, selection, card | Reuse | Restyled as the ticket. Back to results only for two or more serving campaigns |
| Story controller, Read as text, finder hand-off, resume | Adapt | Beats gain a `shot`. Chapter 3 becomes four stations. Cinematic interface |
| Descent and rise flights | Adapt | Started by Explore Toy Town and the finale. They land on the first story shot. Crossfade with reduced motion |
| Maple Hollow street, `maple.glb` (0.78 MB) | Adapt | Placed at the Toy Town hub and called Toy Town. No model change |
| Townspeople and Marine (about 1.15 MB) | Reuse | Nothing |
| Chapter 1 animation (about 15 s) | Adapt | Becomes Chapter 2's collection beats; its own caption bar is retired |
| Story stills (no-3D fallback) | Replace | Re-rendered from the new shots (`tools/story_stills.js`) |
| Felt Toy Town (journey: toy shop, station, interior; about 4–6 MB) | Defer | Phase 2 candidate |
| Tests and packaging | Adapt | Updated for the new interface and shot stage |

**The eight One Toy Town questions**

1. **Foundation:** the national app with the Maple Hollow street.
2. **Reused directly:** map, finder, selection, story controller, townspeople, Marine, both flights.
3. **Adapted:** street position and name, Chapter 1 timeline, flight end points, stills, interface.
4. **The descent is preserved,** with a new end point and trigger.
5. **Chapter 1's animation is incorporated as Chapter 2,** and Chapter 1 becomes establishing shots.
6. **Moving between chapters:** all chapters are in one street, so beats change by short camera moves or cuts, with no loading.
7. **Built from scratch:** the shot stage, about 20 shots, the Chapter 3 station interface, the embedded finale ZIP field and the styles. No new 3D models.
8. **Deferred:**
   - the felt toy shop and station;
   - new sorting and distribution animations;
   - 3D station signs;
   - a Toy Shop sign;
   - a Marine guide.

## C. Continuous-world feasibility

| Transition | Exists today | New work | Confidence |
| --- | --- | --- | --- |
| Map to Toy Town | 7.5 s descent to the street; gold felt star and glow at the hub | Street at the hub site; railroad lines trimmed at the town's edge; Explore as the trigger; Skip the flight | High for the mechanics; the hub's look decided in the spike |
| Toy Town to finder | Finder over the story, back to the same beat (tested) | Keep the 3D scene drawn while the finder is open; ticket instead of a panel | High |
| Finale to map | 5.5 s rise (`ascend`) | Start it from the finale, hold the line, show the embedded ZIP field | High |
| Reduced motion, no 3D | Instant flights; stills fallback | Crossfade; re-rendered stills | High |

Phone smoothness and memory can only be judged on real devices; the cloud machines have no GPU. Quality tiers (`q=low|medium|high`) exist.

## D. Phase 1 scope

**Essential:**

- landing ticket on desktop and phones, with the gold Toy Town marker, a single Find and a keyboard-safe ZIP field;
- the cinematic story interface;
- one Toy Town at the hub;
- the three transitions plus the crossfade;
- the chapters as shots in one street:
  - Chapter 1 establishing shots;
  - Chapter 2 with the collection animation;
  - Chapter 3's four stations with the railroad tracker;
  - Chapter 4;
- a finale with the embedded ZIP field, Donate (provisional), Replay and Return to the map;
- the no-3D fallback, with accessibility and reduced motion tested.

**Enhancements (about 14–20 h):**

| Enhancement | Hours |
| --- | --- |
| Smooth camera moves between beats | 3–4 |
| Felt station signs in the 3D street | 4–6 |
| Railroad lines light up during the finale rise | 2–3 |
| General Store becomes a Toy Shop (Blender re-export) | 2–3 |
| "Give the toy" tap | 2 |
| Extra finish on the ticket and the controls | 1–2 |

**Phase 2 candidates:**

- the felt toy shop, station and interior in the one town;
- sorting and distribution animations;
- a Marine guide and an arriving train;
- authoritative campaign data and official links, once approved.

## E. Estimated hours (remaining work only)

| Workstream | Hours |
| --- | --- |
| Landing refinement (desktop) | 4–5 |
| Responsive mobile experience | 6–7 |
| Cinematic story interface | 8–9 |
| Toy Town integration (Maple Hollow) | 10–14 |
| Chapter 1 adaptation | 3–4 |
| Chapters 2–4 | 8–10 |
| Camera transitions | 4–5 |
| Finder integration and finale | 5–6 |
| Accessibility and performance | 5–6 |
| Testing and final polish | 8–9 |
| **Essential total** | **61–75** |
| With all enhancements | 75–95 |

Assumptions:

- The hours are hands-on build and verification time. They exclude the owner's review and the organisation's copy review.
- Completed Milestone 1 work counts as zero.
- No new 3D models.
- These are planning estimates, not an engineering team's. Actual Milestone 1 hours will calibrate the rest.

## F. Milestones (each ends with a preview link and a stop for approval)

1. **Continuous-world spike (9–11 h).**
   - Deliverables: street at the hub, named Toy Town; lines trimmed; Explore flies down to the first shot; a test finale rises to the country; reduced-motion crossfade; Skip the flight.
   - Review: on the owner's phone, does it feel like one world?
2. **Cinematic story and Chapter 1 in 3D (14–18 h).**
   - Deliverables: the shot stage; the cinematic interface; Chapter 1 shots; the finder as a ticket over the paused scene; re-rendered stills.
   - Review: caption readability, and the finder's round trip.
3. **Landing ticket (10–12 h).**
   - Deliverables: desktop and phones; the gold marker; a single Find; the keyboard-safe layout; the Back to results rule; the caption behind (i).
   - Review: both journeys on a phone with the keyboard open.
4. **Chapters 2–4 and the finale (15–19 h).**
   - Deliverables: collection animation; Chapter 3 stations; Chapter 4; finale rise with the embedded ZIP field; all stills.
   - Review: the whole story; choose the enhancements.
5. **Accessibility, performance and polish (13–15 h).**
   - Deliverables: tests; screen-reader pass; phone tuning; load size; packaging; hours report.
   - Review: is Phase 1 ready to show?

## G. Risks and dependencies

**Outside our control, none blocking Phase 1:**

- authoritative ZIP-to-campaign mapping, official campaign links and the official donation destination (Toys for Tots);
- story copy review (Toys for Tots, through the owner);
- real-phone testing (the owner);
- production hosting (the local-site team, later; not needed for preview links).

**Project risks and mitigations:**

| Risk | Mitigation |
| --- | --- |
| Phone performance and memory | Quality tiers, loading the street on Explore, the stills fallback, measured in Milestone 1 |
| A crowded hub | Trim the lines and fade the star; settled in Milestone 1 |
| Captions over 3D | One scrim and text-shadow treatment, checked on the lightest and darkest shots |
| Phone keyboards | Position from the visible viewport; test on iPhone and Android |
| Focus during camera moves | Focus on arrival, a live announcement, Skip, crossfade |
| The map pauses under the story (Milestone 1 rule) | Contained to `main.js` and `story.js`; found in the spike |
| Estimate error | Actual hours reported after Milestone 1; enhancements chosen at the Milestone 4 gate |

## H. Recommendation and decisions to approve

Deliver the essential scope in five reviewed milestones, the spike first, on a new `experiment/phase1-build` branch from
the Milestone 1 commit. `experiment/visitor-flow`, `preserve/milestone1` and `experiment/ux-cohesion` stay untouched.

- [ ] The national app with Maple Hollow's street, moved to the hub and named Toy Town, as the one Toy Town
- [ ] Chapter 1's animation used for Chapter 2's collection beats; Chapter 1 as establishing shots
- [ ] The felt toy shop, station and interior deferred to Phase 2
- [ ] The essential scope (61–75 h); enhancements chosen at the Milestone 4 gate
- [ ] Start Milestone 1, the continuous-world spike (9–11 h)
