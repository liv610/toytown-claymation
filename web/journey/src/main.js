// Railroad of Hope · Toy Town journey prototype — the orchestrator.
//
// Components (each knows only its own job; see docs/JOURNEY_PROTOTYPE.md):
//   action layer   index.html + this file's action wiring   works with no 3D at all
//   tracking       track.js / research.js                   local-only event log + observer panel
//   3D host        world/diorama.js                         renderer, set, camera moves, loop
//   map            world/map_diorama.js                     MapProvider: 'diorama' or the 2D 'flat' stand-in
//   village        world/village.js                         arrival, free look, hotspots, surprises
//   characters     world/marine_story.js                    the Marine's moment
//   fallback       fallback.js                              illustrated version of the same journey
import { createTracker, pathOf } from './track.js';
import { createResearch } from './research.js';
import { validZip, findDropoffs } from './actions/dropoff_data.js';
import { createFallback } from './fallback.js';
import { createGiftFlow } from './actions/gift.js';
import { renderDeliveryMap, animateDelivery } from './actions/delivery_map.js';
import { TOYS, WRAPS, areaOf, routeOf } from './actions/catalog.js';

const Q = new URLSearchParams(location.search);
// test conditions come from ?variant=… locally, or from a plain #name in an artifact link
// (#direct #explore #story #all #flat #simple #research); changing the hash reloads into that condition
const HASH = location.hash.slice(1);
const VARIANT = ['direct', 'explore', 'story', 'all'].includes(Q.get('variant')) ? Q.get('variant') : ['direct', 'explore', 'story'].includes(HASH) ? HASH : 'all';
const MAP_ID = Q.get('map') === 'flat' || HASH === 'flat' ? 'flat' : 'diorama';
addEventListener('hashchange', () => location.reload());
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ASSETS = window.TT_ASSETS || '../region/assets/';
const GIFT = window.TT_GIFT || '../../sequence/assets/gift.glb';
const STILLS = window.TT_STILLS || './assets/stills/';
const $ = (id) => document.getElementById(id);
const canWebGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
const wantsLite = Q.get('lite') === '1' || HASH === 'simple' || (() => { try { return sessionStorage.getItem('rh_lite') === '1'; } catch (e) { return false; } })();

// tier is decided before the 3D code loads, so the tracker can record it even for direct sessions
const tierGuess = (Q.get('q') && ['high', 'medium', 'low'].includes(Q.get('q'))) ? Q.get('q')
  : (navigator.deviceMemory || 8) <= 2 ? 'low' : (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700) ? 'medium' : 'high';
const tracker = createTracker({ variant: VARIANT, tier: tierGuess, mapId: MAP_ID });
const log = tracker.log;
const research = createResearch($('research'), tracker);
let state = 'landing';           // landing | entering | village | story | shop | departure | mapview | fallback
const setState = (s) => { state = s; document.body.dataset.state = s; };
setState('landing');
if (Q.get('capture') === '1') document.body.classList.add('capture');

// ------------------------------------------------------------------ toasts
let toastTimer = 0;
function toast(html, ms = 4200) {
  const t = $('toast'); t.innerHTML = html; t.hidden = false; clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  return t;
}

// ------------------------------------------------------------------ the action layer (no 3D needed)
const NOT_YET = {
  donate: ['Make a donation', 'In the live experience this opens the secure donation page directly, with no animation in between.'],
  request: ['Request toys for my family', 'In the live experience this goes straight to your local campaign’s request form. Families never need to enter the 3D world.'],
  campaign: ['Find my local campaign', 'In the live experience this finds your local campaign from your ZIP code, with ways to volunteer or run a toy drive.'],
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (b) {
    const action = b.dataset.action, source = b.dataset.source || 'direct-other';
    log('action_click', { action, source, context: state });
    if (action === 'dropoff') openDropoff(source);
    else if (action === 'gift') gift.open(source, b.dataset.toy);
    else openNotYet(action);
    return;
  }
  if (e.target.closest('[data-close]')) e.target.closest('dialog')?.close();
});
function openNotYet(action) {
  const [title, text] = NOT_YET[action];
  $('nyTitle').textContent = title; $('nyText').textContent = text;
  closeDialogs(); $('notyet').showModal();
}
function closeDialogs() { for (const d of document.querySelectorAll('dialog[open]')) d.close(); }

