// "Find your local campaign" (Milestone 1, step 2): ZIP search → campaigns that serve it, nearby campaigns listed
// separately, a campaign card with the campaign's website. Plain DOM, no three.js; it works before and without the map.
// Campaign text is always set with textContent (never parsed as HTML).
//
// createFinder(root, { directory, officialUrl, collapsed }) → { open(), collapse(), showCampaign(id, context?) }
//   directory: a promise of loadDirectory()'s result (shared/campaigns.js)
//   showCampaign(id) opens the same card from anywhere (the map will use it).
// The card always shows the shared selection (selection.js): choosing a campaign selects it, the card follows, and
// "Back" clears it. The 3D map follows the same selection; the finder never talks to the map directly.
// Browsing by state (step 3, stage 1): the state list here, or a click on the map, sets selection.browse(code); the
// finder then lists the campaigns based in that state. Browsing never selects a campaign by itself.
import { normalizeZip, zipProblem, lookupZip, campaignsInState } from '../../shared/campaigns.js';
import { US_STATES, stateByCode } from '../../shared/us_states.js';
import { selection } from './selection.js';
import { stateBrowsing } from './features.js';

const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v); }
  for (const k of kids) if (k != null && k !== false) e.append(k);
  return e;
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const ERRORS = { empty: 'Enter your 5-digit ZIP code.', format: 'A ZIP code has 5 numbers, like 12345.' };

