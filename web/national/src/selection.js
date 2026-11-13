// The one place that knows which campaign is selected (Milestone 1, step 3). No DOM, no three.js.
// The finder writes to it (a search result, later a map click); the finder's card and the 3D map both follow it.
// Because esbuild puts this module in the chunk shared by the page shell and the lazily loaded map, both get the
// same instance.
//   selection.select(campaign, { via: 'search' | 'map' | 'link', zip, kind: 'serving' | 'nearby', miles })
//   selection.clear()
//   selection.get()     → { id, campaign, via, zip, kind, miles } or null
//   selection.subscribe(fn) → unsubscribe; fn(current, previous) on every change
// It also holds the state being browsed (a postal code such as 'OH', or null): a separate value, because browsing a
// state never selects a campaign. Set by the finder's state list or a click on the map; both follow it.
//   selection.browse(code | null, { via: 'list' | 'map' })
//   selection.region() → { code, via } or null
//   selection.onRegion(fn) → unsubscribe; fn(region, previous)
const listeners = new Set(), regionListeners = new Set();
let current = null, region = null;

export const selection = {
  get: () => current,
  select(campaign, context = {}) {
    const previous = current;
    current = Object.freeze({ id: campaign.id, campaign, via: context.via || 'search', zip: context.zip || null, kind: context.kind || null, miles: context.miles ?? null });
    for (const fn of listeners) fn(current, previous);
  },
  clear() {
    if (!current) return;
    const previous = current; current = null;
    for (const fn of listeners) fn(null, previous);
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  region: () => region,
  browse(code, context = {}) {
    if (!region && !code) return;                    // browsing the same state again is passed on (the map re-frames it)
    const previous = region; region = code ? Object.freeze({ code, via: context.via || 'list' }) : null;
    for (const fn of regionListeners) fn(region, previous);
  },
  onRegion(fn) { regionListeners.add(fn); return () => regionListeners.delete(fn); },
};
