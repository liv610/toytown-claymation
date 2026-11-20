// The Toy Town story view (Phase 1, Milestone 1): chapter navigation over placeholder scenes. Plain DOM, no three.js,
// so it works with the 3D map off or unavailable.
//
// One position record — { chapter, beat } — is the whole story state. The campaign selection lives in selection.js and
// the story never touches it: the story's "Find Local Campaign" opens the shared finder over the story, and closing the
// finder brings the visitor back to the same chapter and beat (beats never advance on their own, so nothing moves on
// underneath). Exit keeps the position too, so "Explore Toy Town" can continue where the visitor left.
//
// Scenes are shown by a STAGE chosen per scene: today only the built-in 'still' stage (an image, or a "scene in
// development" slate). A 3D stage can be registered later with registerStage('shot', { show(scene, opts), hide() }) and
// story_data.js beats can name a shot; the interface, navigation and finder hand-off stay as they are.
import { STORY } from './story_data.js';

const stages = new Map();
export function registerStage(kind, stage) { stages.set(kind, stage); }

export function createStory(root, { finder, assets = './assets/story/', onEnter = () => {}, onLeave = () => {}, notYet = () => {} }) {
  const $ = (sel) => root.querySelector(sel);
  const stageEl = $('.story-stage'), progress = $('.story-progress'), eyebrow = $('.story-eyebrow'), textEl = $('.story-text');
  const actionsEl = $('.story-actions'), backBtn = $('.story-back'), nextBtn = $('.story-next'), live = $('.story-live');
  const findBtn = $('.story-find'), exitBtn = $('.story-exit'), skipBtn = $('.story-skip'), readBtn = $('.story-read'), count = $('.story-count');
  const pauseBtn = $('.story-pause'), chapterName = $('.story-chapter-name'), titleCard = $('.story-title-card');
  const textDialog = document.getElementById('storyText');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CH = [...STORY.chapters, STORY.finale], LAST = CH.length - 1;     // the finale is the last "chapter"
  let pos = null, returnTo = null, stageNow = null;                         // pos: { chapter, beat } while a story exists
  let shownChapter = -1;                                                   // the chapter whose title card last played

  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ------------------------------------------------------------ the built-in stage: a still image or a development slate
  registerStage('still', {
    show(scene) {
      const layer = h('div', 'story-scene');
      if (scene.still) {
        const img = h('img'); img.src = assets + scene.still; img.alt = ''; img.decoding = 'async';
        if (scene.focus) img.style.objectPosition = scene.focus;
        layer.append(img);
      } else {
        const slate = h('div', 'story-slate');
        slate.append(h('span', 'story-slate-kicker', 'Scene in development'), h('span', 'story-slate-title', scene.slate || 'Toy Town'));
        layer.append(slate);
      }
      layer.append(h('span', 'story-placeholder', scene.still ? 'Placeholder scene' : 'Placeholder'));
      const old = [...stageEl.children];
      stageEl.append(layer);
      if (reduced()) old.forEach((o) => o.remove());
      else { requestAnimationFrame(() => layer.classList.add('in')); setTimeout(() => old.forEach((o) => o.remove()), 450); }
      if (reduced()) layer.classList.add('in');
    },
    hide() { stageEl.replaceChildren(); },
  });
  const stageFor = (scene) => ((scene.shot || scene.play) && stages.has('shot') ? stages.get('shot') : stages.get('still'));

  // ------------------------------------------------------------ chapter progress (four chapters; the finale fills all four)
  STORY.chapters.forEach((c, i) => {
    const li = h('li'), b = h('button', 'story-step');
    b.type = 'button'; b.dataset.chapter = String(i);
    b.append(h('span', 'story-step-n', String(i + 1)), h('span', 'story-step-name', c.title), h('span', 'story-step-fill'));
    li.style.setProperty('--beats', String(c.beats.length));                // a chapter's share of the rail: its number of beats
    b.setAttribute('aria-label', `Chapter ${i + 1}: ${c.title}`);
    b.addEventListener('click', () => go(i, 0, { announce: true }));
    li.append(b); progress.append(li);
  });

  // ------------------------------------------------------------ render the current beat
  function render({ announce = false, focusText = false } = {}) {
    const ch = CH[pos.chapter], beat = ch.beats[pos.beat], fin = pos.chapter === LAST;
    root.dataset.chapter = ch.id; root.dataset.beat = beat.id;
    const st = stageFor(beat.scene);
    if (stageNow && stageNow !== st && stageNow.hide) stageNow.hide();   // e.g. from the live street back to a still
    stageNow = st; st.show(beat.scene, { reduced: reduced() });
    $('.story-scene-alt').textContent = beat.scene.alt || '';
    progress.querySelectorAll('.story-step').forEach((b, i) => {
      const cur = i === pos.chapter; b.classList.toggle('done', i < pos.chapter || fin); b.classList.toggle('current', cur);
      if (cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      const n = STORY.chapters[i].beats.length;
      b.style.setProperty('--fill', `${i < pos.chapter || fin ? 100 : cur ? Math.round(((pos.beat + 1) / n) * 100) : 0}%`);
    });
    // the eyebrow still says it all (it is what a screen reader hears); the chapter part shows at the top instead
    const chLabel = fin ? 'Toy Town · ' : `Chapter ${pos.chapter + 1} of ${STORY.chapters.length} · ${ch.title}${beat.eyebrow ? ' · ' : ''}`;
    eyebrow.replaceChildren(h('span', 'sr', chLabel), document.createTextNode(fin ? 'the end of the story' : beat.eyebrow || ''));
    chapterName.textContent = fin ? 'The end of the story' : `Chapter ${pos.chapter + 1} · ${ch.title}`;
    if (pos.chapter !== shownChapter) {                                       // a new chapter: its title, briefly, mid-frame
      shownChapter = pos.chapter;
      titleCard.querySelector('.k').textContent = fin ? 'Toy Town' : `Chapter ${pos.chapter + 1}`;
      titleCard.querySelector('.t').textContent = fin ? 'Your community' : ch.title;
      titleCard.classList.remove('show'); void titleCard.offsetWidth; titleCard.classList.add('show');
    }
    textEl.replaceChildren(...beat.lines.map((l, i) => h('p', i === 0 ? 'story-line lead' : 'story-line', l)));
    textEl.classList.remove('enter'); void textEl.offsetWidth; textEl.classList.add('enter');   // the lines fade up (not with reduced motion)
    textEl.scrollTop = 0;
    if (beat.list) {
      const ol = h('ol', 'story-list');
      for (const it of beat.list) { const li = h('li'); li.append(h('b', null, it.title), h('span', null, it.text)); ol.append(li); }
      textEl.append(ol);
    }
    if (beat.note) textEl.append(h('p', 'story-note', beat.note));
    // chapter actions: the shared finder, the (placeholder) national donation; the finale adds replay and the map
    actionsEl.replaceChildren();
    for (const a of beat.actions || []) {
      if (a === 'finder') { const b = h('button', 'btn primary story-act-finder', 'Find My Local Campaign'); b.type = 'button'; b.addEventListener('click', () => openFinder(b)); actionsEl.append(b); }
      if (a === 'donate') { const b = h('button', 'btn story-act-donate', 'Make a Monetary Donation'); b.type = 'button'; b.addEventListener('click', () => notYet('Make a Monetary Donation')); actionsEl.append(b); }
    }
    if (fin) {
      const r = h('button', 'btn story-replay', 'Replay the story'); r.type = 'button'; r.addEventListener('click', () => go(0, 0, { announce: true, focusText: true }));
      const m = h('button', 'btn story-map', 'Back to the map'); m.type = 'button'; m.addEventListener('click', () => exit());
      actionsEl.append(r, m);
    }
    actionsEl.hidden = !actionsEl.children.length;
    requestAnimationFrame(() => textEl.classList.toggle('scrolls', textEl.scrollHeight > textEl.clientHeight + 2));   // a long beat: the text scrolls, softly faded
    const lastBeat = pos.beat === ch.beats.length - 1;
    backBtn.disabled = pos.chapter === 0 && pos.beat === 0;
    nextBtn.hidden = fin;
    nextBtn.textContent = lastBeat ? ch.next : 'Next';
    count.textContent = ch.beats.length > 1 ? `${pos.beat + 1} of ${ch.beats.length}` : '';
    skipBtn.hidden = fin;
    // a beat that plays: the controls step back until the action resolves (the world says when); others are ready at once
    const plays = !!beat.scene.play && stageFor(beat.scene) === stages.get('shot');
    setPlay(plays ? 'playing' : 'ready', false);
    if (announce) { live.textContent = ''; setTimeout(() => { live.textContent = `${eyebrow.textContent}. ${textEl.textContent}`; }, 40); }
    if (focusText) textEl.focus();
  }
  function go(chapter, beat, opts = {}) { pos = { chapter, beat }; render(opts); }
  // ------------------------------------------------------------ the story playing, paused, or ready for Next
  function setPlay(state, glow = true) {
    root.classList.toggle('is-playing', state === 'playing' || state === 'paused');
    root.classList.toggle('is-ready', state === 'ready' && glow);
    root.classList.toggle('is-paused', state === 'paused');
    pauseBtn.hidden = !(state === 'playing' || state === 'paused');
    pauseBtn.setAttribute('aria-pressed', String(state === 'paused'));
    pauseBtn.querySelector('.story-pause-l').textContent = state === 'paused' ? 'Resume' : 'Pause';
  }
  document.addEventListener('toytown:play', (e) => { if (!root.hidden) setPlay(e.detail.state === 'ended' ? 'ready' : e.detail.state); });
  pauseBtn.addEventListener('click', () => {
    const w = window.__natWorld; if (!w || !w.pause) return;
    const on = pauseBtn.getAttribute('aria-pressed') !== 'true'; w.pause(on);
    live.textContent = on ? 'Paused.' : 'Playing.';
  });
  function next() {
    const ch = CH[pos.chapter];
    if (pos.beat < ch.beats.length - 1) go(pos.chapter, pos.beat + 1, { announce: true });
    else if (pos.chapter < LAST) go(pos.chapter + 1, 0, { announce: true });
    if (pos.chapter === LAST) (actionsEl.querySelector('button') || textEl).focus();   // Next is gone at the end
  }
  function back() {
    if (pos.beat > 0) go(pos.chapter, pos.beat - 1, { announce: true });
    else if (pos.chapter > 0) go(pos.chapter - 1, CH[pos.chapter - 1].beats.length - 1, { announce: true });
  }

  // ------------------------------------------------------------ the shared finder, over the story
  function openFinder(from) {
    returnTo = from;
    document.body.classList.add('story-finder');
    finder.open({ context: 'story', backLabel: '← Back to the story', onClose: () => {
      document.body.classList.remove('story-finder');
      const t = returnTo; returnTo = null;
      (t && t.isConnected && t.offsetParent ? t : findBtn).focus();
    } });
  }

  // ------------------------------------------------------------ enter / exit / skip / read as text
  // while the story is open, the page behind it (map, top bar, labels) is inert: keyboard and screen-reader focus stay in
  // the story, the shared finder (#landing) and the dialogs
  function setBehind(inert) {
    if (inert) for (const e of document.body.children) { if (e === root || e.id === 'landing' || e.id === 'skipFlight' || e.id === 'flightLive' || e.tagName === 'DIALOG' || e.tagName === 'SCRIPT' || e.inert) continue; e.inert = true; e.dataset.storyInert = '1'; }
    else for (const e of document.querySelectorAll('[data-story-inert]')) { e.inert = false; delete e.dataset.storyInert; }
  }
  function enter({ restart = false } = {}) {
    if (!pos || restart) pos = { chapter: 0, beat: 0 };
    shownChapter = -1;
    root.hidden = false; document.body.classList.add('story-open'); setBehind(true);
    finder.collapse();
    onEnter();
    render({ announce: true });
    textEl.focus();
  }
  function exit() {
    if (document.body.classList.contains('story-finder')) { finder.release(); finder.collapse(); }   // finder open over the story: let go of it
    document.body.classList.remove('story-open', 'story-finder'); setBehind(false);
    root.hidden = true; stages.forEach((s) => s.hide && s.hide()); stageNow = null;
    finder.show();
    onLeave(pos);
  }
  backBtn.addEventListener('click', back);
  nextBtn.addEventListener('click', next);
  findBtn.addEventListener('click', () => openFinder(findBtn));
  exitBtn.addEventListener('click', exit);
  skipBtn.addEventListener('click', () => { go(LAST, 0, { announce: true }); (actionsEl.querySelector('button') || textEl).focus(); });
  readBtn.addEventListener('click', () => { fillText(); textDialog.showModal(); });

  // Read as text: the whole story from the same data (the same text the non-3D visitor reads)
  function fillText() {
    const body = textDialog.querySelector('.story-text-body');
    body.replaceChildren();
    CH.forEach((ch, ci) => {
      body.append(h('h3', null, ci === LAST ? 'The end of the story' : `Chapter ${ci + 1}: ${ch.title}`));
      for (const b of ch.beats) {
        if (b.scene.alt) body.append(h('p', 'story-text-scene', `Scene: ${b.scene.alt}`));
        for (const l of b.lines) body.append(h('p', null, l));
        if (b.list) { const ol = h('ol'); for (const it of b.list) { const li = h('li'); li.append(h('b', null, it.title + ': '), document.createTextNode(it.text)); ol.append(li); } body.append(ol); }
        if (b.note) body.append(h('p', 'story-note', b.note));
      }
    });
    const conf = [...new Set(CH.flatMap((c) => c.beats.flatMap((b) => b.confirm || [])))];
    body.append(h('h3', null, 'To confirm with Toys for Tots before publication'), h('p', 'story-note', conf.join(' · ')));
  }
  textDialog.querySelector('.story-text-finder').addEventListener('click', () => { textDialog.close(); if (root.hidden) { finder.open(); } else openFinder(findBtn); });

  // keyboard: Escape leaves Toy Town only when nothing else (finder, dialog) has it
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.body.classList.contains('story-finder') && !textDialog.open) { e.preventDefault(); exit(); } });

  return {
    enter, exit,
    openFinder: () => openFinder(findBtn),
    isOpen: () => !root.hidden,
    position: () => (pos ? { ...pos, chapterId: CH[pos.chapter].id, beatId: CH[pos.chapter].beats[pos.beat].id } : null),
    chapters: () => CH.map((c) => ({ id: c.id, title: c.title, beats: c.beats.map((b) => b.id) })),
    // straight to a beat by its ids (development review links; visitors move with Next/Back and the chapter bar)
    goTo(chapterId, beatId) {
      const c = CH.findIndex((x) => x.id === chapterId); if (c < 0) return false;
      pos = { chapter: c, beat: Math.max(0, CH[c].beats.findIndex((x) => x.id === beatId)) };
      if (root.hidden) enter(); else render({ announce: true });
      return true;
    },
  };
}
