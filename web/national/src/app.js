// National map page shell (Milestone 1, step 1). This small entry runs first and wires everything that must work
// without the 3D world: the "ways to help" bar and the page's dialogs. It does not import three.js or the map.
// The 3D map (main.js and three.js) is a separate chunk loaded right afterwards; if it cannot load (no WebGL, a
// network error, ?map=off) the page stays usable and says so. Same split as the Toy Town journey (journey.js +
// lazily imported world chunks).
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);

// placeholder actions (prototype): every [data-action] opens the "not connected yet" dialog
document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => { $('nyTitle').textContent = b.textContent; $('notyet').showModal(); }));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

function noMap(message) {
  const s = $('status'); if (s) s.textContent = message;
  document.querySelector('.note').hidden = true;
  $('descend').hidden = true;
}

// resolves true once the 3D map is running, false if the page is working without it
const world = Q.get('map') === 'off'
  ? Promise.resolve(false).then(() => { noMap('The 3D map is turned off. The ways to help above still work.'); return false; })
  : import('./main.js').then(() => true, (e) => {
    console.warn('3D map unavailable:', e);
    noMap('The 3D map could not load on this device. The ways to help above still work.');
    return false;
  });

// test hook (no effect for visitors)
window.__natShell = { world };
