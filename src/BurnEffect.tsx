import { useEffect, useRef } from 'react';

export const BURN_DURATION_MS = 3400;

type BurnField = {
  width: number;
  height: number;
  arrival: Float32Array;
  grain: Float32Array;
  ash: Float32Array;
  surface: HTMLCanvasElement;
  surfaceContext: CanvasRenderingContext2D;
  pixels: ImageData;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function hash(x: number, y: number, seed: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function createField(width: number, height: number, seed: number, corner: number): BurnField | null {
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  const surfaceContext = surface.getContext('2d');
  if (!surfaceContext) return null;

  const arrival = new Float32Array(width * height);
  const grain = new Float32Array(width * height);
  const ash = new Float32Array(width * height);
  const fromRight = corner % 2 === 0;
  const fromBottom = corner > 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / Math.max(1, width - 1);
      const v = y / Math.max(1, height - 1);
      const broad = noise(u * 4.2, v * 4.2, seed) - .5;
      const medium = noise(u * 12, v * 12, seed + 3) - .5;
      const fine = noise(u * 37, v * 37, seed + 8) - .5;
      const distance = Math.hypot(fromRight ? 1 - u : u, (fromBottom ? 1 - v : v) * .88) / 1.33;
      const index = y * width + x;
      arrival[index] = Math.max(0, distance + broad * .24 + medium * .09 + fine * .025 - .018);
      grain[index] = hash(x, y, seed + 12);
      ash[index] = noise(u * 22, v * 22, seed + 19);
    }
  }

  return {
    width,
    height,
    arrival,
    grain,
    ash,
    surface,
    surfaceContext,
    pixels: surfaceContext.createImageData(width, height),
  };
}

function drawFlame(context: CanvasRenderingContext2D, x: number, y: number, height: number, width: number, sway: number, opacity: number) {
  const gradient = context.createLinearGradient(x, y + 3, x, y - height);
  gradient.addColorStop(0, `rgba(211, 53, 16, ${opacity})`);
  gradient.addColorStop(.32, `rgba(255, 112, 18, ${opacity * .88})`);
  gradient.addColorStop(.68, `rgba(255, 197, 72, ${opacity * .67})`);
  gradient.addColorStop(1, 'rgba(255, 236, 165, 0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(x - width, y + 3);
  context.bezierCurveTo(x - width * 1.15, y - height * .22, x - width * .38 + sway, y - height * .54, x + sway, y - height);
  context.bezierCurveTo(x + width * .17 + sway, y - height * .61, x + width * 1.3, y - height * .3, x + width, y + 3);
  context.closePath();
  context.fill();
}

export function BurnEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const seed = Math.random() * 1000;
    const corner = Math.floor(Math.random() * 4);
    const started = performance.now();
    let frame = 0;
    let field: BurnField | null = null;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      field = createField(Math.max(1, Math.round(width * .9)), Math.max(1, Math.round(height * .9)), seed, corner);
    };

    const render = (now: number) => {
      frame = window.requestAnimationFrame(render);
      if (!field) return;

      const phase = clamp((now - started) / BURN_DURATION_MS);
      const progress = 1.18 * Math.pow(phase, .88);
      const { width: fw, height: fh, arrival, grain, ash, pixels, surface, surfaceContext } = field;
      const rgba = pixels.data;

      for (let index = 0; index < arrival.length; index++) {
        const distanceBehindEdge = progress - arrival[index];
        const output = index * 4;
        if (distanceBehindEdge < -.03) {
          rgba[output + 3] = 0;
          continue;
        }

        const speck = grain[index];
        const texture = ash[index];
        if (distanceBehindEdge < 0) {
          const glow = clamp(1 + distanceBehindEdge / .03);
          rgba[output] = 255;
          rgba[output + 1] = 111 + 110 * glow;
          rgba[output + 2] = 31 + 68 * glow;
          rgba[output + 3] = 190 * glow;
          continue;
        }

        if (distanceBehindEdge < .018) {
          const heat = 1 - distanceBehindEdge / .018;
          rgba[output] = 95 + 157 * heat;
          rgba[output + 1] = 41 + 110 * heat;
          rgba[output + 2] = 26 + 23 * heat;
          rgba[output + 3] = 255;
          continue;
        }

        const aged = clamp((distanceBehindEdge - .03) / .13);
        const cinder = speck > .955 ? -88 : speck > .85 ? -38 : 0;
        const ashTone = 189 + (texture - .5) * 48 + cinder;
        const charTone = 26 + texture * 20 + (speck > .96 ? 53 : 0);
        rgba[output] = charTone * (1 - aged) + ashTone * aged;
        rgba[output + 1] = (charTone - 7) * (1 - aged) + (ashTone - 8) * aged;
        rgba[output + 2] = (charTone - 10) * (1 - aged) + (ashTone - 20) * aged;
        rgba[output + 3] = 255;
      }

      surfaceContext.putImageData(pixels, 0, 0);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.drawImage(surface, 0, 0, width, height);

      const front: Array<{ x: number; y: number }> = [];
      for (let y = 3; y < fh; y += 9) {
        for (let x = 3; x < fw; x += 9) {
          if (Math.abs(arrival[y * fw + x] - progress) < .013) {
            front.push({ x: x * width / fw, y: y * height / fh });
          }
        }
      }
      if (front.length === 0 && phase < .12) front.push({ x: corner % 2 === 0 ? width - 8 : 8, y: corner > 1 ? height - 8 : 8 });

      context.save();
      context.globalCompositeOperation = 'screen';
      context.shadowColor = 'rgba(255, 105, 21, .65)';
      context.shadowBlur = 9;
      for (let index = 0; index < front.length; index += 3) {
        const point = front[index];
        const variation = hash(index, 4, seed);
        const flicker = Math.sin(now * .014 + index * 2.4) * 3;
        drawFlame(context, point.x, point.y, 8 + variation * 18 + flicker, 2 + variation * 3, Math.sin(now * .008 + index) * 3, .52);
      }
      context.restore();

      for (let index = 0; index < Math.min(32, front.length * 2); index++) {
        const point = front[(index * 13) % front.length];
        const cycle = (now * (.00035 + hash(index, 2, seed) * .00035) + hash(index, 3, seed)) % 1;
        const x = point.x + (hash(index, 4, seed) - .5) * 22 + cycle * 14;
        const y = point.y - cycle * (28 + hash(index, 5, seed) * 70);
        const radius = .6 + hash(index, 6, seed) * 1.5;
        context.beginPath();
        context.fillStyle = `rgba(255, ${115 + Math.round(100 * (1 - cycle))}, ${42 + Math.round(65 * (1 - cycle))}, ${(1 - cycle) * .8})`;
        context.shadowColor = '#ff8428';
        context.shadowBlur = 5;
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.shadowBlur = 0;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    frame = window.requestAnimationFrame(render);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} className="burn-canvas" aria-hidden="true" />;
}
