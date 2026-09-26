import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { capturePages, mountCopy, rasterizePage, warmPageFonts, type PaperSnapshot } from './bookPageSnapshot';
import { blankPaper, createBookRenderer, type TurnLeaf } from './bookTurnRenderer';
import { turnProgress } from './bookTurnGeometry';
import { bookTurnTiming } from './bookTurnTiming';

export type PageDirection = 'next' | 'previous';
type Turn = { direction: PageDirection; count: number; pages: PaperSnapshot[]; stacked: boolean };

export function useBookTurn(frameRef: RefObject<HTMLDivElement | null>, pageKey: string) {
  const pending = useRef<Turn | null>(null);
  const busy = useRef(false);
  const finishRef = useRef<(() => void) | null>(null);
  const [isTurning, setIsTurning] = useState(false);
  const rendererRef = useRef<{ width: number; height: number; stacked: boolean; renderer: ReturnType<typeof createBookRenderer> } | null>(null);

  function getRenderer(frame: HTMLElement, stacked: boolean) {
    const { clientWidth: width, clientHeight: height } = frame;
    const cached = rendererRef.current;
    if (cached && cached.width === width && cached.height === height && cached.stacked === stacked && !cached.renderer.isContextLost()) return cached.renderer;
    cached?.renderer.dispose();
    rendererRef.current = null;
    const renderer = createBookRenderer(width, height, stacked);
    rendererRef.current = { width, height, stacked, renderer };
    return renderer;
  }

  useEffect(() => {
    // Compile the renderer while the journal is idle, then reuse it for turns.
    // Page textures are still discarded as soon as their animation finishes.
    const warm = () => {
      const frame = frameRef.current;
      if (!frame || busy.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const pages = frame.querySelectorAll<HTMLElement>(':scope > .spread > .sheet');
      if (pages.length !== 2) return;
      void warmPageFonts().catch(() => { /* A turn can retry or use intact DOM text. */ });
      try { getRenderer(frame, pages[1].offsetTop > pages[0].offsetTop + 1); } catch { /* The intact DOM fallback remains available. */ }
    };
    const idle = 'requestIdleCallback' in window ? window.requestIdleCallback(warm, { timeout: 250 }) : null;
    const timer = idle === null ? window.setTimeout(warm, 0) : null;
    return () => {
      if (idle !== null) window.cancelIdleCallback(idle);
      if (timer !== null) window.clearTimeout(timer);
      rendererRef.current?.renderer.dispose();
      rendererRef.current = null;
    };
  }, [frameRef]);

  function prepareTurn(direction: PageDirection, count: number) {
    const frame = frameRef.current;
    if (!frame || busy.current || document.fonts.status !== 'loaded' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pages = capturePages(frame);
    if (pages.length !== 2 || !pages[0].width) return;
    pending.current = { direction, count, pages, stacked: pages[1].top > pages[0].top + 1 };
    busy.current = true;
    setIsTurning(true);
  }

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const turn = pending.current;
    if (!frame || !turn) return;
    const incoming = capturePages(frame);
    const spread = frame.querySelector<HTMLElement>(':scope > .spread');
    if (incoming.length !== 2 || !spread) {
      pending.current = null; busy.current = false; setIsTurning(false);
      return;
    }

    const forward = turn.direction === 'next';
    const movingIndex = forward ? 1 : 0;
    const restingIndex = 1 - movingIndex;
    const { leaves: count, duration, stagger, total } = bookTurnTiming(turn.count);
    const overlay = document.createElement('div');
    overlay.className = 'book-turn-overlay' + (turn.stacked ? ' is-stacked' : '');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;
    const hold = document.createElement('div');
    hold.className = 'book-turn-hold';
    const samples = document.createElement('div');
    samples.className = 'book-turn-samples';
    overlay.append(hold, samples);
    frame.append(overlay);
    const heldPages = turn.pages.map((page) => mountCopy(page, hold));
    spread.inert = true;
    frame.setAttribute('aria-busy', 'true');
    let animation = 0;
    let done = false;
    let mode: 'pending' | 'mesh' | 'flat' = 'pending';
    let renderer: ReturnType<typeof createBookRenderer> | undefined;
    const leaves: TurnLeaf[] = [];
    const flatLeaves: Array<{ node: HTMLElement; index: number }> = [];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function stop(updateState: boolean) {
      if (done) return;
      done = true;
      window.clearTimeout(fallbackTimer);
      cancelAnimationFrame(animation);
      renderer?.canvas.removeEventListener('webglcontextlost', finish);
      renderer?.reset();
      overlay.remove(); overlay.replaceChildren();
      leaves.length = flatLeaves.length = heldPages.length = 0;
      turn!.pages.length = incoming.length = 0;
      spread!.inert = false;
      frame!.removeAttribute('aria-busy');
      window.removeEventListener('resize', finish);
      motion.removeEventListener('change', finish);
      pending.current = null; busy.current = false; finishRef.current = null;
      if (updateState) setIsTurning(false);
    }
    function finish() { stop(true); }
    finishRef.current = finish;
    window.addEventListener('resize', finish);
    motion.addEventListener('change', finish);

    function begin() {
      window.clearTimeout(fallbackTimer);
      if (turn!.stacked) hold.remove();
      else heldPages[movingIndex].remove();
      const start = performance.now();
      const draw = (elapsed: number) => {
        if (mode === 'mesh') renderer!.draw(leaves, elapsed, duration, stagger, forward);
        else for (const { node, index } of flatLeaves) {
          const p = Math.max(0, Math.min(1, (elapsed - index * stagger) / duration));
          const eased = turnProgress(p);
          node.style.transform = 'rotateY(' + (forward ? -180 : 180) * eased + 'deg)';
          node.style.zIndex = String(p < 0.5 ? count - index + 1 : index + 2);
        }
      };
      const tick = (now: number) => {
        const elapsed = now - start;
        draw(elapsed);
        if (elapsed >= total) finish();
        else animation = requestAnimationFrame(tick);
      };
      draw(0);
      animation = requestAnimationFrame(tick);
    }

    // A single intact DOM face is the fallback when capture or WebGL fails.
    // It keeps the lettering intact even on devices without hardware rendering.
    function flatFallback() {
      if (done || mode !== 'pending') return;
      mode = 'flat'; overlay.dataset.renderer = mode;
      renderer?.canvas.removeEventListener('webglcontextlost', finish);
      renderer?.dispose();
      if (rendererRef.current?.renderer === renderer) rendererRef.current = null;
      renderer = undefined;
      for (const pageIndex of turn!.stacked ? [0, 1] : [movingIndex]) {
        const page = turn!.pages[pageIndex];
        for (let index = 0; index < count; index++) {
          const leaf = document.createElement('div');
          leaf.className = 'book-turn-flat';
          Object.assign(leaf.style, { left: page.left + 'px', top: page.top + 'px', width: page.width + 'px', height: page.height + 'px', transformOrigin: forward ? 'left center' : 'right center' });
          overlay.append(leaf);
          for (const back of [false, true]) {
            const face = document.createElement('div');
            face.className = 'book-turn-flat-face' + (back ? ' is-back' : '');
            leaf.append(face);
            const snapshot = back ? (!turn!.stacked && index === count - 1 ? incoming[restingIndex] : null) : (index === 0 ? page : null);
            if (snapshot) {
              const copy = mountCopy(snapshot, face);
              copy.style.left = copy.style.top = '0';
            }
          }
          flatLeaves.push({ node: leaf, index });
        }
      }
      begin();
    }
    const fallbackTimer = window.setTimeout(flatFallback, 180);

    async function renderPages() {
      try {
        renderer = getRenderer(frame!, turn!.stacked);
        renderer.canvas.addEventListener('webglcontextlost', finish, { once: true });
        const movingPages = turn!.stacked ? turn!.pages : [turn!.pages[movingIndex]];
        const snapshots = turn!.stacked ? movingPages : [...movingPages, incoming[restingIndex]];
        const images = await Promise.all(snapshots.map((page) => rasterizePage(page, samples)));
        if (done || mode !== 'pending') { images.forEach((image) => { image.width = image.height = 0; }); return; }
        const textures = images.map((image) => renderer!.texture(image));
        images.forEach((image) => { image.width = image.height = 0; });
        movingPages.forEach((page, pageIndex) => {
          let blankTexture = textures[pageIndex];
          if (turn!.stacked || count > 1) {
            const blank = blankPaper(page);
            blankTexture = renderer!.texture(blank);
            blank.width = blank.height = 0;
          }
          for (let index = 0; index < count; index++) leaves.push({ page, index, front: index === 0 ? textures[pageIndex] : blankTexture, back: !turn!.stacked && index === count - 1 ? textures[1] : blankTexture });
        });
        mode = 'mesh'; overlay.dataset.renderer = mode;
        samples.remove();
        overlay.append(renderer.canvas);
        begin();
      } catch {
        flatFallback();
      }
    }
    void renderPages();
    return () => stop(false);
  }, [frameRef, pageKey]);

  return { prepareTurn, isTurning, busy, finishTurn: () => finishRef.current?.() };
}
