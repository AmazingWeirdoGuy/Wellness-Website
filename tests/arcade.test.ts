import assert from 'node:assert/strict';
import test from 'node:test';
import { canPlaceStack, createStackGame, drawStackKind, emptyStackBoard, findPetalHit, hardDropStack, lockStack, makeStackPiece, moveStack, PETAL_HIT_Y, rotateStack, stackCells, stackLanding } from '../src/arcadeLogic.ts';

test('a petal only scores in the pressed lane and near the timing line', () => {
  const note = { id: 1, lane: 2, y: PETAL_HIT_Y + 10, midi: 64 };
  assert.equal(findPetalHit([note], 2), note);
  assert.equal(findPetalHit([note], 1), undefined);
  assert.equal(findPetalHit([{ ...note, y: 100 }], 2), undefined);
  assert.equal(findPetalHit([{ ...note, y: PETAL_HIT_Y + 55 }], 2), undefined);
});
test('one key press chooses only the closest petal', () => {
  const early = { id: 1, lane: 0, y: PETAL_HIT_Y - 40, midi: 60 };
  const closest = { ...early, id: 2, y: PETAL_HIT_Y + 5 };
  assert.equal(findPetalHit([early, closest], 0)?.id, 2);
});
test('each shuffled bag includes every piece once', () => {
  let bag: number[] = [];
  for (let batch = 0; batch < 3; batch++) {
    const seen = [];
    for (let i = 0; i < 7; i++) { const next = drawStackKind(bag, () => .37); seen.push(next.kind); bag = next.bag; }
    assert.deepEqual(seen.sort(), [0, 1, 2, 3, 4, 5, 6]);
  }
});
test('pieces stay inside walls and cannot pass through settled blocks', () => {
  const game = createStackGame();
  game.active = { ...makeStackPiece(3), x: 0, y: 17 };
  assert.equal(moveStack(game, -1), game);
  game.board[19][0] = 1;
  assert.equal(moveStack(game, 0, 1), game);
  assert.ok(canPlaceStack(game.board, game.active));
});
test('rotation recovers at the floor without crossing occupied cells', () => {
  const game = createStackGame();
  game.active = { ...makeStackPiece(0), y: 18 };
  const rotated = rotateStack(game);
  assert.notEqual(rotated, game);
  assert.ok(canPlaceStack(game.board, rotated.active));
  assert.equal(new Set(stackCells(rotated.active).map((cell) => cell.x)).size, 1);
});
test('four rotations preserve a piece away from obstacles', () => {
  let game = createStackGame();
  game.active = { ...makeStackPiece(5), y: 5 };
  const original = game.active;
  for (let i = 0; i < 4; i++) game = rotateStack(game);
  assert.deepEqual(game.active, original);
});
test('hard drop lands above obstacles, locks once, and awards distance', () => {
  const game = createStackGame();
  game.active = { ...makeStackPiece(3), x: 4 };
  game.board[15][4] = 1;
  assert.equal(stackLanding(game).y, 13);
  const dropped = hardDropStack(game, () => .5);
  assert.equal(dropped.board[13][4], 4);
  assert.equal(dropped.board[14][5], 4);
  assert.equal(dropped.board[15][4], 1);
  assert.equal(dropped.score, 26);
  assert.equal(game.board[13][4], 0, 'the previous board is not mutated');
});
test('clearing two rows shifts the remaining blocks and scores both rows', () => {
  const game = createStackGame();
  game.board[18] = Array(10).fill(1); game.board[19] = Array(10).fill(1);
  game.board[18][4] = 0; game.board[18][5] = 0; game.board[19][4] = 0; game.board[19][5] = 0;
  game.board[17][1] = 2;
  game.active = { ...makeStackPiece(3), x: 4, y: 18 };
  const next = lockStack(game, () => .5);
  assert.equal(next.lines, 2); assert.equal(next.score, 300);
  assert.equal(next.board[19][1], 2); assert.equal(next.board.length, 20);
  assert.ok(next.board[0].every((cell) => cell === 0));
});
test('a blocked spawn ends the round and prevents further moves', () => {
  const game = createStackGame();
  game.board[0] = Array(10).fill(2); game.board[0][0] = 0;
  game.active = { ...makeStackPiece(3), x: 0, y: 18 }; game.next = 3;
  const over = lockStack(game, () => .5);
  assert.equal(over.over, true);
  assert.equal(hardDropStack(over), over);
  assert.equal(moveStack(over, 1), over);
});
test('locking above the top ends the round without writing outside the board', () => {
  const game = createStackGame(); game.board = emptyStackBoard();
  game.active = { ...makeStackPiece(3), y: -1 };
  assert.equal(lockStack(game).over, true);
});
