import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export type PageDirection = 'next' | 'previous';

type PaperSnapshot = {
  node: HTMLElement;
  scroll: Array<{ index: number; top: number; left: number }>;
  width: number;
  height: number;
  left: number;
  top: number;
};

type Turn = {
  direction: PageDirection;
  count: number;
  pages: PaperSnapshot[];
  stacked: boolean;
};

let copyId = 0;

// Copies exist only in memory for the duration of a turn. Inputs and canvas
// drawings need their current values, which cloneNode alone does not preserve.
function copyContents(source: HTMLElement) {
  const node = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll<HTMLElement>('*')];
  const copies = [node, ...node.querySelectorAll<HTMLElement>('*')];
  const scroll: PaperSnapshot['scroll'] = [];
  const ids = new Map<string, string>();
  const prefix = `paper-copy-${++copyId}-`;

  originals.forEach((original, index) => {
    const copy = copies[index];
    if (original.scrollTop || original.scrollLeft) {
      scroll.push({ index, top: original.scrollTop, left: original.scrollLeft });
    }
    if (original instanceof HTMLTextAreaElement && copy instanceof HTMLTextAreaElement) copy.value = original.value;
    if (original instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
      copy.value = original.value;
      copy.checked = original.checked;
    }
    if (original instanceof HTMLSelectElement && copy instanceof HTMLSelectElement) copy.selectedIndex = original.selectedIndex;
    if (original instanceof HTMLCanvasElement && copy instanceof HTMLCanvasElement && original.width && original.height) {
      copy.getContext('2d')?.drawImage(original, 0, 0);
    }
    if (copy.id) {
      ids.set(copy.id, prefix + copy.id);
      copy.id = prefix + copy.id;
    }
    copy.removeAttribute('data-testid');
    copy.removeAttribute('autofocus');
    copy.removeAttribute('name');
  });
  // Keep SVG gradients and label references local to each visual copy.
  copies.forEach((copy) => {
    for (const attribute of Array.from(copy.attributes)) {
      if (attribute.name === 'id') continue;
      let value = attribute.value.replace(/url\(#([^)]*)\)/g, (match, id: string) => `url(#${ids.get(id) ?? id})`);
      if (value.startsWith('#') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
      if (['for', 'aria-labelledby', 'aria-describedby', 'aria-controls'].includes(attribute.name)) {
        value = value.split(' ').map((id) => ids.get(id) ?? id).join(' ');
      }
      if (value !== attribute.value) copy.setAttribute(attribute.name, value);
    }
  });
  return { node, scroll };
}

function capturePages(frame: HTMLElement): PaperSnapshot[] {
  const bounds = frame.getBoundingClientRect();
  return Array.from(frame.querySelectorAll<HTMLElement>(':scope > .spread > .sheet')).map((page) => {
    const rect = page.getBoundingClientRect();
    const snapshot = copyContents(page);
    snapshot.node.style.borderLeft = getComputedStyle(page).borderLeft;
    snapshot.node.style.borderTop = getComputedStyle(page).borderTop;
    return { ...snapshot, width: rect.width, height: rect.height, left: rect.left - bounds.left, top: rect.top - bounds.top };
  });
}

export function useBookTurn(frameRef: RefObject<HTMLDivElement | null>, pageKey: string) {
  const pending = useRef<Turn | null>(null);
  const busy = useRef(false);
  const finishRef = useRef<(() => void) | null>(null);
  const [isTurning, setIsTurning] = useState(false);

  function prepareTurn(direction: PageDirection, count: number) {
    const frame = frameRef.current;
    if (!frame || busy.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
      pending.current = null;
      busy.current = false;
      setIsTurning(false);
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = `book-turn-overlay${turn.stacked ? ' is-stacked' : ''}`;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;
    const restoreScroll: Array<() => void> = [];

    function mountCopy(snapshot: PaperSnapshot, parent: HTMLElement, offset = 0) {
      const { node } = copyContents(snapshot.node);
      node.classList.add('book-turn-copy');
      Object.assign(node.style, { width: `${snapshot.width}px`, height: `${snapshot.height}px`, left: `${offset}px`, top: '0' });
      parent.append(node);
      restoreScroll.push(() => {
        const elements = [node, ...node.querySelectorAll<HTMLElement>('*')];
        snapshot.scroll.forEach(({ index, top, left }) => elements[index]?.scrollTo({ top, left, behavior: 'instant' }));
      });
    }

    const forward = turn.direction === 'next';
    const sign = forward ? 1 : -1;
    const movingIndex = forward ? 1 : 0;
    const restingIndex = 1 - movingIndex;
    if (!turn.stacked) {
      const resting = document.createElement('div');
      resting.className = 'book-turn-resting';
      const page = turn.pages[restingIndex];
      Object.assign(resting.style, { left: `${page.left}px`, top: `${page.top}px`, width: `${page.width}px`, height: `${page.height}px` });
      mountCopy(page, resting);
      overlay.append(resting);
    }

    const segmentCount = turn.stacked ? 8 : 12;
    const duration = turn.count > 1 ? 620 : 860;
    const stagger = 135;
    const total = duration + (turn.count - 1) * stagger;
    const leaves: Array<{ node: HTMLElement; strips: HTMLElement[]; page: PaperSnapshot; index: number }> = [];

    // On narrow screens each stacked page turns independently, rather than
    // stretching one enormous turning sheet over the whole mobile spread.
    for (const pageIndex of turn.stacked ? [0, 1] : [movingIndex]) {
      const page = turn.pages[pageIndex];
      for (let index = 0; index < turn.count; index += 1) {
        const leaf = document.createElement('div');
        leaf.className = 'book-turn-paper';
        Object.assign(leaf.style, { top: `${page.top}px`, height: `${page.height}px` });
        const strips: HTMLElement[] = [];
        const width = page.width / segmentCount;
        for (let segment = 0; segment < segmentCount; segment += 1) {
          const strip = document.createElement('div');
          strip.className = 'book-turn-strip';
          strip.style.width = `${width + 0.35}px`;
          strip.style.transformOrigin = `${forward ? 'left' : 'right'} center`;
          for (const back of [false, true]) {
            const face = document.createElement('div');
            face.className = `book-turn-face${back ? ' is-back' : ''}`;
            const snapshot = back ? (!turn.stacked && index === turn.count - 1 ? incoming[restingIndex] : null) : (index === 0 ? page : null);
            const fromLeft = back ? !forward : forward;
            const slice = (fromLeft ? segment : segmentCount - 1 - segment) * width;
            if (snapshot) {
              mountCopy(snapshot, face, -slice);
            } else {
              const blank = document.createElement('div');
              blank.className = 'sheet book-turn-copy book-turn-blank';
              Object.assign(blank.style, { width: `${page.width}px`, height: `${page.height}px`, left: `${-slice}px`, top: '0' });
              face.append(blank);
            }
            strip.append(face);
          }
          leaf.append(strip);
          strips.push(strip);
        }
        overlay.append(leaf);
        leaves.push({ node: leaf, strips, page, index });
      }
    }

    frame.append(overlay);
    restoreScroll.forEach((restore) => restore());
    spread.inert = true;
    frame.setAttribute('aria-busy', 'true');
    let animation = 0;
    let started: number | null = null;
    let done = false;

    function stop(updateState: boolean) {
      if (done) return;
      done = true;
      cancelAnimationFrame(animation);
      overlay.remove();
      overlay.replaceChildren();
      leaves.length = 0;
      restoreScroll.length = 0;
      turn!.pages.length = 0;
      incoming.length = 0;
      spread!.inert = false;
      frame!.removeAttribute('aria-busy');
      window.removeEventListener('resize', finish);
      motion.removeEventListener('change', finish);
      pending.current = null;
      busy.current = false;
      finishRef.current = null;
      if (updateState) setIsTurning(false);
    }
    function finish() { stop(true); }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    finishRef.current = finish;
    window.addEventListener('resize', finish);
    motion.addEventListener('change', finish);

    function draw(elapsed: number) {
      for (const { node, strips, page, index } of leaves) {
        const progress = Math.max(0, Math.min(1, (elapsed - index * stagger) / duration));
        const eased = progress * progress * (3 - 2 * progress);
        const angle = Math.PI * eased;
        const bend = Math.sin(Math.PI * eased) * 0.52;
        const width = page.width / segmentCount;
        const spine = forward ? page.left : page.left + page.width;
        node.style.zIndex = String(progress < 0.5 ? turn!.count - index + 1 : index + 2);
        let x = 0;
        let z = 0;
        strips.forEach((strip, segment) => {
          // A continuous arc, anchored at the spine. It lies exactly flat at
          // both ends; there is no scaleX collapse, opacity fade, or hard tip.
          const rotation = angle + bend * ((segment + 0.5) / segmentCount - 0.5);
          strip.style.transform = `translate3d(${spine + sign * x - (forward ? 0 : width)}px, 0, ${z + 0.5}px) rotateY(${-sign * rotation}rad)`;
          x += Math.cos(rotation) * width;
          z += Math.sin(rotation) * width;
        });
      }
    }

    function tick(now: number) {
      started ??= now;
      const elapsed = now - started;
      draw(elapsed);
      if (elapsed >= total) finish();
      else animation = requestAnimationFrame(tick);
    }
    draw(0);
    animation = requestAnimationFrame(tick);
    return () => stop(false);
  }, [frameRef, pageKey]);

  return { prepareTurn, isTurning, busy, finishTurn: () => finishRef.current?.() };
}
