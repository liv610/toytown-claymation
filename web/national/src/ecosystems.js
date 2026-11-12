// Which ecosystem a point of the felt national map lies in, as a mix ({ family: weight }) — boreal forest, forest,
// prairie gold, desert rust and peach, olive grassland, mountains, snow and tundra, autumn woods, tropics. The felt
// land's colour drifts between these (felt_relief.js), so the map changes with the land, not at state lines.
/**
 * The ecosystem mix at a map point (ax, ay): { family: weight }. Coarse on purpose — the patches and a little noise
 * make the borders between ecosystems ragged and gradual.
 */
export function ecosystem(geo, ax, ay, h) {
  const r = geo.region(ax, ay);
  if (h > 9.5) return { snow: 0.55, mountain: 0.45 };
  if (h > 5.5) return ax > 600 && r === 'us' ? { forest: 0.6, autumn: 0.25, mountain: 0.15 } : { mountain: 0.65, forest: 0.2, snow: 0.15 };   // the Appalachians are wooded
  if (r === 'ca') return ay < -95 ? { snow: 0.6, boreal: 0.4 } : ay < -40 ? { boreal: 0.7, snow: 0.15, forest: 0.15 } : { boreal: 0.5, forest: 0.3, olive: 0.2 };
  if (r === 'mx') return ay > 720 ? { tropic: 0.6, forest: 0.3, olive: 0.1 } : ay > 640 ? { olive: 0.35, gold: 0.25, tropic: 0.2, rust: 0.2 } : { rust: 0.4, peach: 0.3, gold: 0.3 };
  if (r === 'cb') return { tropic: 0.7, olive: 0.3 };
  // the United States (and its insets)
  if (ax < 40) return ay < 330 ? { snow: 0.4, boreal: 0.6 } : { tropic: 0.7, olive: 0.3 };               // Alaska, Hawaii (moved out to sea)
  if (ax < 160 && ay < 230) return { forest: 0.6, boreal: 0.25, olive: 0.15 };                           // Pacific Northwest
  if (ax < 250 && ay < 470) return { gold: 0.4, olive: 0.3, rust: 0.15, forest: 0.15 };                 // California
  if (ax < 420 && ay > 300) return { rust: 0.45, peach: 0.35, gold: 0.2 };                               // the Southwest deserts
  if (ax < 330) return { peach: 0.35, olive: 0.35, gold: 0.3 };                                          // the Great Basin
  if (ax < 430) return { olive: 0.35, gold: 0.4, forest: 0.25 };                                         // the mountain states' valleys
  if (ax < 610) return ay > 380 ? { gold: 0.4, rust: 0.3, peach: 0.3 } : { gold: 0.6, olive: 0.25, peach: 0.15 };   // the plains
  if (ax > 860 && ay > 470) return { tropic: 0.45, forest: 0.35, olive: 0.2 };                           // Florida
  if (ax > 700 && ay < 230) return { forest: 0.5, autumn: 0.35, olive: 0.15 };                             // New England, the Great Lakes
  if (ay > 360) return { forest: 0.65, olive: 0.3, peach: 0.05 };                                        // the South
  return ax > 700 ? { forest: 0.55, autumn: 0.3, olive: 0.15 } : { olive: 0.45, forest: 0.3, gold: 0.15, autumn: 0.1 };   // the mid-Atlantic, the Midwest
}