// ---- drop-off search
let dropStage = 'search', dropSource = '';
function openDropoff(source) {
  dropSource = source; dropStage = 'search';
  log('dropoff_open', { source, path: pathOf(source), context: state });
  $('results').innerHTML = ''; $('thanks').hidden = true; $('zipForm').hidden = false; $('zipErr').hidden = true;
  closeDialogs(); $('dropoff').showModal();
  setTimeout(() => $('zip').focus(), 30);
}
$('dropoff').addEventListener('close', () => log('dropoff_close', { stage: dropStage }));
$('zip').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); $('zipErr').hidden = true; });
$('zipForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const zip = $('zip').value.trim();
  if (!validZip(zip)) {
    $('zipErr').textContent = 'Enter a 5-digit ZIP code, like 10001.'; $('zipErr').hidden = false;
    log('zip_invalid', { length: zip.length }); $('zip').focus(); return;
  }
  log('zip_submit', { zip3: zip.slice(0, 3) }); window.__lastZip = zip;
  const sites = findDropoffs(zip);
  dropStage = 'results';
  log('results_shown', { count: sites.length });
  if (!sites.length) {
    $('results').innerHTML = `<p class="muted">No drop-off locations near ${zip} yet. Try a nearby ZIP code, or find your local campaign to ask about new locations.</p>
      <button type="button" class="btn" data-action="campaign" data-source="direct-noresults">Find my local campaign</button>`;
    return;
  }
  $('results').innerHTML = `<p class="muted">${sites.length} placeholder drop-offs near ${zip}</p>` + sites.map((s, i) => `
    <article class="site">
      <h3>${s.name}<span>${s.miles} mi</span></h3>
      <p>${s.address} · ${s.where}</p>
      <p>${s.hours} · collecting until ${s.until}</p>
      <div class="row"><button type="button" class="btn btn-primary" data-choose="${i}">I’ll drop off here</button>
        <button type="button" class="btn" data-directions="${i}">Directions</button></div>
    </article>`).join('');
  $('results').querySelectorAll('[data-choose]').forEach((b) => b.addEventListener('click', () => chooseSite(sites[+b.dataset.choose], +b.dataset.choose, zip)));
  $('results').querySelectorAll('[data-directions]').forEach((b) => b.addEventListener('click', () => {
    log('directions_click', { rank: +b.dataset.directions });
    b.textContent = 'Not connected in prototype'; b.disabled = true;
  }));
});
function chooseSite(site, rank, zip) {
  dropStage = 'thanks';
  log('site_chosen', { rank, miles: site.miles, source: dropSource, path: pathOf(dropSource) });
  $('zipForm').hidden = true; $('results').innerHTML = '';
  const t = $('thanks'); t.hidden = false;
  t.innerHTML = `<p class="big">Thank you for planning to give.</p>
    <p>${site.name} · ${site.address}<br>${site.hours} · until ${site.until}</p>
    <p class="muted">Bring a new, unwrapped toy. Prototype: nothing was saved or sent, and this location is a placeholder.</p>
    <div class="card-actions">${world.village ? '<button type="button" class="btn btn-primary" id="seeThanks">See your present in Toy Town</button>' : ''}<button type="button" class="btn" data-close>Done</button></div>`;
  if (world.village) {
    world.village.addPresent(); world.village.celebrate(1);
    $('seeThanks').onclick = () => { log('thanks_view'); closeDialogs(); showThanksInTown(); };
  }
}

