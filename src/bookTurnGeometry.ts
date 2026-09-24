export const PAGE_SEGMENTS = 96;

export function turnProgress(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  // Start moving promptly, with zero velocity at both ends. A gentler middle
  // speed keeps the shorter turn from rushing through the fold.
  return p * p * (3 - 2 * p);
}

export function writePageMesh(
  vertices: Float32Array,
  page: { width: number; height: number; left: number; top: number },
  progress: number,
  forward: boolean,
) {
  const eased = turnProgress(progress);
  const angle = Math.PI * eased;
  // Flex toward the lift, pass smoothly through neutral at the spine, then
  // flex the other way on landing. The return turn mirrors the same motion.
  const bend = Math.pow(Math.sin(angle), 1.35) * Math.cos(angle) * 0.8;
  const step = page.width / PAGE_SEGMENTS;
  const sign = forward ? 1 : -1;
  const spine = forward ? page.left : page.left + page.width;
  let x = 0;
  let z = 0;
  for (let segment = 0; segment <= PAGE_SEGMENTS; segment++) {
    const u = forward ? segment / PAGE_SEGMENTS : 1 - segment / PAGE_SEGMENTS;
    // Exact flat endpoints prevent subpixel shifts when the texture is removed.
    if (eased === 0 || eased === 1) {
      x = (eased === 0 ? 1 : -1) * segment * step;
      z = 0;
    }
    // Reuse the vertex buffer without creating arrays during each frame.
    const offset = segment * 10;
    vertices[offset] = vertices[offset + 5] = spine + sign * x;
    vertices[offset + 1] = page.top;
    vertices[offset + 6] = page.top + page.height;
    vertices[offset + 2] = vertices[offset + 7] = z;
    vertices[offset + 3] = vertices[offset + 8] = u;
    vertices[offset + 4] = 0;
    vertices[offset + 9] = 1;
    const along = (segment + 0.5) / PAGE_SEGMENTS;
    // Most flex lives toward the free edge; the binding remains gently curved.
    const rotation = angle + bend * (along * along - 1 / 3);
    x += Math.cos(rotation) * step;
    z += Math.sin(rotation) * step;
  }
}
