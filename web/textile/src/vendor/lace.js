// Copied from experiment/textile-storybook @ d509733 (web/handmade/src/paper/build.js): only laceStrip.
import { circle, ellipse } from './kit.js';
export function laceStrip(L, h, { scallop = 0.22, depth = 0.6, holes = true, x0 = 0 } = {}) {
  const pts = [[x0, 0]]; const n = Math.max(1, Math.round(L / scallop)), sw = L / n, hs = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= 8; j++) { const a = Math.PI - (j / 8) * Math.PI; pts.push([x0 + i * sw + sw / 2 + Math.cos(a) * sw / 2, -h + (1 - depth) * h * 0 - Math.sin(a) * h * depth * 0.5 - h * (1 - depth) * 0]); }
    if (holes && sw > 0.12) hs.push(circle(x0 + i * sw + sw / 2, -h * 0.42, Math.min(sw, h) * 0.17, 10));
  }
  pts.push([x0 + L, 0]);
  return { outline: pts.reverse(), holes: hs };
}
