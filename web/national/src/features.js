// Feature switches for the national page, declared by the page itself (no DOM changes needed elsewhere).
// State browsing (Milestone 1, step 3, stage 1) is preserved but OFF in the Phase 1 experience: the owner chose ZIP
// search as the way to find a campaign and the map as an immersive world, not a directory. It is on only when the
// finder declares data-state-browse="on". The code, the state shapes and the map projection all stay; the full feature
// is also kept on the branch preserve/state-browsing.
export const stateBrowsing = () => {
  const f = typeof document !== 'undefined' && document.getElementById('finder');
  return !!f && f.dataset.stateBrowse === 'on';
};
