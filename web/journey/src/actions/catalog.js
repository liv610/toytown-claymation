// PLACEHOLDER catalogue for the "send a toy online" prototype. Names, ages and price ranges are
// illustrative only; the real catalogue would come from the organisation's chosen retail partner.
export const TOYS = [
  { id: 'train', name: 'Wooden train set', ages: '3–6', price: '$20–30', blurb: 'A pull-along engine and car that run on a little oval of track.' },
  { id: 'teddy', name: 'Teddy bear', ages: '0–5', price: '$12–20', blurb: 'Soft, huggable and ready to wave hello.' },
  { id: 'blocks', name: 'Letter blocks', ages: '1–4', price: '$15–25', blurb: 'Stack them, spell with them, knock them down again.' },
  { id: 'truck', name: 'Toy truck', ages: '3–7', price: '$15–25', blurb: 'A sturdy truck with a tipping bed for carrying treasures.' },
  { id: 'top', name: 'Spinning top', ages: '4–8', price: '$8–15', blurb: 'Wind it, let go and watch the stripes blur.' },
  { id: 'drum', name: 'Little drum', ages: '3–8', price: '$15–25', blurb: 'Two sticks, one drum and a lot of joyful noise.' },
];
export const WRAPS = [
  { id: 'red', label: 'Holly red', color: 0xc8342c, css: '#c8342c' },
  { id: 'blue', label: 'Midnight blue', color: 0x2f5f9e, css: '#2f5f9e' },
  { id: 'green', label: 'Pine green', color: 0x3f8a5a, css: '#3f8a5a' },
];
// The first digit of a US ZIP code names one of ten national areas.
export const ZIP_AREAS = [
  { d: 0, name: 'New England & New Jersey', short: 'Northeast' },
  { d: 1, name: 'New York & Pennsylvania', short: 'NY & PA' },
  { d: 2, name: 'the Mid-Atlantic & Carolinas', short: 'Mid-Atlantic' },
  { d: 3, name: 'the Southeast', short: 'Southeast' },
  { d: 4, name: 'the Great Lakes & Kentucky', short: 'Great Lakes' },
  { d: 5, name: 'the Upper Midwest & Montana', short: 'Upper Midwest' },
  { d: 6, name: 'the Central Plains', short: 'Central' },
  { d: 7, name: 'Texas & the South Central states', short: 'South Central' },
  { d: 8, name: 'the Mountain West', short: 'Mountain' },
  { d: 9, name: 'the Pacific states', short: 'Pacific' },
];
export const areaOf = (zip) => ZIP_AREAS[+zip[0]];
export const routeOf = (zip) => (+zip[0] <= 3 ? 'red' : +zip[0] <= 6 ? 'blue' : 'green');
