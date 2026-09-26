import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOVER_MOVE_SPEED, stepCloverSteering, wrapCloverX } from '../src/cloverMovement.ts';

test('releasing a direction stops within 50ms and less than 10px of drift', () => {
  let player = { x: 300, vx: CLOVER_MOVE_SPEED };
  for (let frame = 0; frame < 3; frame++) player = stepCloverSteering(player, 0, 1 / 60);
  assert.equal(player.vx, 0);
  assert.ok(player.x > 300 && player.x < 310);
  const stopped = stepCloverSteering(player, 0, 1 / 60);
  assert.deepEqual(stopped, player);
});

test('changing direction begins travelling the other way within 50ms', () => {
  let player = { x: 300, vx: CLOVER_MOVE_SPEED };
  for (let frame = 0; frame < 3; frame++) player = stepCloverSteering(player, -1, 1 / 60);
  assert.ok(player.vx < 0);
  assert.ok(player.x < 310, 'reversing should not slide past the intended landing');
});

test('keyboard travel and braking are consistent at 30, 60, and 120Hz', () => {
  const runs = [30, 60, 120].map((hz) => {
    let player = { x: 100, vx: 0 };
    for (let frame = 0; frame < hz / 2; frame++) player = stepCloverSteering(player, 1, 1 / hz);
    assert.equal(player.vx, CLOVER_MOVE_SPEED);
    for (let frame = 0; frame < hz / 10; frame++) player = stepCloverSteering(player, 0, 1 / hz);
    assert.equal(player.vx, 0);
    return player.x;
  });
  assert.ok(Math.max(...runs) - Math.min(...runs) < .001);
});

test('drag steering reaches and holds the pointer without overshooting either way', () => {
  for (const hz of [30, 60, 120]) for (const targetX of [220, 440]) {
    let player = { x: 300, vx: CLOVER_MOVE_SPEED };
    for (let frame = 0; frame < hz; frame++) {
      player = stepCloverSteering(player, 0, 1 / hz, targetX);
      assert.ok(targetX < 300 ? player.x >= targetX : player.x <= targetX);
    }
    assert.equal(player.x, targetX);
    assert.equal(player.vx, 0);
  }
});

test('edge wrapping preserves overshoot with no invisible travel outside the board', () => {
  assert.equal(wrapCloverX(604), 4);
  assert.equal(wrapCloverX(-4), 596);
  assert.equal(wrapCloverX(600), 0);
});
