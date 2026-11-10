// DOM hotspot pins that follow 3D points. Real <button>s, so they are focusable, labelled and
// reachable by keyboard and screen readers; the 3D canvas itself stays aria-hidden.
export function createPins(host, layer) {
  const pins = new Map();
  let frameNo = 0;
  function add({ id, label, hint, icon = '✦', getPos, onSelect }) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pin'; b.dataset.pin = id;
    b.setAttribute('aria-label', hint ? `${label}: ${hint}` : label);
    b.innerHTML = `<span class="pin-dot" aria-hidden="true">${icon}</span><span class="pin-label">${label}</span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); onSelect(id); });
    layer.appendChild(b);
    pins.set(id, { id, b, getPos, vis: true, occ: false });
    return b;
  }
  function remove(id) { const p = pins.get(id); if (p) { p.b.remove(); pins.delete(id); } }
  function setVisible(id, v) { const p = pins.get(id); if (p) { p.vis = v; p.b.hidden = !v; } }
  function update() {
    frameNo++;
    for (const p of pins.values()) {
      if (!p.vis || layer.hidden) continue;
      const w = p.getPos();
      const s = host.project(w);
      if (frameNo % 12 === 0) p.occ = host.occluded(w);
      const off = !s.inFront || s.x < -40 || s.y < -40 || s.x > innerWidth + 40 || s.y > innerHeight + 40;
      p.b.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      p.b.classList.toggle('pin-off', off || p.occ);
      p.b.tabIndex = off ? -1 : 0;
    }
  }
  const stop = host.onUpdate(update);
  return { add, remove, setVisible, get: (id) => pins.get(id)?.b, show: (v) => { layer.hidden = !v; }, dispose: () => { stop(); for (const id of [...pins.keys()]) remove(id); } };
}