// ------------------------------------------------------------------ variants
if (VARIANT === 'direct') { $('enterBlock').hidden = true; }
const storyAllowed = VARIANT === 'story' || VARIANT === 'all';
const shopAllowedNow = () => VARIANT !== 'story' || world.storyDone;
if (!storyAllowed) $('follow').hidden = true;

// ------------------------------------------------------------------ backdrop until (or instead of) the 3D world
const backdrop = $('backdrop');
backdrop.style.backgroundImage = `url(${STILLS}${VARIANT === 'direct' ? 'village' : 'map'}.jpg)`;

// ------------------------------------------------------------------ the 3D world (lazy, never blocks the actions)
const world = { host: null, map: null, village: null, story: null, pins: null, ready: null, progress: 0, storyDone: false };
function setEnterNote(text, p) { $('enterNote').textContent = text; if (p != null) $('enter').style.setProperty('--p', `${Math.round(p * 100)}%`); }

async function bootWorld() {
  if (world.ready) return world.ready;
  world.ready = (async () => {
    const t0 = performance.now();
    const { createDiorama, pickQuality } = await import('./world/diorama.js');
    const { createPins } = await import('./world/pins.js');
    const { createVillage } = await import('./world/village.js');
    const { createDioramaMap, createFlatMap } = await import('./world/map_diorama.js');
    const { createMarineStory } = await import('./world/marine_story.js');
    const host = await createDiorama({ container: $('stage'), base: ASSETS, b64: window.TT_B64, quality: pickQuality(Q.get('q')), preserve: Q.get('capture') === '1',
      onStatus: (msg, p) => { world.progress = p; if (state === 'landing') setEnterNote(p < 1 ? `Loading ${Math.round(p * 100)}%` : 'About 5 seconds to get there', p); } });
    world.host = host;
    const pins = createPins(host, $('pins')); world.pins = pins;
    world.village = createVillage(host, pins, { onHotspot, allowPin: (id) => id !== 'shop' || shopAllowedNow() });
    if (MAP_ID === 'flat') host.setPose(world.village.poses.sky);
    world.map = MAP_ID === 'flat' ? createFlatMap($('flatmap')) : createDioramaMap(host, pins);
    world.map.onSelect((place) => { log('map_select', { place }); enterTown('map-pin'); });
    const load = (n) => host.load(n === 'gift.glb' ? GIFT : n);
    world.story = await createMarineStory(host, world.village, { load, onBeat: onStoryBeat, onEnd: onStoryEnd });
    const { createToyShop } = await import('./world/toyshop.js');
    const { createDeparture } = await import('./world/departure.js');
    world.shop = createToyShop(host, pins, { windowImage: STILLS + 'village.jpg', onToy: (id) => onToy(id, 'pin') });
    world.departure = createDeparture(host, { onBeat: (i, text) => { $('captionText').textContent = text; log('departure_beat', { i }); }, onEnd: onDepartureEnd });
    world.shop.enter(); host.frame(1 / 60); world.shop.leave();           // compile the room's lighting once, up front
    if (storyAllowed) {
      pins.add({ id: 'marine', label: 'Follow the Marine', hint: 'watch a donated toy’s journey', icon: '★', getPos: world.story.headPos, onSelect: () => startStory('story-pin') });
      world.village.registerPin('marine', () => state === 'village');
    }
    world.village.showPins(false);
    host.warm([world.village.poses.overview, world.map.pose || world.village.poses.sky]);
    host.start();
    if (state === 'landing') await world.map.mount({ reducedMotion: true });
    $('pins').hidden = false;
    backdrop.style.opacity = '0';
    log('world_ready', { ms: Math.round(performance.now() - t0), tier: host.cfg.tier, kb: Math.round(Object.values(host.bytes).reduce((s, b) => s + b, 0) / 1024) });
    setEnterNote('About 5 seconds to get there', 1);
    return world;
  })().catch((err) => {
    console.error(err);
    log('world_error', { message: String(err.message || err).slice(0, 120) });
    showFallback('error');
    throw err;
  });
  return world.ready;
}

