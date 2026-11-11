// A schematic "Railroad of Hope" line map: Toy Town at the hub, one station per ZIP area (the first
// digit of a US ZIP code). It is a stand-in for the national folk-art map, drawn as a transit diagram so
// it never pretends to be geography. Works with no 3D, so every path (direct, simple view) ends here too.
import { ZIP_AREAS, routeOf } from './catalog.js';

const HUB = [400, 238];
// [x, y, label dx, label dy, anchor]
const ST = {
  0: [700, 92, 0, -18, 'end'], 1: [600, 160, 16, 5, 'start'], 2: [652, 238, 0, 28, 'end'], 3: [590, 360, 0, 28, 'end'],
  4: [480, 92, 0, -18, 'middle'], 5: [392, 64, 0, -18, 'middle'], 6: [300, 150, 0, -18, 'middle'],
  7: [318, 372, 0, 28, 'middle'], 8: [196, 262, 0, 28, 'start'], 9: [86, 178, 0, -18, 'start'],
};
const COL = { red: '#c8342c', blue: '#3d74b8', green: '#3f8a5a' };
function pathFor(d) {
  const [x, y] = ST[d], [hx, hy] = HUB, dx = x - hx, dy = y - hy;
  const k = Math.min(Math.abs(dx), Math.abs(dy));               // diagonal first, then straight
  const bx = hx + Math.sign(dx) * k, by = hy + Math.sign(dy) * k;
  return `M${hx} ${hy} L${bx} ${by} L${x} ${y}`;
}

export function renderDeliveryMap(el) {
  el.innerHTML = `
    <svg viewBox="0 0 760 430" class="dmap" role="img" aria-labelledby="dmapTitle">
      <title id="dmapTitle">Railroad of Hope line map: Toy Town in the middle, with a station for each of the ten US ZIP code areas.</title>
      <rect x="4" y="4" width="752" height="422" rx="22" class="dm-board"/>
      ${ZIP_AREAS.map((a) => `<path d="${pathFor(a.d)}" class="dm-line" style="stroke:${COL[routeOf(String(a.d))]}" data-line="${a.d}"/>`).join('')}
      ${ZIP_AREAS.map((a) => { const [x, y, dx, dy, an] = ST[a.d]; const lx = x + dx, ly = y + dy, zy = dy < 0 ? ly - 15 : ly + 15;
        return `<g class="dm-st" data-st="${a.d}"><circle cx="${x}" cy="${y}" r="9"/><text x="${lx}" y="${ly}" text-anchor="${an}">${a.short}</text><text class="dm-zip" x="${lx}" y="${zy}" text-anchor="${an}">ZIP ${a.d}xxxx</text></g>`; }).join('')}
      <g class="dm-hub"><circle cx="${HUB[0]}" cy="${HUB[1]}" r="17"/><text x="${HUB[0]}" y="${HUB[1] + 5}" text-anchor="middle">★</text>
        <text class="dm-hublabel" x="${HUB[0]}" y="${HUB[1] + 40}" text-anchor="middle">Toy Town</text></g>
      <g class="dm-train" id="dmTrain" opacity="0"><rect x="-13" y="-7" width="26" height="14" rx="4"/><circle cx="-6" cy="8" r="3"/><circle cx="6" cy="8" r="3"/></g>
    </svg>
    <p class="dm-note">Schematic stand-in for the national map · ZIP areas by first digit</p>`;
}

// animate a train along the line to the area's station; resolves when it has arrived
export function animateDelivery(el, zip, { reducedMotion } = {}) {
  const d = +zip[0];
  const path = el.querySelector(`[data-line="${d}"]`), train = el.querySelector('#dmTrain');
  el.querySelectorAll('.dm-line').forEach((p) => p.classList.toggle('dm-dim', p !== path));
  el.querySelectorAll('.dm-st').forEach((s) => s.classList.remove('dm-lit'));
  path.classList.add('dm-active');
  const L = path.getTotalLength(), dur = reducedMotion ? 0 : 2600;
  return new Promise((resolve) => {
    const t0 = performance.now();
    train.setAttribute('opacity', '1');
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = k * k * (3 - 2 * k);
      const p = path.getPointAtLength(e * L), q = path.getPointAtLength(Math.min(L, e * L + 1));
      const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      train.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${ang})`);
      if (k < 1) requestAnimationFrame(step);
      else { train.setAttribute('opacity', '0'); el.querySelector(`[data-st="${d}"]`).classList.add('dm-lit'); resolve(); }
    };
    requestAnimationFrame(step);
  });
}
