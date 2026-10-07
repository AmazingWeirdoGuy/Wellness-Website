import { capturePages, mountCopy, rasterizePage, warmPageFonts } from '../src/bookPageSnapshot';

const result = document.querySelector<HTMLElement>('#result')!;
const frame = document.querySelector<HTMLElement>('.page-turn-frame')!;

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function measure(root: HTMLElement) {
  const bounds = root.getBoundingClientRect();
  return [root, ...root.querySelectorAll<HTMLElement>('*:not(style)')].map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      box: [rect.x - bounds.x, rect.y - bounds.y, rect.width, rect.height],
      font: getComputedStyle(element).font,
      scroll: [element.scrollTop, element.scrollLeft],
    };
  });
}

// Compare rendered ink with an independent canvas using the loaded web font.
// DOM bounds alone miss a font substituted inside the standalone SVG image.
function checkRenderedFont(image: HTMLCanvasElement, page: HTMLElement, probe: HTMLElement) {
  const pageBounds = page.getBoundingClientRect();
  const bounds = probe.getBoundingClientRect();
  const scaleX = image.width / pageBounds.width;
  const scaleY = image.height / pageBounds.height;
  const cropWidth = Math.ceil(bounds.width * scaleX);
  const cropHeight = Math.ceil(bounds.height * scaleY);
  const reference = document.createElement('canvas');
  reference.width = cropWidth;
  reference.height = cropHeight;
  const context = reference.getContext('2d')!;
  context.fillStyle = 'white';
  context.fillRect(0, 0, cropWidth, cropHeight);
  context.scale(scaleX, scaleY);
  context.font = getComputedStyle(probe).font;
  context.textBaseline = 'top';
  context.fillStyle = '#493430';
  context.fillText(probe.textContent!, 0, 0);
  const ink = (pixels: Uint8ClampedArray) => {
    let count = 0;
    for (let channel = 0; channel < pixels.length; channel += 4) if (pixels[channel] < 170 && pixels[channel + 3] > 200) count++;
    return count;
  };
  const expected = ink(context.getImageData(0, 0, cropWidth, cropHeight).data);
  const actual = ink(image.getContext('2d')!.getImageData(Math.round((bounds.x - pageBounds.x) * scaleX), Math.round((bounds.y - pageBounds.y) * scaleY), cropWidth, cropHeight).data);
  if (Math.abs(actual / expected - 1) >= .1) {
    const crop = document.createElement('canvas');
    crop.width = cropWidth;
    crop.height = cropHeight;
    crop.getContext('2d')!.putImageData(image.getContext('2d')!.getImageData(Math.round((bounds.x - pageBounds.x) * scaleX), Math.round((bounds.y - pageBounds.y) * scaleY), cropWidth, cropHeight), 0, 0);
    document.body.append(crop, reference);
  }
  assert(expected > 0 && Math.abs(actual / expected - 1) < .1, `Rendered font weight changed: ${actual} ink pixels versus ${expected}`);
}

try {
  await document.fonts.ready;
  const fontSheet = new CSSStyleSheet();
  fontSheet.replaceSync(await warmPageFonts());
  const faces = Array.from(fontSheet.cssRules).filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule);
  assert(faces.length >= 2, 'Regular and italic font faces must be embedded');
  assert(faces.every((face) => face.style.getPropertyValue('src').includes('data:')), 'Snapshot dropped a font source');
  const successes: string[] = [];
  for (const width of [858.25, 970.5, 1120]) {
    frame.style.width = `${width}px`;
    const pages = Array.from(frame.querySelectorAll<HTMLElement>(':scope > .spread > .sheet'));
    pages[1].querySelector('.sheet-content')!.scrollTop = 37;
    const originals = pages.map(measure);
    const snapshots = capturePages(frame);
    const overlay = document.createElement('div');
    overlay.className = 'book-turn-overlay';
    frame.append(overlay);
    for (const [index, snapshot] of snapshots.entries()) {
      const copy = mountCopy(snapshot, overlay);
      const measurements = measure(copy);
      assert(measurements.length === originals[index].length, 'Element count changed');
      originals[index].forEach((original, elementIndex) => {
        const actual = measurements[elementIndex];
        assert(original.box.every((value, axis) => Math.abs(value - actual.box[axis]) < .05), `Layout moved at width ${width}, page ${index}, element ${elementIndex}`);
        assert(original.font === actual.font, 'Font changed outside the spread');
        assert(original.scroll.every((value, axis) => value === actual.scroll[axis]), 'Scroll position changed');
      });
      const originalTitle = pages[index].querySelector('.fixture-title')!;
      const copyTitle = copy.querySelector('.fixture-title')!;
      for (const property of ['content', 'color', 'font-size']) {
        assert(getComputedStyle(originalTitle, '::after').getPropertyValue(property) === getComputedStyle(copyTitle, '::after').getPropertyValue(property), `Generated text lost ${property}`);
      }
      if (index === 0) {
        assert(copy.querySelector('textarea')!.value === pages[0].querySelector('textarea')!.value, 'Entry changed');
        assert(copy.querySelector('input')!.checked, 'Checkbox state changed');
      }
      copy.remove();
      let rasterLayoutChecked = false;
      let rasterLayoutError: string | undefined;
      const observer = new MutationObserver(() => {
        const working = overlay.querySelector<HTMLElement>('.book-turn-copy');
        // Wait until the native scroll viewport has been prepared for SVG.
        if (!working || working.querySelector('.sheet-content')?.firstElementChild?.tagName !== 'DIV') return;
        const sourceBounds = pages[index].getBoundingClientRect();
        const copyBounds = working.getBoundingClientRect();
        for (const selector of ['.sheet-content', '.fixture-title', '.fixture-grid', '.fixture-grid button', '.writing-area', '.fixture-scroll']) {
          const source = pages[index].querySelector(selector);
          const target = working.querySelector(selector);
          if (!source || !target) continue;
          const a = source.getBoundingClientRect();
          const b = target.getBoundingClientRect();
          const delta = [a.x - sourceBounds.x - b.x + copyBounds.x, a.y - sourceBounds.y - b.y + copyBounds.y, a.width - b.width, a.height - b.height];
          if (delta.some((value) => Math.abs(value) > .05)) rasterLayoutError = `Raster preparation moved ${selector}: ${delta.join(', ')}`;
        }
        rasterLayoutChecked = true;
      });
      observer.observe(overlay, { childList: true, subtree: true });
      const image = await rasterizePage(snapshot, overlay);
      observer.disconnect();
      assert(rasterLayoutChecked, 'Raster layout was not checked');
      assert(!rasterLayoutError, rasterLayoutError ?? 'Raster layout changed');
      const pixels = image.getContext('2d')!.getImageData(0, 0, image.width, image.height).data;
      assert(pixels.some((value, channel) => channel % 4 === 3 && value > 0), 'Rasterized page is empty');
      pages[index].querySelectorAll<HTMLElement>('.font-probe').forEach((probe) => checkRenderedFont(image, pages[index], probe));
      assert(!overlay.querySelector('.book-turn-copy'), 'Temporary capture retained');
      image.width = image.height = 0;
    }
    overlay.remove();
    successes.push(`PASS ${width}px: exact layout, rendered font weight, decorations, scroll, input state, and rasterization`);
  }
  result.textContent = successes.join('\n');
  result.dataset.status = 'passed';
} catch (error) {
  result.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  result.dataset.status = 'failed';
}