// ------------------------------------------------------------------ journey steps
async function enterTown(source = 'landing-button') {
  if (state === 'entering' || state === 'village' || state === 'story') return;
  log('world_enter', { source, ready: !!world.host });
  $('landing').hidden = true;
  setState('entering');
  if (!world.host) { toast('Toy Town is on its way… The ways to help above work right now.', 0); }
  try { await bootWorld(); } catch (e) { return; }
  $('toast').hidden = true;
  $('skipMove').hidden = false; $('worldui').hidden = false; $('follow').hidden = true; $('places').hidden = true; $('hint').hidden = true;
  const t0 = performance.now();
  const handoff = await world.map.enter('toytown', { reducedMotion: REDUCED });
  world.map.unmount && world.map.unmount();
  const skipped = handoff.pose && handoff.pose !== world.village.poses.arrival;
  log('handoff', { kind: handoff.kind, skipped: !!skipped, ms: Math.round(performance.now() - t0) });
  await world.village.enter(handoff, { reducedMotion: REDUCED || skipped });
  $('skipMove').hidden = true;
  arriveVillage(Math.round(performance.now() - t0));
}
function arriveVillage(ms) {
  setState('village');
  $('whereami').hidden = false; $('worldui').hidden = false; $('places').hidden = false; $('hint').hidden = false;
  $('follow').hidden = !storyAllowed;
  world.village.refreshPins();
  renderPlaces();
  log('village_arrive', { ms });
  if (VARIANT === 'story' && !world.storyDone) {
    showCard({ title: 'A toy has just been donated', body: '<p class="lede">A Marine is about to collect it. Want to see where it goes?</p>', id: 'story-invite',
      actions: [['Follow the Marine', () => startStory('story-invite'), true], ['Look around first', () => hideCard()]] });
  }
  samplePerf();
}
$('enter').addEventListener('click', () => enterTown('landing-button'));
$('skipMove').addEventListener('click', () => { log('skip_flight'); world.host && world.host.cancelMove('skip'); });
$('backToMap').addEventListener('click', async () => {
  log('back_to_map');
  hideCard(); stopStory();
  world.village.leave(); $('whereami').hidden = true; $('worldui').hidden = true;
  setState('landing'); $('landing').hidden = false;
  if (MAP_ID === 'flat') { world.host.setPose(world.village.poses.sky); }
  await world.map.mount({ reducedMotion: REDUCED });
});
$('follow').addEventListener('click', () => startStory('story-chip'));
$('simpleView').addEventListener('click', () => { log('simple_view_choose'); try { sessionStorage.setItem('rh_lite', '1'); } catch (e) {} showFallback('chosen'); });

function renderPlaces() {
  if (state === 'shop') {
    $('placesList').innerHTML = TOYS.map((t) => `<button type="button" data-toyplace="${t.id}">${t.name}</button>`).join('');
    $('placesList').querySelectorAll('[data-toyplace]').forEach((b) => b.addEventListener('click', () => { $('places').open = false; onToy(b.dataset.toyplace, 'places'); }));
    return;
  }
  const list = [['shop', 'Toy shop window', shopAllowedNow()], ['marine', 'Follow the Marine', storyAllowed], ['tree', 'Christmas tree', true], ['lamp', 'Lamppost', true]];
  $('placesList').innerHTML = list.filter((x) => x[2]).map(([id, label]) => `<button type="button" data-place="${id}">${label}</button>`).join('');
  $('placesList').querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => {
    $('places').open = false;
    if (b.dataset.place === 'marine') startStory('story-places'); else onHotspot(b.dataset.place, 'places');
  }));
}

