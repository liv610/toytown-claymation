// Loading data files on the published pages. A shareable page may only carry HTML, script, style, image, video and
// audio files, so the packaging scripts (tools/build_journey.sh, tools/build_national.sh) ship every .json as a script
// file NAME.json.js:  window.TT_DATA["NAME.json"] = {...};  and set window.TT_DATA_EXT = '.js'. Locally (no packaging)
// the plain .json is fetched. Either way it is fetched as text and parsed — never run.
export async function fetchData(url) {
  const ext = (typeof window !== 'undefined' && window.TT_DATA_EXT) || '';
  const txt = await (await fetch(url + (url.endsWith('.json') ? ext : ''))).text();
  if (txt.startsWith('window.TT_DATA')) return JSON.parse(txt.slice(txt.indexOf('] = ') + 4).replace(/;\s*$/, ''));
  return JSON.parse(txt);
}
