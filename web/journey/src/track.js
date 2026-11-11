// Prototype measurement: an ordered event log per session, kept in this browser only.
// Nothing is sent anywhere. The research panel reads, summarises and exports it.
//
// Funnel milestones (in order) used to find where each session stopped:
const MILESTONES = [
  ['landing', 'Saw the landing'],
  ['world_enter', 'Entered the world'],
  ['village_arrive', 'Reached Toy Town'],
  ['discover', 'Opened the toy shop or started the story'],
  ['dropoff_open', 'Opened the drop-off search'],
  ['zip_submit', 'Searched a ZIP code'],
  ['results_shown', 'Saw drop-off results'],
  ['site_chosen', 'Chose a drop-off'],
];
const KEY = 'rh_journey_sessions_v1', PKEY = 'rh_journey_participant_v1', MAX_SESSIONS = 80;

const store = {
  read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } },
  write(all) { try { localStorage.setItem(KEY, JSON.stringify(all.slice(-MAX_SESSIONS))); } catch (e) { /* storage blocked: keep in memory */ } },
};
export function getParticipant() { try { return localStorage.getItem(PKEY) || ''; } catch (e) { return ''; } }
export function setParticipant(v) { try { localStorage.setItem(PKEY, v); } catch (e) {} }

export function pathOf(source) {
  if (!source) return null;
  if (source.startsWith('story')) return 'story';
  if (source.startsWith('explore')) return 'explore';
  return 'direct';
}

export function createTracker({ variant, tier, mapId }) {
  const t0 = performance.now();
  const session = {
    sid: Math.random().toString(36).slice(2, 10), participant: getParticipant() || null, variant, map: mapId,
    started: new Date().toISOString(),
    device: { w: innerWidth, h: innerHeight, touch: matchMedia('(pointer: coarse)').matches, tier, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches },
    events: [],
  };
  let all = store.read(); all.push(session); store.write(all);
  const listeners = new Set();
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { all = store.read().filter((s) => s.sid !== session.sid); all.push(session); store.write(all); }, 150);
  }
  function log(name, props = {}) {
    const e = { t: Math.round(performance.now() - t0), name, ...props };
    session.events.push(e); save();
    for (const f of listeners) f(e, session);
    return e;
  }
  addEventListener('pagehide', () => { log('session_end', { last: summarize(session).stoppedAt }); all = store.read().filter((s) => s.sid !== session.sid); all.push(session); store.write(all); });
  return {
    session, log, on: (f) => { listeners.add(f); return () => listeners.delete(f); },
    setParticipant(p) { session.participant = p || null; setParticipant(p); save(); },
  };
}

export function summarize(s) {
  const has = (n) => s.events.find((e) => e.name === n);
  const reached = {};
  reached.landing = has('landing');
  reached.world_enter = has('world_enter');
  reached.village_arrive = has('village_arrive');
  reached.discover = s.events.find((e) => (e.name === 'hotspot_open' && e.id === 'shop') || e.name === 'story_start');
  for (const k of ['dropoff_open', 'zip_submit', 'results_shown', 'site_chosen']) reached[k] = has(k);
  let stoppedAt = 'landing';
  for (const [k] of MILESTONES) if (reached[k]) stoppedAt = k;
  const open = has('dropoff_open');
  const dur = s.events.length ? s.events[s.events.length - 1].t : 0;
  const storyEnd = has('story_complete') || has('story_skip');
  return {
    sid: s.sid, participant: s.participant || '', variant: s.variant, map: s.map, started: s.started,
    path: open ? pathOf(open.source) : '', source: open ? open.source : '',
    timeToDropoffS: open ? +(open.t / 1000).toFixed(1) : null,
    chosen: !!reached.site_chosen, stoppedAt,
    storyStarted: !!has('story_start'), storyFinished: !!has('story_complete'), storySkipped: !!has('story_skip'),
    storyWatchedS: storyEnd && has('story_start') ? +((storyEnd.t - has('story_start').t) / 1000).toFixed(1) : null,
    hotspots: [...new Set(s.events.filter((e) => e.name === 'hotspot_open').map((e) => e.id))].join(' '),
    otherActions: [...new Set(s.events.filter((e) => e.name === 'action_click' && e.action !== 'dropoff').map((e) => e.action))].join(' '),
    giftPath: has('gift_open') ? pathOf((has('order_simulated') || has('gift_open')).source) : '',
    giftOrdered: !!has('order_simulated'),
    toysViewed: [...new Set(s.events.filter((e) => e.name === 'toy_select').map((e) => e.id))].join(' '),
    departureWatched: !!has('departure_complete') && has('departure_complete').reason === 'complete',
    usedFallback: !!has('fallback_shown'), events: s.events.length, durationS: +(dur / 1000).toFixed(1),
    touch: s.device.touch, screen: `${s.device.w}x${s.device.h}`,
  };
}
export const FUNNEL = MILESTONES;
export const allSessions = () => store.read();
export function clearSessions() { store.write([]); }
export function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