// ---- hotspots (exploration path)
async function onHotspot(id, via = 'pin') {
  if (state !== 'village') return;
  log('hotspot_open', { id, via });
  if (id === 'shop') {
    world.village.showPins(false);
    showCard({ id: 'shop', title: 'The toy shop window',
      body: '<p class="lede">Every toy in this window is on its way to a child in Toy Town.</p><p>When you drop off a new, unwrapped toy near you, it’s given to a child in your own community.</p>',
      actions: [['Step inside the toy shop', () => enterShop('explore-shop-card'), true], ['Find a toy drop-off near you', null, false, 'explore-shop'], ['Keep exploring', () => { hideCard(); world.village.freeLook(); }]] });
    await world.village.focus('window', { reducedMotion: REDUCED });
  } else if (id === 'tree') {
    world.village.celebrate(1);
    toast('The whole town twinkles.', 2500);
  } else if (id === 'lamp') {
    const on = world.village.toggleLamp();
    toast(on ? 'Lamp on.' : 'Lamp off. Tap it again to light the street.', 2500);
  }
}

// ---- the Marine's moment (storytelling path)
let storyProgStop = null;
async function startStory(source) {
  if (!world.story || !storyAllowed) return;
  if (state !== 'village' && state !== 'story') return;
  hideCard();
  log('story_start', { source, replay: world.storyDone });
  setState('story');
  $('worldui').hidden = true; $('caption').hidden = false; $('captionText').textContent = '';
  world.story.reset();
  storyProgStop && storyProgStop();
  storyProgStop = world.host.onUpdate(() => { $('storyProg').style.width = `${(100 * Math.max(0, world.story.time) / world.story.duration).toFixed(1)}%`; });
  await world.story.start({ reducedMotion: REDUCED });
}
function onStoryBeat(i, text) { $('captionText').textContent = text; log('story_beat', { i }); }
function onStoryEnd(reason) {
  world.storyDone = true;
  log('story_complete', { reason });
  storyProgStop && storyProgStop(); storyProgStop = null;
  $('caption').hidden = true;
  setState('village');
  $('worldui').hidden = false;
  renderPlaces();
  showCard({ id: 'story-end', title: 'Toys given here stay close to home',
    body: '<p class="lede">A new, unwrapped toy left at a drop-off near you goes to a child in your own community.</p>',
    actions: [['Find a toy drop-off near you', null, true, 'story-end'], ['Watch again', () => startStory('story-replay')], ['Look around', () => { hideCard(); world.village.freeLook(); }]] });
}
$('skipStory').addEventListener('click', () => { if (state !== 'story') return; log('story_skip', { at: +world.story.time.toFixed(1) }); world.story.skip(); });
function stopStory() { if (world.story && world.story.running) { log('story_abandon', { at: +world.story.time.toFixed(1) }); world.story.stop(); world.story.reset(); } $('caption').hidden = true; }

async function showThanksInTown() {
  if (state === 'landing') { await enterTown('thanks'); }
  if (state !== 'village') return;
  hideCard(); await world.village.focus('tree', { reducedMotion: REDUCED }); world.village.celebrate(1);
  showCard({ id: 'thanks', title: 'A present for Toy Town', body: '<p class="lede">This present stands for your plan to give. It isn’t a real delivery.</p>',
    actions: [['Look around', () => { hideCard(); world.village.freeLook(); }]] });
}

// ---- discovery card
function showCard({ id, title, body, actions }) {
  $('cardTitle').textContent = title; $('cardBody').innerHTML = body; $('card').dataset.card = id;
  $('cardActions').innerHTML = '';
  for (const [label, fn, primary, source, action = 'dropoff', toy] of actions) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (primary ? ' btn-primary' : ''); b.textContent = label;
    if (source) { b.dataset.action = action; b.dataset.source = source; if (toy) b.dataset.toy = toy; } else b.addEventListener('click', fn);
    $('cardActions').appendChild(b);
  }
  $('card').hidden = false;
  log('card_show', { id });
}
function hideCard() { if (!$('card').hidden) log('card_close', { id: $('card').dataset.card }); $('card').hidden = true; }
$('cardClose').addEventListener('click', () => { hideCard(); if (state === 'village' && world.village) world.village.freeLook(); });

