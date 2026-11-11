// The simple view: the same journey (toy shop window, the Marine's moment, the same drop-off action)
// as captioned stills. Used when WebGL is missing, when 3D is too slow, or when the visitor prefers it.
// Fully keyboard and screen-reader friendly; nothing animates.
export function createFallback(root, { stills, variant, log, onUse3D }) {
  const storyOK = variant === 'story' || variant === 'all';
  const shopOK = variant !== 'story';
  const STORY = [
    ['story1.jpg', 'A new toy has just been left at the drop-off box beside the toy shop.'],
    ['story2.jpg', 'A Marine lifts it out. Marines and volunteers collect every donated toy…'],
    ['story3.jpg', '…and make sure it reaches a child in the same community.'],
  ];
  root.innerHTML = `
    <div class="row" style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;justify-content:space-between">
      <h2 id="fbTitle">Toy Town</h2>
      ${onUse3D ? '<button type="button" class="btn" id="fbTo3d">Switch to the 3D view</button>' : ''}
    </div>
    <p class="muted" style="font-size:1rem">The same village as the 3D version, in pictures. The ways to help are always in the bar.</p>
    <figure class="fb-scene" id="fbMain">
      <img id="fbImg" src="${stills}village.jpg" alt="The snowy square of Toy Town at dusk: a blue toy shop with a striped awning, a pink house, a red wagon of presents and two Marines.">
      <figcaption><p id="fbCap">Toy Town’s main street. Where would you like to look?</p>
        <div class="fb-places" id="fbBtns"></div></figcaption>
    </figure>`;
  const img = root.querySelector('#fbImg'), cap = root.querySelector('#fbCap'), btns = root.querySelector('#fbBtns');
  const home = () => {
    img.src = stills + 'village.jpg'; cap.textContent = 'Toy Town’s main street. Where would you like to look?';
    btns.innerHTML = (shopOK ? '<button type="button" class="btn" data-fb="shop">See the toy shop window</button><button type="button" class="btn" data-action="gift" data-source="explore-shop-lite">Visit the toy shop</button>' : '')
      + (storyOK ? '<button type="button" class="btn" data-fb="story">Follow the Marine</button>' : '');
  };
  let k = 0;
  function storyFrame() {
    const [src, text] = STORY[k];
    img.src = stills + src; img.alt = text; cap.textContent = text;
    log('story_beat', { i: k, lite: true });
    btns.innerHTML = `<span class="muted" aria-hidden="true">${k + 1} / ${STORY.length}</span>`
      + (k < STORY.length - 1 ? '<button type="button" class="btn btn-primary" data-fb="next">Next</button>' : '<button type="button" class="btn btn-primary" data-fb="end">Continue</button>')
      + '<button type="button" class="btn" data-action="dropoff" data-source="story-pill-lite">Find a toy drop-off</button>';
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fb]'); if (!b) return;
    const a = b.dataset.fb;
    if (a === 'shop') {
      log('hotspot_open', { id: 'shop', via: 'lite' });
      img.src = stills + 'window.jpg'; img.alt = 'The toy shop window: a wooden train, a spinning top and a teddy bear on display.';
      cap.innerHTML = 'Every toy in this window is on its way to a child in Toy Town. When you drop off a new, unwrapped toy near you, it’s given to a child in your own community.';
      btns.innerHTML = '<button type="button" class="btn btn-primary" data-action="dropoff" data-source="explore-shop-lite">Find a toy drop-off near you</button><button type="button" class="btn" data-fb="home">Back to the street</button>';
    } else if (a === 'story') { log('story_start', { source: 'lite' }); k = 0; storyFrame(); }
    else if (a === 'next') { k++; storyFrame(); }
    else if (a === 'end') {
      log('story_complete', { reason: 'lite' });
      cap.innerHTML = '<strong>Toys given here stay close to home.</strong> A new, unwrapped toy left at a drop-off near you goes to a child in your own community.';
      btns.innerHTML = '<button type="button" class="btn btn-primary" data-action="dropoff" data-source="story-end-lite">Find a toy drop-off near you</button><button type="button" class="btn" data-fb="home">Back to the street</button>';
    } else if (a === 'home') home();
    b.blur(); cap.focus?.();
  });
  root.querySelector('#fbTo3d')?.addEventListener('click', () => { log('use_3d'); onUse3D(); });
  cap.tabIndex = -1;
  home();
  return { home };
}
