// "Find your local campaign" (Milestone 1, step 2): ZIP search → campaigns that serve it, nearby campaigns listed
// separately, a campaign card with the campaign's website. Plain DOM, no three.js; it works before and without the map.
// Campaign text is always set with textContent (never parsed as HTML).
//
// createFinder(root, { directory, officialUrl, collapsed }) → { open(), collapse(), showCampaign(id, context?) }
//   directory: a promise of loadDirectory()'s result (shared/campaigns.js)
//   showCampaign(id) opens the same card from anywhere (the map will use it in step 3).
import { normalizeZip, zipProblem, lookupZip } from '../../shared/campaigns.js';

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
  const pill = document.getElementById(root.dataset.pill);
  const form = $('form'), input = $('input[name="zip"]'), error = $('.finder-error'), out = $('.finder-out'), live = $('.finder-live');
  const hideBtn = $('.finder-hide'), testNote = $('.finder-test');
  let dir = null, last = null, opener = null;   // last: the latest lookup result; opener: the row that opened the card

  const officialLink = (text) => el('a', { class: 'finder-official', href: officialUrl, target: '_blank', rel: 'noopener noreferrer' },
    text, el('span', { class: 'sr', text: ' (official website, opens in a new tab)' }));
  const testTag = () => el('span', { class: 'tag', text: 'Test data' });
  const say = (t) => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  const busy = (on) => document.body.classList.toggle('finder-busy', on);

  function setCollapsed(c) {
    root.hidden = c; pill.hidden = !c;
    pill.setAttribute('aria-expanded', String(!c)); hideBtn.setAttribute('aria-expanded', String(!c));
    dispatchEvent(new Event('finderlayout'));
  }
  hideBtn.addEventListener('click', () => { setCollapsed(true); pill.focus(); });
  pill.addEventListener('click', () => { setCollapsed(false); input.focus(); });

  // ------------------------------------------------------------ directory ready / unavailable
  directory.then((d) => {
    if (d.status !== 'ready') {
      form.hidden = true; testNote.hidden = true;
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
    showResults(lookupZip(dir, zip));
  });
  root.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.try; form.requestSubmit(); }));

  function row(c, note, ctx) {
    const b = el('button', { type: 'button', class: 'finder-row-btn' },
      el('span', { class: 'finder-row-name', text: c.name }), el('span', { class: 'finder-row-note', text: note }));
    b.addEventListener('click', () => { opener = b; card(c, ctx); });
    return el('li', {}, b);
  }
  function showResults(r) {
    last = r; opener = null; busy(true);
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
    const back = el('button', { type: 'button', class: 'btn finder-back', text: last ? '← Back to results' : '← Back to search' });
    back.addEventListener('click', goBack);
    const head = el('h3', { class: 'finder-h', tabIndex: -1, id: 'finderCardName' }, c.name, dir.test ? testTag() : null);
    out.replaceChildren(el('article', { class: 'finder-card', 'aria-labelledby': 'finderCardName' },
      back, head, relation,
      el('dl', {},
        el('dt', { text: 'Area served' }), el('dd', { text: c.serves.label }),
        el('dt', { text: 'Based in' }), el('dd', { text: c.location.label })),
      el('a', { class: 'btn primary finder-site', href: c.website, target: '_blank', rel: 'noopener noreferrer' },
        'Visit the campaign’s website', el('span', { class: 'sr', text: ` (${host}, opens in a new tab)` })),
      el('p', { class: 'finder-fine', text: dir.test ? `Fictional campaign for testing. Its link goes to ${host}, a placeholder address.` : host })));
    head.focus();
  }
  function goBack() {
    if (last) { const o = opener && opener.querySelector('.finder-row-name').textContent; showResults(last);
      const again = o && [...out.querySelectorAll('.finder-row-btn')].find((b) => b.querySelector('.finder-row-name').textContent === o); if (again) again.focus(); }
    else { out.replaceChildren(); busy(false); input.focus(); }
  }
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && out.querySelector('.finder-card')) { e.preventDefault(); goBack(); } });

  if (collapsed) setCollapsed(true); else dispatchEvent(new Event('finderlayout'));
  return {
    open() { setCollapsed(false); if (!form.hidden) input.focus(); else out.querySelector('a')?.focus(); },
    collapse() { setCollapsed(true); },
    async showCampaign(id, ctx = null) {
      await directory; const c = dir && dir.byId.get(id); if (!c) return false;
      setCollapsed(false); opener = null; card(c, ctx); return true;
    },
  };
}
