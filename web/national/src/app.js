// National map page shell (Milestone 1). This small entry runs first and wires everything that must work without the
// 3D world: the "ways to help" bar, the dialogs and the campaign finder. It does not import three.js or the map.
// The 3D map (main.js and three.js) is a separate chunk loaded right afterwards; if it cannot load (no WebGL, a
// network error, ?map=off) the page stays usable and says so. Same split as the Toy Town journey (journey.js +
// lazily imported world chunks).
import { loadDirectory } from '../../shared/campaigns.js';
import { createFinder } from './finder.js';
import { selection } from './selection.js';
import { createStory, registerStage } from './story.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);

// ------------------------------------------------------------ campaign finder
// The page declares its data source on #finder (data-campaigns="test" + data-src on this prototype). ?campaigns=official
// can only move AWAY from test data: the official directory is not connected yet, so the finder then offers the
// official campaign finder instead (the production behaviour until real data is approved).
const F = $('finder');
const source = Q.get('campaigns') === 'official' ? 'official' : F.dataset.campaigns;
const directory = loadDirectory({ source, url: source === 'test' ? F.dataset.src : F.dataset.officialSrc });
const finder = createFinder(F, { directory, officialUrl: F.dataset.officialUrl,
  collapsed: Q.get('chapter') === '1' || location.hash === '#chapter1' });
// keep the finder under the top bar, and the caption clear of it on narrow screens
function layout() {
  const top = document.querySelector('.topbar').getBoundingClientRect().bottom, root = document.documentElement.style;
  root.setProperty('--finder-top', `${Math.round(top + 10)}px`);
  const L = $('landing'), box = (L && L.getBoundingClientRect().height ? L : document.querySelector('.topbar')).getBoundingClientRect();
  root.setProperty('--finder-bottom', `${Math.round(box.bottom)}px`);
}
addEventListener('resize', layout); addEventListener('finderlayout', layout);
new ResizeObserver(layout).observe($('landing')); layout();
// heading into Maple Hollow's story: tuck the finder away (one tap brings it back)
for (const id of ['descend', 'pinMaple']) $(id).addEventListener('click', () => finder.collapse());

// ------------------------------------------------------------ ways to help
// "Find Local Campaign" opens the finder; the others are placeholders in this prototype ("not connected yet").
// Phones: the actions sit behind one "Ways to help" button instead of a fixed four-button bar.
const notYet = (title) => { $('nyTitle').textContent = title; $('notyet').showModal(); };
const menuBtn = $('helpMenu'), menu = $('helpActions');
const closeMenu = () => { if (!menu.classList.contains('open')) return; menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); };
menuBtn.addEventListener('click', () => { const open = menu.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button').focus(); });
menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); menuBtn.focus(); } });
document.addEventListener('click', (e) => { if (!menu.contains(e.target) && e.target !== menuBtn) closeMenu(); });
document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => {
  closeMenu();
  if (b.dataset.action === 'campaign') { if (story.isOpen()) story.openFinder(); else finder.open(); return; }
  notYet(b.textContent);
}));

// ------------------------------------------------------------ Toy Town story (placeholder scenes, Milestone 1)
const story = createStory($('story'), { finder, notYet, onLeave: (pos) => {
  // back on the map: Explore Toy Town offers to continue where the visitor left (or start over)
  const done = !pos || pos.chapter >= 4;
  $('exploreBtn').querySelector('.explore-title').textContent = done ? 'Explore Toy Town' : 'Continue Toy Town';
  $('exploreBtn').querySelector('.explore-sub').textContent = done ? 'Discover how toys travel from neighbors to families.' : `Pick up at chapter ${pos.chapter + 1}.`;
  $('exploreRestart').hidden = done;
  // Milestone 1 spike: in the live street, the camera rises back to the country first
  const w = window.__natWorld;
  if (w && w.inTown()) { document.body.classList.add('traveling'); w.ascend(() => { document.body.classList.remove('traveling'); $('exploreBtn').focus(); }); }
  else $('exploreBtn').focus();
} });
// Explore Toy Town: with the 3D map, fly down into Toy Town first (Milestone 1 spike); without it, straight to the story
function explore(opts = {}) {
  const w = window.__natWorld;
  if (!w || story.isOpen()) { story.enter(opts); return; }
  const pos = story.position(), first = opts.restart || !pos || (pos.chapter === 0 && pos.beat === 0);
  if (!first) { story.enter(opts); return; }                 // continuing mid-story: the beat's own stage takes over
  finder.collapse(); document.body.classList.add('traveling');
  const started = w.descend(() => { document.body.classList.remove('traveling'); story.enter(opts); });
  if (!started) { document.body.classList.remove('traveling'); story.enter(opts); return; }
  if (!$('skipFlight').hidden) $('skipFlight').focus();
}
$('exploreBtn').addEventListener('click', () => explore());
$('exploreRestart').addEventListener('click', () => explore({ restart: true }));
addEventListener('explore-toytown', () => explore());
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

// ------------------------------------------------------------ the 3D map, loaded after the page works
function noMap(message) {
  const s = $('status'); if (s) s.textContent = message;
  document.querySelector('.note').hidden = true;
  $('descend').hidden = true;
}
// resolves true once the 3D map is running, false if the page is working without it
const world = Q.get('map') === 'off'
  ? Promise.resolve(false).then(() => { noMap('The 3D map is turned off. All the ways to help still work.'); return false; })
  : import('./main.js').then(() => true, (e) => {
    console.warn('3D map unavailable:', e);
    noMap('The 3D map could not load on this device. All the ways to help still work.');
    return false;
  });

world.then((ok) => { if (ok) document.body.classList.add('map-ready'); });   // map-only extras (e.g. "See it on the map")
// Milestone 1 spike: beats that name a shot are shown in the live 3D street (stills stay the fallback without 3D)
world.then((ok) => {
  if (!ok || !window.__natWorld || !window.__natWorld.oneTown) return;
  registerStage('shot', {
    show(scene) { $('story').classList.add('live'); document.body.classList.add('story-live'); window.__natWorld.shot(scene.shot); },
    hide() { $('story').classList.remove('live'); document.body.classList.remove('story-live'); },
  });
});

// test hooks (no effect for visitors)
window.__natShell = { world, finder, directory, selection, story };
