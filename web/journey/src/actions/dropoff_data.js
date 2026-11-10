// PLACEHOLDER drop-off locations. Not real places, not real hours. Generated from the ZIP code so
// the same ZIP always shows the same list. Replace with the production campaign API once approved.
const KINDS = [
  ['Fire Station No.', 'Lobby, by the front desk'], ['Public Library', 'Children’s section entrance'],
  ['Community Center', 'Main hall'], ['Hardware Store', 'Front of store, by the registers'],
  ['Credit Union', 'Branch lobby'], ['Grocery Market', 'Customer service desk'], ['Toy & Hobby Shop', 'Inside the front door'],
];
const STREETS = ['Maple', 'Elm', 'Main', 'Station', 'Holly', 'Mill', 'Chestnut', 'Lake', 'Union', 'Pine'];
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function validZip(z) { return /^\d{5}$/.test(z); }

export function findDropoffs(zip) {
  let h = hash(zip);
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  if (zip === '00000') return [];
  const n = 3 + Math.floor(rnd() * 2), used = new Set(), out = [];
  for (let i = 0; i < n; i++) {
    let k; do { k = Math.floor(rnd() * KINDS.length); } while (used.has(k)); used.add(k);
    const [name, where] = KINDS[k];
    out.push({
      id: `${zip}-${k}`,
      name: name.endsWith('No.') ? `${name} ${1 + Math.floor(rnd() * 19)}` : `${STREETS[Math.floor(rnd() * STREETS.length)]} ${name}`,
      where,
      address: `${100 + Math.floor(rnd() * 880)} ${STREETS[Math.floor(rnd() * STREETS.length)]} St`,
      miles: +(0.4 + i * 1.1 + rnd() * 0.9).toFixed(1),
      hours: rnd() > 0.5 ? 'Mon–Sat, 9 am–6 pm' : 'Daily, 8 am–8 pm',
      until: `Dec ${12 + Math.floor(rnd() * 8)}`,
    });
  }
  return out.sort((a, b) => a.miles - b.miles);
}
