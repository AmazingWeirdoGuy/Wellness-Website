import assert from 'node:assert/strict';
import test from 'node:test';
import { PAGE_SEGMENTS, turnProgress, writePageMesh } from '../src/bookTurnGeometry.ts';
import { bookTurnTiming } from '../src/bookTurnTiming.ts';

const paper = { width: 584.5, height: 768, left: 49, top: 1 };
const mesh = (progress: number, forward = true) => {
  const result = new Float32Array((PAGE_SEGMENTS + 1) * 10);
  writePageMesh(result, paper, progress, forward);
  return result;
};
const close = (actual: number, expected: number, tolerance = 0.00015) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be close to ${expected}`);

test('both directions start and land exactly flat at the binding', () => {
  for (const forward of [true, false]) for (const progress of [0, 1]) {
    const points = mesh(progress, forward);
    const spine = forward ? paper.left : paper.left + paper.width;
    const sign = (forward ? 1 : -1) * (progress === 0 ? 1 : -1);
    for (let column = 0; column <= PAGE_SEGMENTS; column++) {
      close(points[column * 10], spine + sign * column * paper.width / PAGE_SEGMENTS);
      assert.equal(points[column * 10 + 2], 0);
      assert.equal(points[column * 10 + 7], 0);
    }
  }
});

test('the fold never stretches paper, detaches from the spine, or dips below the book', () => {
  for (const forward of [true, false]) for (const progress of [0.01, 0.15, 0.3, 0.5, 0.7, 0.85, 0.99]) {
    const points = mesh(progress, forward);
    close(points[0], forward ? paper.left : paper.left + paper.width);
    assert.equal(points[2], 0);
    for (let column = 1; column <= PAGE_SEGMENTS; column++) {
      const offset = column * 10;
      const distance = Math.hypot(points[offset] - points[offset - 10], points[offset + 2] - points[offset - 8]);
      close(distance, paper.width / PAGE_SEGMENTS);
      assert.ok(points[offset + 2] >= 0);
      close(points[offset + 6] - points[offset + 1], paper.height);
    }
  }
});

test('reverse turns mirror the curve and retain continuous texture coordinates', () => {
  const next = mesh(0.41);
  const previous = mesh(0.41, false);
  for (let column = 0; column <= PAGE_SEGMENTS; column++) {
    const offset = column * 10;
    close(next[offset] + previous[offset], paper.left * 2 + paper.width);
    close(next[offset + 2], previous[offset + 2]);
    close(next[offset + 3] + previous[offset + 3], 1);
    close(next[offset + 3], next[offset + 8]);
  }
});

test('motion starts and ends gently without overshooting', () => {
  assert.equal(turnProgress(-1), 0);
  assert.equal(turnProgress(2), 1);
  assert.ok(turnProgress(0.0001) < 0.0000001);
  assert.ok(1 - turnProgress(0.9999) < 0.0000001);
  let last = 0;
  for (let step = 0; step <= 100; step++) {
    const current = turnProgress(step / 100);
    assert.ok(current >= last && current <= 1);
    last = current;
  }
});

test('page skips stay brief and each leaf lands at the end of the shared timeline', () => {
  for (const distance of [1, 2, 3, 4, 5, 100]) {
    const { leaves, duration, stagger, total } = bookTurnTiming(distance);
    assert.ok(total <= 650, 'even a full-book skip should finish within 650ms');
    assert.equal(total - (leaves - 1) * stagger, duration);
    assert.ok(stagger < duration / 4, 'leaves overlap rather than waiting their turn');
  }
  assert.ok(turnProgress(0.1) >= 0.025, 'the lift should respond during the first 10% of a turn');
});

test('paper flexes in opposite directions before and after crossing the spine', () => {
  for (const forward of [true, false]) {
    const curvature = (progress: number) => {
      const points = mesh(progress, forward);
      const sign = forward ? 1 : -1;
      const tangent = (column: number) => {
        const offset = column * 10;
        return Math.atan2(points[offset + 12] - points[offset + 2], sign * (points[offset + 10] - points[offset]));
      };
      return tangent(PAGE_SEGMENTS - 1) - tangent(0);
    };
    assert.ok(curvature(0.35) > 0.1, 'the outer edge should curl during lift');
    close(curvature(0.5), 0);
    assert.ok(curvature(0.65) < -0.1, 'the curl should reverse during landing');
  }
});

test('lift and landing mirror each other without an extra wobble', () => {
  for (const forward of [true, false]) {
    const lift = mesh(0.28, forward);
    const landing = mesh(0.72, forward);
    const spine = forward ? paper.left : paper.left + paper.width;
    for (let column = 0; column <= PAGE_SEGMENTS; column++) {
      const offset = column * 10;
      close(lift[offset] + landing[offset], spine * 2);
      close(lift[offset + 2], landing[offset + 2]);
    }
  }
});
