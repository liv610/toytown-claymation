// "Send a toy online": pick a toy → wrapping + community (ZIP) → placeholder checkout → thank-you.
// Plain HTML, so it works on the direct path and in the simple view. When the 3D world is loaded
// the thank-you offers "watch it leave Toy Town" (the station departure); otherwise the line map
// animates right here in the dialog.
import { TOYS, WRAPS, areaOf } from './catalog.js';
import { validZip } from './dropoff_data.js';
import { renderDeliveryMap, animateDelivery } from './delivery_map.js';

export function createGiftFlow({ $, log, pathOf, stills, canWatch, onWatch, onDone, reducedMotion }) {
  const dlg = $('gift');
  let order = null, stage = 'pick';
  const steps = ['gfPick', 'gfDetail', 'gfCheckout', 'gfDone'];
  const show = (id) => { steps.forEach((s) => { $(s).hidden = s !== id; }); stage = id.slice(2).toLowerCase(); };
  const toyImg = (id) => `${stills}toy_${id}.jpg`;

  $('toyGrid').innerHTML = TOYS.map((t) => `
    <button type="button" class="toycard" data-toy="${t.id}">
      <img src="${toyImg(t.id)}" alt="" loading="lazy"><strong>${t.name}</strong><span>Ages ${t.ages} · ${t.price}</span>
    </button>`).join('');
  $('toyGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-toy]'); if (b) { log('toy_select', { id: b.dataset.toy, via: 'catalogue' }); detail(b.dataset.toy); } });
  $('wrapRow').innerHTML = WRAPS.map((w, i) => `<button type="button" class="swatch" data-wrap="${w.id}" aria-pressed="${i === 0}" style="--sw:${w.css}"><i></i>${w.label}</button>`).join('');
  $('wrapRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-wrap]'); if (!b) return;
    $('wrapRow').querySelectorAll('[data-wrap]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    order.wrap = b.dataset.wrap; log('gift_wrap', { wrap: order.wrap });
  });

  function detail(toyId) {
    const t = TOYS.find((x) => x.id === toyId);
    order.toy = t.id;
    $('gfToy').innerHTML = `<img src="${toyImg(t.id)}" alt=""><div><h3>${t.name}</h3><p>${t.blurb}</p><p>Ages ${t.ages} · placeholder price ${t.price}</p></div>`;
    $('gfZip').value = window.__lastZip || ''; $('gfZipErr').hidden = true;
    show('gfDetail');
    setTimeout(() => $('gfZip').focus(), 30);
  }
  $('gfZip').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); $('gfZipErr').hidden = true; });
  $('gfBack').addEventListener('click', () => show('gfPick'));
  $('gfDetail').addEventListener('submit', (e) => {
    e.preventDefault();
    const zip = $('gfZip').value.trim();
    if (!validZip(zip)) { $('gfZipErr').textContent = 'Enter the 5-digit ZIP code of the community you’d like to help, like 60601.'; $('gfZipErr').hidden = false; log('zip_invalid', { flow: 'gift' }); return; }
    order.zip = zip; window.__lastZip = zip;
    const t = TOYS.find((x) => x.id === order.toy), w = WRAPS.find((x) => x.id === order.wrap);
    $('coSummary').innerHTML = `<strong>${t.name}</strong>, wrapped in ${w.label.toLowerCase()} · for the local campaign serving ZIP ${zip} · placeholder price ${t.price}`;
    log('checkout_open', { toy: order.toy, wrap: order.wrap, zip3: zip.slice(0, 3) });
    show('gfCheckout');
  });
  $('coBack').addEventListener('click', () => show('gfDetail'));
  $('coDone').addEventListener('click', () => {
    log('order_simulated', { toy: order.toy, wrap: order.wrap, zip3: order.zip.slice(0, 3), area: +order.zip[0], source: order.source, path: pathOf(order.source) });
    const t = TOYS.find((x) => x.id === order.toy), a = areaOf(order.zip);
    $('doneText').innerHTML = `Your ${t.name.toLowerCase()} will go to the local campaign serving ZIP ${order.zip}, in ${a.name}, who give it to a child there. <span class="muted">Prototype: nothing was ordered or charged, and no real delivery will happen.</span>`;
    show('gfDone');
    const acts = $('doneActions'); acts.innerHTML = '';
    const btn = (label, fn, primary) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (primary ? ' btn-primary' : ''); b.textContent = label; b.addEventListener('click', fn); acts.appendChild(b); return b; };
    const done = { ...order };
    if (canWatch()) {
      $('dmapInline').hidden = true;
      btn('Watch it leave Toy Town', () => { log('departure_choose'); dlg.close(); onWatch(done); }, true);
      btn('Just show me the map', () => { log('map_choose'); inlineMap(done); acts.firstChild.remove(); acts.firstChild.remove(); finishButtons(btn); });
    } else { inlineMap(done); finishButtons(btn); }
    onDone && onDone(done);
  });
  function finishButtons(btn) {
    btn('Send another toy', () => open(order.source), false);
    btn('Done', () => dlg.close(), false);
  }
  function inlineMap(o) {
    const el = $('dmapInline'); el.hidden = false; renderDeliveryMap(el);
    log('delivery_map', { area: +o.zip[0], where: 'dialog' });
    animateDelivery(el, o.zip, { reducedMotion });
  }
  dlg.addEventListener('close', () => log('gift_close', { stage }));

  function open(source, toyId) {
    order = { source, wrap: WRAPS[0].id };
    $('wrapRow').querySelectorAll('[data-wrap]').forEach((x, i) => x.setAttribute('aria-pressed', i === 0));
    log('gift_open', { source, path: pathOf(source), toy: toyId || null });
    for (const d of document.querySelectorAll('dialog[open]')) if (d !== dlg) d.close();
    if (toyId) detail(toyId); else show('gfPick');
    if (!dlg.open) dlg.showModal();
  }
  return { open };
}