// ---- device check: offer the simple view if 3D is struggling
function samplePerf() {
  setTimeout(() => {
    if (!world.host) return;
    const fps = Math.round(world.host.fps());
    log('perf', { fps, tier: world.host.cfg.tier });
    if (fps && fps < 15) {
      const t = toast(`3D is running slowly on this device (${fps} fps). <button type="button" class="btn" id="toLite">Use the simple view</button>`, 9000);
      t.querySelector('#toLite').onclick = () => { log('simple_view_choose', { from: 'perf' }); showFallback('slow'); };
    }
  }, 4000);
}

// ------------------------------------------------------------------ the toy shop interior (send a toy online)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function fadeThrough(fn) {
  const f = $('fade');
  if (REDUCED) { await fn(); return; }
  f.classList.add('on'); await wait(380); await fn(); await wait(80); f.classList.remove('on');
}
function worldChrome(where) {
  const inShop = where === 'shop';
  $('placeName').textContent = inShop ? 'The Toy Shop' : 'Toy Town';
  $('backToMap').hidden = inShop; $('backToStreet').hidden = !inShop;
  $('follow').hidden = inShop || !storyAllowed;
  $('hint').textContent = inShop ? 'Tap a toy to see it come alive' : 'Drag to look around · tap a glowing marker';
  renderPlaces();
}
async function enterShop(source) {
  if (!world.shop || state !== 'village') return;
  log('shop_enter', { source });
  hideCard();
  await fadeThrough(() => { world.village.leave(); world.shop.enter(); });
  setState('shop'); worldChrome('shop');
  $('worldui').hidden = false; $('whereami').hidden = false;
}
async function leaveShop() {
  log('shop_leave');
  hideCard();
  await fadeThrough(() => { world.shop.leave(); world.host.setPose(world.village.poses.window); });
  setState('village'); worldChrome('village');
  world.village.freeLook();
}
$('backToStreet').addEventListener('click', leaveShop);
async function onToy(id, via) {
  if (state !== 'shop') return;
  const t = TOYS.find((x) => x.id === id);
  log('toy_select', { id, via });
  showCard({ id: 'toy-' + id, title: t.name, body: `<p class="lede">${t.blurb}</p><p>Ages ${t.ages} · placeholder price ${t.price}</p>`,
    actions: [['Give this toy to a child', null, true, 'explore-shop-interior', 'gift', id],
      ['Play again', () => { log('toy_play', { id }); world.shop.play(id); }],
      ['Back to the shelves', () => { hideCard(); world.shop.overview({ reducedMotion: REDUCED }); }]] });
  await world.shop.focus(id, { reducedMotion: REDUCED });
}

// ---- the gift flow itself (plain HTML; the 3D parts are optional extras)
const gift = createGiftFlow({ $, log, pathOf, stills: STILLS, reducedMotion: REDUCED,
  canWatch: () => !!(world.departure && world.host && state !== 'fallback'),
  onWatch: (order) => startDeparture(order),
  onDone: () => { if (world.village) { world.village.addPresent(); } } });

