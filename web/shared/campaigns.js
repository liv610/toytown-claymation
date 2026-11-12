// Campaign directory and ZIP lookup, shared by any page (no three.js, no DOM). Milestone 1, step 2.
//
// A directory is a JSON file:
//   { "test": true|false, "version": "...", "zips": { "00101": { "point": [lat, lon] } }, "campaigns": [ Campaign ] }
//   Campaign: { id, name, website, state, location: { lat, lon, label }, serves: { zips: [..], label }, active }
//
// Which campaign SERVES a ZIP comes only from the directory (serves.zips). It is never inferred from distance. NEARBY
// campaigns (within NEARBY_MILES of the ZIP's point) are listed separately and labelled as possibly not serving it.
//
// Safety: fictional test data ("test": true) loads only when the page explicitly asks for the test source. An
// "official" source refuses test data. A missing or broken directory is reported as unavailable, so the page can point
// to the official campaign finder instead of showing anything made up.
import { fetchData } from './data.js';

export const NEARBY_MILES = 60;
export const NEARBY_MAX = 3;

/** '12345' or '12345-6789' (spaces allowed) → '12345'; anything else → null */
export function normalizeZip(input) {
  const s = String(input ?? '').trim().replace(/\s+/g, '');
  const m = /^(\d{5})(?:-?\d{4})?$/.exec(s);
  return m ? m[1] : null;
}
/** '' → 'empty', valid → null, otherwise 'format' */
export function zipProblem(input) {
  if (!String(input ?? '').trim()) return 'empty';
  return normalizeZip(input) ? null : 'format';
}

const ID = /^[a-z0-9][a-z0-9-]*$/;
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isZip = (z) => typeof z === 'string' && /^\d{5}$/.test(z);
/** list of problems with a directory (empty when it is usable) */
export function validateDirectory(d) {
  const p = [];
  if (!d || typeof d !== 'object') return ['not an object'];
  if (typeof d.test !== 'boolean') p.push('"test" must be true or false');
  if (!Array.isArray(d.campaigns)) return [...p, '"campaigns" must be a list'];
  const seen = new Set();
  d.campaigns.forEach((c, i) => {
    const at = `campaign ${i} (${c && c.id})`;
    if (!c || !ID.test(c.id || '')) p.push(`${at}: bad id`); else if (seen.has(c.id)) p.push(`${at}: duplicate id`); else seen.add(c.id);
    if (!c || !c.name) p.push(`${at}: missing name`);
    if (!c || !/^https:\/\/[^\s]+$/.test(c.website || '')) p.push(`${at}: website must be an https URL`);
    if (!c || !c.location || !isNum(c.location.lat) || !isNum(c.location.lon) || !c.location.label) p.push(`${at}: bad location`);
    if (!c || !c.serves || !Array.isArray(c.serves.zips) || !c.serves.zips.every(isZip) || !c.serves.label) p.push(`${at}: bad service area`);
    if (!c || typeof c.active !== 'boolean') p.push(`${at}: "active" must be true or false`);
  });
  for (const [z, e] of Object.entries(d.zips || {})) if (!isZip(z) || !e || !Array.isArray(e.point) || !e.point.every(isNum)) p.push(`zip ${z}: bad point`);
  return p;
}

/**
 * source: 'test' | 'official'. url: the directory file. Returns
 *   { status: 'ready', test, campaigns, zips, byId }  or  { status: 'unavailable', reason }
 */
export async function loadDirectory({ source, url, load = fetchData }) {
  if (source !== 'test' && source !== 'official') return { status: 'unavailable', reason: 'no-source' };
  if (!url) return { status: 'unavailable', reason: 'not-connected' };
  let d;
  try { d = await load(url); } catch (e) { return { status: 'unavailable', reason: 'load-failed' }; }
  const problems = validateDirectory(d);
  if (problems.length) { console.warn('campaign directory rejected:', problems); return { status: 'unavailable', reason: 'invalid' }; }
  if (d.test && source !== 'test') return { status: 'unavailable', reason: 'test-data-refused' };   // never silently in production
  const campaigns = d.campaigns;
  return { status: 'ready', test: d.test, version: d.version || '', campaigns, zips: d.zips || {}, byId: new Map(campaigns.map((c) => [c.id, c])) };
}

export function milesBetween([lat1, lon1], [lat2, lon2]) {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * zip (already normalized) → { zip, outcome, serving, nearby }
 *   outcome 'serving': at least one active campaign lists this ZIP
 *           'none':    the directory knows this ZIP but no active campaign lists it
 *           'unknown': the directory has nothing about this ZIP
 *   nearby: [{ campaign, miles }] active campaigns near the ZIP that do not list it (closest first)
 */
export function lookupZip(dir, zip) {
  const active = dir.campaigns.filter((c) => c.active);
  const serving = active.filter((c) => c.serves.zips.includes(zip));
  const known = !!dir.zips[zip] || dir.campaigns.some((c) => c.serves.zips.includes(zip));
  const point = dir.zips[zip] && dir.zips[zip].point;
  const nearby = point ? active.filter((c) => !serving.includes(c))
    .map((c) => ({ campaign: c, miles: milesBetween(point, [c.location.lat, c.location.lon]) }))
    .filter((n) => n.miles <= NEARBY_MILES).sort((a, b) => a.miles - b.miles).slice(0, NEARBY_MAX) : [];
  return { zip, outcome: serving.length ? 'serving' : known ? 'none' : 'unknown', serving, nearby };
}
