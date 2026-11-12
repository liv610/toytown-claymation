// Unit checks for the campaign directory and ZIP lookup (web/shared/campaigns.js) against the test dataset.
//   node tools/tests/finder_unit.mjs        (no browser, no server; exits non-zero on failure)
import fs from 'fs';
import { normalizeZip, zipProblem, validateDirectory, loadDirectory, lookupZip } from '../../web/shared/campaigns.js';

let failed = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };
const data = JSON.parse(fs.readFileSync(new URL('../../web/national/assets/campaigns.test.json', import.meta.url)));
const load = async () => structuredClone(data);
const ids = (list) => list.map((c) => c.campaign ? c.campaign.id : c.id).join(',');

// ZIP input
for (const [i, want] of [['00101', '00101'], [' 00101 ', '00101'], ['00101-1234', '00101'], ['001011234', '00101'], ['0010', null], ['001012', null], ['abcde', null], ['', null], ['00 101', '00101']])
  ok(normalizeZip(i) === want, `normalizeZip(${JSON.stringify(i)}) → ${want}`);
ok(zipProblem('') === 'empty' && zipProblem('  ') === 'empty' && zipProblem('12a45') === 'format' && zipProblem('12345') === null, 'zipProblem: empty / format / valid');

// the dataset itself
ok(validateDirectory(data).length === 0, 'test dataset is valid ' + validateDirectory(data).join('; '));
ok(data.test === true && data.campaigns.every((c) => new URL(c.website).hostname === 'example.org'), 'test dataset is marked test and links only to example.org');
ok(Object.keys(data.zips).concat(data.campaigns.flatMap((c) => c.serves.zips)).every((z) => +z < 501), 'test ZIPs are all below 00501 (none assigned by USPS)');

// loading rules: fictional data never appears silently in production
const r = {
  test: await loadDirectory({ source: 'test', url: 'x', load }),
  officialWithTest: await loadDirectory({ source: 'official', url: 'x', load }),
  officialNone: await loadDirectory({ source: 'official', url: '', load }),
  noSource: await loadDirectory({ source: undefined, url: 'x', load }),
  failing: await loadDirectory({ source: 'test', url: 'x', load: async () => { throw new Error('404'); } }),
  bad: await loadDirectory({ source: 'test', url: 'x', load: async () => ({ ...structuredClone(data), campaigns: [{ ...data.campaigns[0], website: 'javascript:alert(1)' }] }) }),
  realLooking: await loadDirectory({ source: 'official', url: 'x', load: async () => ({ ...structuredClone(data), test: false }) }),
};
ok(r.test.status === 'ready' && r.test.test === true, 'test source + test data → ready, flagged as test');
ok(r.officialWithTest.status === 'unavailable' && r.officialWithTest.reason === 'test-data-refused', 'official source refuses test data');
ok(r.officialNone.status === 'unavailable' && r.officialNone.reason === 'not-connected', 'official source with no directory → unavailable (page offers the official finder)');
ok(r.noSource.status === 'unavailable', 'no declared source → unavailable (never defaults to test data)');
ok(r.failing.status === 'unavailable' && r.failing.reason === 'load-failed', 'directory that fails to load → unavailable');
ok(r.bad.status === 'unavailable' && r.bad.reason === 'invalid', 'non-https website → directory rejected');
ok(r.realLooking.status === 'ready' && r.realLooking.test === false, 'official source + non-test data → ready, not flagged as test');

// lookups
const dir = r.test, L = (z) => lookupZip(dir, z);
let x = L('00101'); ok(x.outcome === 'serving' && ids(x.serving) === 'test-maple-hollow', '00101 → served by Maple Hollow');
ok(!x.nearby.some((n) => n.campaign.id === 'test-maple-hollow') && x.nearby.length > 0, '00101 → nearby list excludes the serving campaign: ' + ids(x.nearby));
x = L('00105'); ok(x.outcome === 'serving' && ids(x.serving) === 'test-maple-hollow,test-lanternfield', '00105 → served by two campaigns');
x = L('00103'); ok(x.outcome === 'none' && x.serving.length === 0 && x.nearby.length === 3, '00103 → none serve it; 3 nearby: ' + ids(x.nearby));
ok(x.nearby[0].miles <= x.nearby[1].miles && x.nearby[1].miles <= x.nearby[2].miles, '00103 → nearby sorted by distance');
ok(L('00103').nearby[0].campaign.id === 'test-maple-hollow' && L('00103').serving.length === 0, 'proximity never makes a campaign "serving" (closest is still only nearby)');
x = L('00106'); ok(x.outcome === 'none' && !x.nearby.some((n) => n.campaign.id === 'test-bramblewood'), '00106 → its only campaign is inactive: not serving, not nearby');
x = L('00201'); ok(x.outcome === 'serving' && ids(x.serving) === 'test-copper-wash' && x.nearby.length === 0, '00201 (Arizona) → served, no Ohio campaigns nearby');
x = L('00401'); ok(x.outcome === 'none' && x.nearby.length === 0, '00401 → known ZIP, no campaign serves it, none nearby');
x = L('90210'); ok(x.outcome === 'unknown' && x.serving.length === 0 && x.nearby.length === 0, 'a real-world ZIP (90210) → unknown in the test data');

console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0);