export function createFinder(root, { directory, officialUrl, collapsed = false }) {
  const $ = (sel) => root.querySelector(sel);
  const toggles = [...document.querySelectorAll('[data-action="campaign"]')];   // the top-bar "Find Local Campaign" reopens the finder
  const form = $('form'), input = $('input[name="zip"]'), error = $('.finder-error'), out = $('.finder-out'), live = $('.finder-live');
  const hideBtn = $('.finder-hide'), testNote = $('.finder-test');
  const stateSel = $('.finder-browse select');
  let dir = null, last = null, opener = null;   // last: the list the card was opened from ({ zip } or { state }); opener: its row

  const officialLink = (text) => el('a', { class: 'finder-official', href: officialUrl, target: '_blank', rel: 'noopener noreferrer' },
    text, el('span', { class: 'sr', text: ' (official website, opens in a new tab)' }));
  const testTag = () => el('span', { class: 'tag', text: 'Test data' });
  const say = (t) => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  const busy = (on) => document.body.classList.toggle('finder-busy', on);

  function setCollapsed(c) {
    root.hidden = c; hideBtn.setAttribute('aria-expanded', String(!c));
    const cur = selection.get();
    for (const t of toggles) {
      t.setAttribute('aria-expanded', String(!c));
      t.classList.toggle('has-card', c && !!cur);                  // a small mark: the finder is holding a campaign card
      if (c && cur) t.setAttribute('aria-description', `${cur.campaign.name} is open in the finder`); else t.removeAttribute('aria-description');
    }
    dispatchEvent(new Event('finderlayout'));
  }
  const focusTop = () => (toggles.find((t) => t.offsetParent) || toggles[0]).focus();
  hideBtn.addEventListener('click', () => { setCollapsed(true); focusTop(); });

  // ------------------------------------------------------------ directory ready / unavailable
  directory.then((d) => {
    if (d.status !== 'ready') {
      form.hidden = true; testNote.hidden = true; $('.finder-browse').hidden = true;
      out.replaceChildren(el('div', { class: 'finder-msg' },
        el('p', { text: 'Campaign search isn’t connected on this page yet.' }),
        officialLink('Find your local campaign on the official Toys for Tots website')));
      return;
    }
    dir = d; testNote.hidden = !d.test;
  });

  // ------------------------------------------------------------ search
  function showError(kind) {
    error.textContent = ERRORS[kind]; error.hidden = false; input.setAttribute('aria-invalid', 'true');
  }
  function clearError() { error.hidden = true; error.textContent = ''; input.removeAttribute('aria-invalid'); }
  input.addEventListener('input', () => { if (!error.hidden && !zipProblem(input.value)) clearError(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const problem = zipProblem(input.value);
    if (problem) { showError(problem); input.focus(); return; }
    clearError();
    if (!dir) { await directory; if (!dir) return; }
    const zip = normalizeZip(input.value); input.value = zip;
    quiet = true; selection.clear(); selection.browse(null); quiet = false;   // a new search replaces any open card or state list
    const r = lookupZip(dir, zip);
    showResults(r);
    if (r.outcome === 'serving' && r.serving.length === 1) {      // exactly one campaign serves it: straight to its card
      last.auto = true; opener = out.querySelector('.finder-row-btn');
      selection.select(r.serving[0], { via: 'search', kind: 'serving', zip });
      say(`${r.serving[0].name} serves ZIP code ${zip}.` + (r.nearby.length ? ` ${plural(r.nearby.length, 'nearby campaign', 'nearby campaigns')} also listed under Back to results.` : ''));
    }
  });
  root.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.try; form.requestSubmit(); }));

  function row(c, note, ctx) {
    const b = el('button', { type: 'button', class: 'finder-row-btn' },
      el('span', { class: 'finder-row-name', text: c.name }), el('span', { class: 'finder-row-note', text: note }));
    b.addEventListener('click', () => { opener = b; selection.select(c, { via: ctx.kind === 'state' ? 'state' : 'search', ...ctx }); });
    return el('li', {}, b);
  }
  function showResults(r) {
    last = { zip: r }; opener = null; busy(true);
    const head = el('h3', { class: 'finder-h', tabIndex: -1 }, `ZIP code ${r.zip}`, dir.test ? testTag() : null);
    const parts = [head];
    if (r.outcome === 'serving') {
      parts.push(el('h4', { class: 'finder-sub', text: r.serving.length === 1 ? 'The campaign that serves this ZIP code' : 'Campaigns that serve this ZIP code' }),
        el('ul', { class: 'finder-list' }, ...r.serving.map((c) => row(c, c.serves.label, { kind: 'serving', zip: r.zip }))));
    } else {
      parts.push(el('p', { class: 'finder-msg', text: r.outcome === 'none'
        ? (dir.test ? 'No campaign in the test data serves this ZIP code.' : 'We couldn’t find a campaign that serves this ZIP code.')
        : (dir.test ? 'This ZIP code isn’t in the test data.' : 'We don’t have campaign information for this ZIP code.') }));
    }
    if (r.nearby.length) {
      parts.push(el('h4', { class: 'finder-sub', text: 'Nearby campaigns' }),
        el('p', { class: 'finder-fine', text: 'Close by, but they may not serve your ZIP code. Check with the campaign first.' }),
        el('ul', { class: 'finder-list' }, ...r.nearby.map((n) => row(n.campaign, `About ${Math.round(n.miles)} miles away · ${n.campaign.location.label}`, { kind: 'nearby', zip: r.zip, miles: n.miles }))));
    }
    if (r.outcome !== 'serving') parts.push(el('p', { class: 'finder-fine' }, officialLink('Search the official campaign finder')));
    out.replaceChildren(...parts);
    head.focus();
    say(r.outcome === 'serving' ? `${plural(r.serving.length, 'campaign serves', 'campaigns serve')} ZIP code ${r.zip}.` + (r.nearby.length ? ` ${plural(r.nearby.length, 'nearby campaign', 'nearby campaigns')} also listed.` : '')
      : `No campaign found that serves ZIP code ${r.zip}.` + (r.nearby.length ? ` ${plural(r.nearby.length, 'nearby campaign', 'nearby campaigns')} listed.` : ''));
  }

  // ------------------------------------------------------------ campaign card (reused by the map in step 3)
  function card(c, ctx = null) {
    busy(true);
    const host = new URL(c.website).hostname;
    const relation = ctx && ctx.kind === 'serving' ? el('p', { class: 'finder-rel serving', text: `Serves ZIP code ${ctx.zip}` })
      : ctx && ctx.kind === 'nearby' ? el('p', { class: 'finder-rel nearby', text: `Nearby: about ${Math.round(ctx.miles)} miles from ZIP code ${ctx.zip}. It may not serve that ZIP code.` }) : null;
    const backTo = !last ? '← Back to search' : last.state ? `← Back to ${stateByCode.get(last.state).name}` : last.auto && !last.zip.nearby.length ? '← New search' : '← Back to results';
    const back = el('button', { type: 'button', class: 'btn finder-back', text: backTo });
    back.addEventListener('click', () => selection.clear());
    const head = el('h3', { class: 'finder-h', tabIndex: -1, id: 'finderCardName' }, c.name, dir.test ? testTag() : null);
    out.replaceChildren(el('article', { class: 'finder-card', 'aria-labelledby': 'finderCardName' },
      back, head, relation,
      el('dl', {},
        el('dt', { text: 'Area served' }), el('dd', { text: c.serves.label }),
        el('dt', { text: 'Based in' }), el('dd', { text: c.location.label })),
      el('div', { class: 'finder-card-actions' },
        el('a', { class: 'btn primary finder-site', href: c.website, target: '_blank', rel: 'noopener noreferrer' },
          'Visit the campaign’s website', el('span', { class: 'sr', text: ` (${host}, opens in a new tab)` })),
        seeMap()),
      el('p', { class: 'finder-fine', text: dir.test ? `Fictional campaign for testing. Its link goes to ${host}, a placeholder address.` : host })));
    head.focus();
  }
  // the card follows the shared selection
  let quiet = false;
  selection.subscribe((cur) => { if (cur) card(cur.campaign, cur); else if (!quiet && out.querySelector('.finder-card')) goBack(); });
  // ------------------------------------------------------------ browse by state (off unless the page turns it on: features.js)
  if (stateBrowsing()) {
    $('.finder-browse').hidden = false;
    for (const st of US_STATES) stateSel.append(el('option', { value: st.code, text: st.name }));
    stateSel.addEventListener('change', () => selection.browse(stateSel.value || null, { via: 'list' }));
    selection.onRegion(async (reg) => {
      if (!reg) { stateSel.value = ''; if (!quiet && last && last.state && !out.querySelector('.finder-card')) { out.replaceChildren(); busy(false); last = null; } return; }
      if (!dir) { await directory; if (!dir) return; }
      quiet = true; selection.clear(); quiet = false;
      setCollapsed(false); stateSel.value = reg.code;
      showState(reg.code, { focus: reg.via === 'map' });   // keep focus on the list while someone arrows through it
    });
  }
  function showState(code, { focus = true } = {}) {
    const st = stateByCode.get(code), list = campaignsInState(dir, code);
    last = { state: code }; opener = null; busy(true);
    const head = el('h3', { class: 'finder-h', tabIndex: -1 }, st.name, dir.test ? testTag() : null);
    const parts = [head];
    if (!list.length) {
      parts.push(el('p', { class: 'finder-msg', text: dir.test ? `No campaigns in the test data are based in ${st.name}.` : `We don’t have campaigns listed for ${st.name}.` }),
        el('p', { class: 'finder-fine' }, officialLink('Search the official campaign finder')));
    } else {
      const count = el('p', { class: 'finder-fine finder-count', text: `${plural(list.length, 'campaign', 'campaigns')} based in ${st.name}${dir.test ? ' (test data)' : ''}.` });
      const ul = el('ul', { class: 'finder-list', id: 'stateList' }, ...list.map((c) => row(c, c.location.label, { kind: 'state', state: code })));
      parts.push(count);
      if (list.length > 1) {
        const filter = el('input', { type: 'search', class: 'finder-filter', id: 'stateFilter', autocomplete: 'off', 'aria-controls': 'stateList', 'aria-describedby': 'stateCount' });
        filter.addEventListener('input', () => {
          const q = filter.value.trim().toLowerCase(); let shown = 0;
          for (const li of ul.children) { const hit = !q || li.textContent.toLowerCase().includes(q); li.hidden = !hit; shown += hit; }
          count.textContent = q ? `Showing ${shown} of ${list.length} campaigns in ${st.name}.` : `${plural(list.length, 'campaign', 'campaigns')} based in ${st.name}${dir.test ? ' (test data)' : ''}.`;
        });
        count.id = 'stateCount';
        parts.push(el('label', { class: 'finder-filter-label', for: 'stateFilter', text: `Filter ${st.name}’s campaigns` }), filter);
      }
      parts.push(ul, el('p', { class: 'finder-fine', text: 'Listed by where each campaign is based, which may not match the area it serves. To find the campaign for an address, search its ZIP code.' }));
    }
    out.replaceChildren(...parts);
    if (focus) head.focus();
    say(list.length ? `${st.name}: ${plural(list.length, 'campaign', 'campaigns')}.` : `${st.name}: no campaigns listed.`);
  }

  // narrow screens with the map running: tuck the finder away to see the campaign on the map ("Find Local Campaign" brings it back)
  function seeMap() {
    const b = el('button', { type: 'button', class: 'btn finder-seemap', text: 'See it on the map' });
    b.addEventListener('click', () => { setCollapsed(true); focusTop(); });
    return b;
  }
  function goBack() {
    if (last && last.auto && !last.zip.nearby.length) { last = null; out.replaceChildren(); busy(false); input.focus(); input.select(); return; }   // nothing else to show: back to the ZIP field
    if (last) { const o = opener && opener.querySelector('.finder-row-name').textContent; if (last.state) showState(last.state); else showResults(last.zip);
      const again = o && [...out.querySelectorAll('.finder-row-btn')].find((b) => b.querySelector('.finder-row-name').textContent === o); if (again) again.focus(); }
    else { out.replaceChildren(); busy(false); input.focus(); }
  }
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && out.querySelector('.finder-card')) { e.preventDefault(); selection.clear(); } });

  if (collapsed) setCollapsed(true); else dispatchEvent(new Event('finderlayout'));
  return {
    open() { setCollapsed(false); const h = out.querySelector('#finderCardName'); if (h) h.focus(); else if (!form.hidden) input.focus(); else out.querySelector('a')?.focus(); },
    collapse() { setCollapsed(true); },
    async showCampaign(id, ctx = {}) {
      await directory; const c = dir && dir.byId.get(id); if (!c) return false;
      setCollapsed(false); opener = null; selection.select(c, { via: 'link', ...ctx }); return true;
    },
  };
}
