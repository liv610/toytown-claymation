# Milestone 2 UX exploration: one cohesive world (concepts only)

Static concepts for the owner's review after Milestone 1. The working app was not changed. Milestone 1 is preserved on
`experiment/visitor-flow` and `preserve/milestone1` (625a80b); this branch, `experiment/ux-cohesion`, holds only these concepts.

- **A. Mobile landing:** Direction A, map-first ticket (`LA_1`–`LA_5`); Direction B, search header with Toy Town on stage (`LB_1`–`LB_5`).
  Screens 1–4 are 390 × 844 and screen 5 is a 375 × 667 small phone.
- **B. Story interface:** Direction A, cinematic (`SA_*`); Direction B, storybook (`SB_*`).
  Each has desktop Chapter 1, phone Chapter 1, Chapter 3 as four step beats (phone), and the finder during the story (phone and desktop).
- **C. Transitions:** Concept 1, one continuous world (`T_land`, `T1_a*`, `T2_a*`, `T3_a*`); Concept 2, storybook pages (`T1_b*`, `T2_b*`, `T3_b1`).
- **Review page:** `review.html`, with all options side by side, rationale, recommendation and open decisions (published: https://claude.ai/artifact/QRSoFRuiw1eRzr2GtMJPYf).

How they are made:

1. `render.js` drives the current national page headless and saves the bare map canvas and frames of the existing descent (`renders/`).
2. `concepts.html?s=<id>` draws each screen over those renders and the existing story stills (`web/national/assets/story`).
3. `shoot.js` captures the screens (`screens/`, PNG at 2×, converted to JPEG).

```
cd web && npm run build:national && python3 -m http.server 8767                       # app, for render.js
URL=http://localhost:8767/national/index.html node docs/concepts/m2-ux/render.js
python3 -m http.server 8794                                                            # repo root, for shoot.js
node docs/concepts/m2-ux/shoot.js
```

The numbered signs, the glow at Toy Town and the paper interface are drawn over existing images for the concept. No new
3D, scenes, campaign data or claims about Toys for Tots were added. Story text is the existing draft copy. The renders are
from headless SwiftShader (no GPU): faithful images, no performance measurements.
