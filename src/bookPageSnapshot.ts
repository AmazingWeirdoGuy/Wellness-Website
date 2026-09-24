import { toSvg } from 'html-to-image';

export type PaperSnapshot = {
  node: HTMLElement;
  scroll: Array<{ index: number; top: number; left: number }>;
  width: number;
  height: number;
  left: number;
  top: number;
};

let copyId = 0;

export function copyContents(source: HTMLElement) {
  const node = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll<HTMLElement>('*')];
  const copies = [node, ...node.querySelectorAll<HTMLElement>('*')];
  const scroll: PaperSnapshot['scroll'] = [];
  const ids = new Map<string, string>();
  const prefix = `paper-copy-${++copyId}-`;
  originals.forEach((original, index) => {
    const copy = copies[index];
    if (original.scrollTop || original.scrollLeft) scroll.push({ index, top: original.scrollTop, left: original.scrollLeft });
    // Keep fractional font sizes exactly. The rasterizer's font-size heuristic
    // otherwise changes line breaks between the live page and its texture.
    if (original.isConnected && copy.style) copy.style.fontSize = getComputedStyle(original).fontSize;
    if (original instanceof HTMLTextAreaElement && copy instanceof HTMLTextAreaElement) copy.value = original.value;
    if (original instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
      copy.value = original.value;
      copy.checked = original.checked;
    }
    if (original instanceof HTMLSelectElement && copy instanceof HTMLSelectElement) copy.selectedIndex = original.selectedIndex;
    if (original instanceof HTMLCanvasElement && copy instanceof HTMLCanvasElement && original.width && original.height) copy.getContext('2d')?.drawImage(original, 0, 0);
    if (copy.id) { ids.set(copy.id, prefix + copy.id); copy.id = prefix + copy.id; }
    copy.removeAttribute('data-testid');
    copy.removeAttribute('autofocus');
    copy.removeAttribute('name');
  });
  copies.forEach((copy) => {
    for (const attribute of Array.from(copy.attributes)) {
      if (attribute.name === 'id') continue;
      let value = attribute.value.replace(/url\(#([^)]*)\)/g, (_, id: string) => `url(#${ids.get(id) ?? id})`);
      if (value.startsWith('#') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
      if (['for', 'aria-labelledby', 'aria-describedby', 'aria-controls'].includes(attribute.name)) value = value.split(' ').map((id) => ids.get(id) ?? id).join(' ');
      if (value !== attribute.value) copy.setAttribute(attribute.name, value);
    }
  });
  return { node, scroll };
}

export function capturePages(frame: HTMLElement): PaperSnapshot[] {
  const bounds = frame.getBoundingClientRect();
  return Array.from(frame.querySelectorAll<HTMLElement>(':scope > .spread > .sheet')).map((page) => {
    const rect = page.getBoundingClientRect();
    const snapshot = copyContents(page);
    const style = getComputedStyle(page);
    snapshot.node.style.borderLeft = style.borderLeft;
    snapshot.node.style.borderTop = style.borderTop;
    // The live paper is translucent over the book's backing. Flatten that
    // color so neither the old nor new lettering bleeds through a turn.
    const swatch = document.createElement('canvas');
    swatch.width = swatch.height = 1;
    const context = swatch.getContext('2d')!;
    context.fillStyle = '#f7efdf'; context.fillRect(0, 0, 1, 1);
    context.fillStyle = style.backgroundColor; context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    snapshot.node.style.backgroundColor = `rgb(${red}, ${green}, ${blue})`;
    return { ...snapshot, width: rect.width, height: rect.height, left: rect.left - bounds.left, top: rect.top - bounds.top };
  });
}

export function mountCopy(snapshot: PaperSnapshot, parent: HTMLElement) {
  const { node } = copyContents(snapshot.node);
  node.classList.add('book-turn-copy');
  Object.assign(node.style, { width: `${snapshot.width}px`, height: `${snapshot.height}px`, left: `${snapshot.left}px`, top: `${snapshot.top}px` });
  parent.append(node);
  const elements = [node, ...node.querySelectorAll<HTMLElement>('*')];
  snapshot.scroll.forEach(({ index, top, left }) => elements[index]?.scrollTo({ top, left, behavior: 'instant' }));
  return node;
}

// This is a temporary, local image of the page. It is never saved or uploaded.
export async function rasterizePage(snapshot: PaperSnapshot, parent: HTMLElement) {
  const node = mountCopy(snapshot, parent);
  try {
    const textScroll = new Map(Array.from(node.querySelectorAll('textarea'), (input) => [input, input.scrollTop]));
    // SVG images cannot retain native scroll positions. Translate an inner
    // layout with the original content width, including its scrollbar gutter.
    for (const area of node.querySelectorAll<HTMLElement>('.sheet-content')) {
      const style = getComputedStyle(area);
      const width = area.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = area.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const inner = document.createElement('div');
      Object.assign(inner.style, { display: style.display, flexDirection: style.flexDirection, gap: style.gap, width: `${width}px`, height: `${height}px`, transform: `translate(${-area.scrollLeft}px, ${-area.scrollTop}px)` });
      Array.from(area.children).forEach((child) => {
        if (child instanceof HTMLElement) child.style.flexShrink = getComputedStyle(child).flexShrink;
      });
      inner.append(...Array.from(area.childNodes));
      area.append(inner);
      Object.assign(area.style, { display: 'block', overflow: 'hidden', scrollbarGutter: 'auto' });
    }
    for (const input of node.querySelectorAll<HTMLTextAreaElement>('textarea')) {
      const style = getComputedStyle(input);
      const replacement = document.createElement('div');
      replacement.className = input.className;
      replacement.style.cssText = input.style.cssText;
      Object.assign(replacement.style, { height: style.height, width: style.width, flex: style.flex, overflow: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
      const text = document.createElement('div');
      text.textContent = input.value || input.placeholder;
      text.style.transform = `translateY(${-(textScroll.get(input) ?? 0)}px)`;
      if (!input.value) {
        const placeholder = getComputedStyle(input, '::placeholder');
        text.style.color = placeholder.color;
        text.style.fontStyle = placeholder.fontStyle;
      }
      replacement.append(text);
      input.replaceWith(replacement);
    }
    const properties = Array.from(getComputedStyle(node)).filter((property) => property !== 'font-size');
    const svg = await toSvg(node, {
      width: snapshot.width, height: snapshot.height,
      skipFonts: true,
      includeStyleProperties: properties,
      style: { left: '0', top: '0', margin: '0', position: 'relative' },
    });
    // Decode directly: the library's canvas helper waits an extra animation
    // frame after decoding, which adds a pause before every page turn.
    const image = new Image();
    image.decoding = 'async';
    image.src = svg;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(snapshot.width * 2);
    canvas.height = Math.ceil(snapshot.height * 2);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    node.remove();
  }
}