// ---- the station departure, then the line map
let lastOrder = null;
async function startDeparture(order) {
  lastOrder = order;
  if (!world.departure) { showMapView(order); return; }
  log('departure_start', { route: routeOf(order.zip), from: state });
  hideCard(); stopStory();
  $('landing').hidden = true;
  await fadeThrough(() => {
    if (world.shop.mounted) world.shop.leave();
    if (world.map && world.map.unmount) world.map.unmount();
    world.village.leave();
    world.departure.start(routeOf(order.zip), WRAPS.find((w) => w.id === order.wrap).color);
  });
  setState('departure');
  $('worldui').hidden = true; $('whereami').hidden = true; $('backdrop').style.opacity = '0';
  $('caption').hidden = false; $('caption').dataset.mode = 'departure'; $('captionText').textContent = '';
  storyProgStop && storyProgStop();
  storyProgStop = world.host.onUpdate(() => { $('storyProg').style.width = `${(100 * Math.max(0, world.departure.time) / world.departure.duration).toFixed(1)}%`; });
}
function onDepartureEnd(reason) {
  log('departure_complete', { reason });
  storyProgStop && storyProgStop(); storyProgStop = null;
  $('caption').hidden = true; delete $('caption').dataset.mode;
  showMapView(lastOrder);
}
async function showMapView(order) {
  setState('mapview');
  if (world.host) world.host.setPaused(true);
  const el = $('dmapFull'); renderDeliveryMap(el);
  $('mapview').hidden = false; $('mvText').textContent = '';
  const a = areaOf(order.zip);
  $('mvActions').innerHTML = '';
  log('delivery_map', { area: +order.zip[0], where: 'full' });
  await animateDelivery(el, order.zip, { reducedMotion: REDUCED });
  $('mvText').textContent = `Your toy has reached ${a.name}. The local campaign there gives it to a child. (Prototype: symbolic only, no real delivery.)`;
  const add = (label, fn, primary) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (primary ? ' btn-primary' : ''); b.textContent = label; b.addEventListener('click', fn); $('mvActions').appendChild(b); };
  if (world.village) add('Back to Toy Town', backFromMapView, true);
  add('Send another toy', () => { log('gift_again'); gift.open(order.source); }, !world.village);
  add('Find a toy drop-off', () => openDropoff('direct-mapview'), false);
}
async function backFromMapView() {
  log('mapview_back');
  $('mapview').hidden = true;
  world.host.setPaused(false);
  await fadeThrough(() => { world.host.setPose(world.village.poses.tree); });
  setState('village'); worldChrome('village');
  $('worldui').hidden = false; $('whereami').hidden = false;
  world.village.celebrate(1); world.village.freeLook();
}
$('skipStory').addEventListener('click', () => { if (state === 'departure') { log('departure_skip', { at: +world.departure.time.toFixed(1) }); world.departure.skip(); } }, true);

// ------------------------------------------------------------------ illustrated fallback
let fallback = null;
function showFallback(reason) {
  log('fallback_shown', { reason });
  setState('fallback');
  if (world.host) world.host.setPaused(true);
  $('landing').hidden = true; $('worldui').hidden = true; $('whereami').hidden = true; $('caption').hidden = true; $('pins').hidden = true; hideCard();
  fallback = fallback || createFallback($('fbInner'), { stills: STILLS, variant: VARIANT, log, onUse3D: canWebGL ? () => { try { sessionStorage.removeItem('rh_lite'); } catch (e) {} location.reload(); } : null });
  $('fallback').hidden = false;
}

// ------------------------------------------------------------------ start
addEventListener('keydown', (e) => { if (e.shiftKey && e.key === 'R') research.toggle(); if (e.key === 'Escape' && !$('card').hidden) { hideCard(); world.village && state === 'village' && world.village.freeLook(); } });
$('openResearch').addEventListener('click', () => research.toggle());
if (Q.get('research') === '1' || HASH === 'research') research.open();
log('landing', { variant: VARIANT });
if (VARIANT !== 'direct') {
  if (!canWebGL) showFallback('no-webgl');
  else if (wantsLite) showFallback('lite');
  else if (window.requestIdleCallback) requestIdleCallback(() => bootWorld().catch(() => {}), { timeout: 600 });
  else setTimeout(() => bootWorld().catch(() => {}), 200);
}
// test hooks for the automated walkthrough (no effect for visitors)
window.__journey = { world, enterTown, startStory, onHotspot, openDropoff, enterShop, onToy, gift, startDeparture, state: () => state, tracker };
