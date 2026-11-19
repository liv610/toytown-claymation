// Development review panel: ?dev=1 only (app.js imports this chunk only then; visitors never download it).
// It drives the visitor's own story clock and scene through window.__natDev (main.js): no separate animation system.
//
// Links (all optional, combine freely):
//   ?dev=1&at=lid0            open paused at a timeline mark (lid0, lidGo, grip, door0, door1, inside, shut0 …), or
//   ?dev=1&t=19.6             at a story time in seconds; at=lidGo+0.8 adds an offset
//   &beat=collection          play that beat from its start (donation | collection)
//   &play=1                   start playing from the chosen moment (otherwise paused there)
//   &view=lid-open-side       an inspection camera from review_views.json (otherwise the visitor's camera)
//   &frame=phone|desktop      the phone (390×844) or desktop (16:9) composition, framed in the window
//   &rate=0.25                slow motion
//   &story=how/pickup         open the visitor's story at that chapter/beat instead (card, controls and all)
import VIEWS from './review_views.json';

const Q = new URLSearchParams(location.search);
const D = window.__natDev;

export function start({ story }) {
  if (!D) return;
  const T = D.times(), B = D.beats(), END = D.duration(), FPS = 24;
  const marks = Object.entries(T).filter(([, v]) => typeof v === 'number' && v >= 0 && v <= END).sort((a, b) => a[1] - b[1]);
  const resolve = (at) => { if (at == null || at === '') return null; if (!isNaN(+at)) return +at;
    const m = /^([A-Za-z0-9_]+)\s*([+-]\s*[\d.]+)?$/.exec(String(at)); if (!m || !(m[1] in T)) return null; return T[m[1]] + (m[2] ? +m[2].replace(/\s/g, '') : 0); };
  const beatAt = (t) => Object.entries(B).find(([, [a, b]]) => t >= a - 1e-6 && t < b) || Object.entries(B).at(-1);

  // ------------------------------------------------------------ the panel
  const css = document.createElement('style');
  css.textContent = `
    body.dev-review .landing, body.dev-review .note, body.dev-review #caption, body.dev-review #hint, body.dev-review .controls { display: none !important; }
    .devp { position: fixed; z-index: 50; left: 12px; right: 12px; bottom: 12px; max-width: 980px; margin: 0 auto; padding: 10px 12px;
      background: rgba(12, 10, 24, 0.92); border: 1px dashed #f2b85c; border-radius: 12px; color: #f6ecda; font: 13px/1.35 system-ui, sans-serif; }
    .devp .devtag { color: #f2b85c; font-weight: 700; margin-right: 8px; }
    .devp .row { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; margin-top: 6px; }
    .devp button, .devp select { font: inherit; color: inherit; background: #2a2546; border: 1px solid #5a5280; border-radius: 6px; padding: 4px 9px; min-height: 30px; }
    .devp button:hover { border-color: #f2b85c; }
    .devp input[type=range] { flex: 1 1 260px; accent-color: #f2b85c; }
    .devp output { font-variant-numeric: tabular-nums; min-width: 15ch; }
    .devp a { color: #f2b85c; word-break: break-all; }
    .devp .hide { margin-left: auto; }
    .devp.min .row, .devp.min .more { display: none; }`;
  document.head.append(css);
  document.body.classList.add('dev-review');
  const el = document.createElement('section'); el.className = 'devp'; el.setAttribute('aria-label', 'Development review controls');
  const opt = (v, l) => `<option value="${v}">${l}</option>`;
  el.innerHTML = `
    <div><b class="devtag">DEV REVIEW</b>Prototype development tool, not part of the visitor experience. Space: play/pause · ←/→: one frame · [ ]: one second
      <button class="hide" data-k="min" type="button">Hide</button></div>
    <div class="row">
      ${Object.keys(B).map((k) => `<button type="button" data-beat="${k}">Replay ${k}</button>`).join('')}
      <button type="button" data-k="play" aria-label="Play or pause">▶ Play</button>
      <button type="button" data-k="back" aria-label="Back one frame">◀ 1f</button><button type="button" data-k="fwd" aria-label="Forward one frame">1f ▶</button>
      <input type="range" min="0" max="${END}" step="${1 / FPS}" aria-label="Story time" data-k="scrub"><output></output>
    </div>
    <div class="row">
      <label>Moment <select data-k="mark">${opt('', '—')}${marks.map(([k, v]) => opt(k, `${k} · ${v.toFixed(2)} s`)).join('')}</select></label>
      <label>Camera <select data-k="view">${opt('', 'Visitor camera')}${Object.entries(VIEWS.views).filter(([, v]) => v.pos).map(([k]) => opt(k, k)).join('')}</select></label>
      <label>Composition <select data-k="frame">${opt('auto', 'This window')}${opt('desktop', 'Desktop 16:9')}${opt('phone', 'Phone 390×844')}</select></label>
      <label>Speed <select data-k="rate">${['1', '0.5', '0.25', '0.1'].map((r) => opt(r, r + '×')).join('')}</select></label>
      <button type="button" data-k="story">Open this beat in the story</button>
    </div>
    <div class="row more">Link to this moment: <a data-k="link" href="#"></a> <button type="button" data-k="copy">Copy</button></div>`;
  document.body.append(el);
  const $ = (k) => el.querySelector(`[data-k="${k}"]`);
  const ui = { view: '', frame: 'auto', rate: '1' };

  function link() {
    const s = D.state(), q = new URLSearchParams({ dev: '1', t: s.t.toFixed(3) });
    if (ui.view) q.set('view', ui.view); if (ui.frame !== 'auto') q.set('frame', ui.frame); if (ui.rate !== '1') q.set('rate', ui.rate);
    for (const k of ['capture', 'q']) if (Q.has(k)) q.set(k, Q.get(k));
    return `${location.pathname}?${q}`;
  }
  let lastLink = '';
  function refresh() {
    const s = D.state(), [bk] = beatAt(s.t);
    $('scrub').value = s.t; el.querySelector('output').textContent = `${s.t.toFixed(2)} s · ${bk}`;
    $('play').textContent = s.playing ? '❚❚ Pause' : '▶ Play';
    const l = link(); if (l !== lastLink && !s.playing) { lastLink = l; history.replaceState(null, '', l); $('link').href = l; $('link').textContent = location.origin + l; }
  }
  setInterval(refresh, 120);

  const seek = (t) => { D.seek(t); refresh(); };
  const setView = (name) => { ui.view = name || ''; $('view').value = ui.view; const v = VIEWS.views[name]; D.view(v && v.pos ? { pos: v.pos, look: v.look } : null); };
  const setFrame = (f) => { ui.frame = ['desktop', 'phone'].includes(f) ? f : 'auto'; $('frame').value = ui.frame; D.composition(ui.frame); };
  const setRate = (r) => { ui.rate = String(r || 1); $('rate').value = ui.rate; D.rate(+ui.rate); };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.beat) { const [a, z] = B[b.dataset.beat]; D.seek(a); D.play(z); return; }
    const k = b.dataset.k, s = D.state();
    if (k === 'play') s.playing ? D.pause() : D.play(beatAt(s.t)[1][1] - s.t < 1e-3 ? END : beatAt(s.t)[1][1]);
    if (k === 'back') seek(s.t - 1 / FPS);
    if (k === 'fwd') seek(s.t + 1 / FPS);
    if (k === 'min') { el.classList.toggle('min'); b.textContent = el.classList.contains('min') ? 'Show' : 'Hide'; }
    if (k === 'copy') navigator.clipboard && navigator.clipboard.writeText(location.origin + link());
    if (k === 'story') openStory(beatAt(s.t)[0]);
    refresh();
  });
  $('scrub').addEventListener('input', (e) => seek(+e.target.value));
  $('mark').addEventListener('change', (e) => { if (e.target.value) seek(T[e.target.value]); });
  $('view').addEventListener('change', (e) => setView(e.target.value));
  $('frame').addEventListener('change', (e) => setFrame(e.target.value));
  $('rate').addEventListener('change', (e) => setRate(e.target.value));
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea, dialog')) return;
    const s = D.state();
    if (e.key === ' ') { e.preventDefault(); $('play').click(); }
    else if (e.key === 'ArrowLeft') seek(s.t - 1 / FPS); else if (e.key === 'ArrowRight') seek(s.t + 1 / FPS);
    else if (e.key === '[') seek(s.t - 1); else if (e.key === ']') seek(s.t + 1);
  });

  // the visitor's story at the beat that plays this stretch (card, chapter bar and controls; the panel steps aside)
  function openStory(sceneBeat) {
    const ch = story.chapters(); let id = null;
    for (const c of ch) for (const b of c.beats) if (!id && ((sceneBeat === 'donation' && b === 'collect') || (sceneBeat === 'collection' && b === 'pickup'))) id = [c.id, b];
    setView(''); el.classList.add('min'); $('min').textContent = 'Show';
    if (id) story.goTo(...id);
  }

  // ------------------------------------------------------------ the link's starting point
  D.open(0);
  setFrame(Q.get('frame')); setRate(Q.get('rate'));
  if (Q.get('story')) { const [c, b] = Q.get('story').split('/'); D.seek(B.donation[0]); el.classList.add('min'); $('min').textContent = 'Show'; story.goTo(c, b); return; }
  const v = VIEWS.views[Q.get('view')];
  setView(Q.get('view'));
  const beat = B[Q.get('beat')];
  const t = beat ? beat[0] : resolve(Q.get('t') ?? Q.get('at') ?? (v && v.at)) ?? 0;
  D.seek(t);
  if (beat) D.play(beat[1]); else if (Q.get('play') === '1') D.play(beatAt(t)[1][1]);
  refresh();
}
