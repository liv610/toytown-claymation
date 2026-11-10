// The observer's panel: participant label, test-condition links, live event log, funnel by path,
// one row per session and exports. Opened from "Test log" in the footer, ?research=1, or Shift+R.
import { allSessions, summarize, clearSessions, toCSV, FUNNEL } from './track.js';

export function createResearch(el, tracker) {
  const S = tracker.session;
  const link = (v, label) => `<a href="#${v}">${label}</a>`;
  el.innerHTML = `
    <div class="row" style="justify-content:space-between"><h2 id="rsTitle">Test log</h2><button type="button" class="btn" id="rsClose">Close</button></div>
    <p class="muted">Stored only in this browser. Nothing is sent anywhere. See the testing guide for the script.</p>
    <div class="row"><label for="rsPid">Participant</label><input id="rsPid" placeholder="e.g. P3" value="${S.participant || ''}">
      <button type="button" class="btn" id="rsNew">Start next participant</button></div>
    <p class="muted">Conditions: ${link('direct', 'Direct only')} · ${link('explore', 'Explore')} · ${link('story', 'Story')} · ${link('all', 'Everything')} · ${link('flat', 'Flat-map hand-off')} · ${link('simple', 'Simple view')}</p>
    <p class="muted">Each link reloads the page into that condition. Copy a condition’s address to give a participant a fixed version.</p>
    <p class="muted">This session: <b>${S.variant}</b> · map <b>${S.map}</b> · ${S.device.touch ? 'touch' : 'mouse'} · ${S.device.w}×${S.device.h} · quality ${S.device.tier}</p>
    <h3 style="margin:0">Where sessions stopped</h3><div class="funnel" id="rsFunnel"></div>
    <h3 style="margin:0">Sessions</h3><div class="tbl"><table id="rsTable"></table></div>
    <div class="row"><button type="button" class="btn" id="rsJson">Copy JSON</button><button type="button" class="btn" id="rsCsv">Copy CSV</button>
      <button type="button" class="btn" id="rsClear">Clear all…</button><span id="rsMsg" class="muted"></span></div>
    <textarea id="rsOut" class="log" rows="6" readonly hidden aria-label="Exported data"></textarea>
    <h3 style="margin:0">Live events (this session)</h3><div class="log" id="rsLog"></div>`;
  const $ = (id) => el.querySelector('#' + id);
  let confirmClear = false;
  function render() {
    const rows = allSessions().filter((s) => s.events.length).map(summarize).reverse();
    const n = rows.length || 1;
    $('rsFunnel').innerHTML = FUNNEL.map(([k, label]) => {
      const c = rows.filter((r) => FUNNEL.findIndex((f) => f[0] === r.stoppedAt) >= FUNNEL.findIndex((f) => f[0] === k)).length;
      return `<div><span>${label}</span><b style="width:${(100 * c / n).toFixed(0)}%"></b><span>${c}</span></div>`;
    }).join('');
    const cols = ['participant', 'variant', 'path', 'timeToDropoffS', 'chosen', 'stoppedAt', 'storyFinished', 'storySkipped', 'hotspots', 'durationS'];
    $('rsTable').innerHTML = `<thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 40).map((r) => `<tr>${cols.map((c) => `<td>${r[c] === true ? 'yes' : r[c] === false ? '' : r[c] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>`;
    $('rsLog').textContent = S.events.map((e) => `${(e.t / 1000).toFixed(1).padStart(6)}s  ${e.name}${Object.keys(e).filter((k) => !['t', 'name'].includes(k)).map((k) => ` ${k}=${e[k]}`).join('')}`).join('\n');
    $('rsLog').scrollTop = 1e6;
  }
  async function copy(text, label) {
    const out = $('rsOut'); out.hidden = false; out.value = text;
    try { await navigator.clipboard.writeText(text); $('rsMsg').textContent = `${label} copied`; }
    catch (e) { out.select(); $('rsMsg').textContent = `Copy was blocked: the ${label} is selected below`; }
  }
  $('rsClose').onclick = () => { el.hidden = true; };
  $('rsPid').onchange = (e) => { tracker.setParticipant(e.target.value.trim()); render(); };
  $('rsNew').onclick = () => { const v = $('rsPid').value.trim(), m = v.match(/^(.*?)(\d+)$/); const next = m ? m[1] + (+m[2] + 1) : v; tracker.setParticipant(next); location.reload(); };
  el.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); if (location.hash === a.getAttribute('href')) location.reload(); else location.hash = a.getAttribute('href'); }));
  $('rsJson').onclick = () => copy(JSON.stringify(allSessions(), null, 1), 'JSON');
  $('rsCsv').onclick = () => copy(toCSV(allSessions().filter((s) => s.events.length).map(summarize)), 'CSV');
  $('rsClear').onclick = () => {
    if (!confirmClear) { confirmClear = true; $('rsClear').textContent = 'Click again to delete every session'; return; }
    clearSessions(); confirmClear = false; $('rsClear').textContent = 'Clear all…'; $('rsMsg').textContent = 'Cleared'; render();
  };
  tracker.on(() => { if (!el.hidden) render(); });
  return { open() { el.hidden = false; render(); }, toggle() { el.hidden = !el.hidden; if (!el.hidden) render(); } };
}
