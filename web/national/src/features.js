// Feature switches for the national page, declared by the page itself (no DOM changes needed elsewhere).
// State browsing (Milestone 1, step 3, stage 1) is preserved but OFF in the Phase 1 experience: the owner chose ZIP
// search as the way to find a campaign and the map as an immersive world, not a directory. It is on only when the
// finder declares data-state-browse="on". The code, the state shapes and the map projection all stay; the full feature
// is also kept on the branch preserve/state-browsing.
export const stateBrowsing = () => {
  const f = typeof document !== 'undefined' && document.getElementById('finder');
  return !!f && f.dataset.stateBrowse === 'on';
};

// The Maple Hollow descent and its Chapter 1 (national story, step 1) are kept intact but are not offered on the Phase 1
// landing: there is one story entrance, Explore Toy Town (decision 1 of the Phase 1 plan). The "Visit Maple Hollow"
// button and its map pin come back with data-maple-hollow="on" on #finder or ?maplehollow=1 (reviews, tests).
// ?chapter=1 still opens Chapter 1 directly, as before.
export const mapleHollow = () => {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('maplehollow') === '1') return true;
  const f = typeof document !== 'undefined' && document.getElementById('finder');
  return !!f && f.dataset.mapleHollow === 'on';
};
