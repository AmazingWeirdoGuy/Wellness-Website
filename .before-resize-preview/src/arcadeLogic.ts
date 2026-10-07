export type ArcadeGameProps = { best: number; onBest: (score: number) => void };
export type PetalNote = { id: number; lane: number; y: number; midi: number };
export const PETAL_HIT_Y = 356;
export const PETAL_HIT_WINDOW = 54;

export function findPetalHit(notes: PetalNote[], lane: number): PetalNote | undefined {
  return notes.filter((note) => note.lane === lane && Math.abs(note.y - PETAL_HIT_Y) <= PETAL_HIT_WINDOW)
    .sort((a, b) => Math.abs(a.y - PETAL_HIT_Y) - Math.abs(b.y - PETAL_HIT_Y))[0];
}

export const STACK_WIDTH = 10;
export const STACK_HEIGHT = 20;
export const STACK_COLORS = ['#859879', '#c7826d', '#ab869e', '#d6b068', '#809ca2', '#aa927a', '#b56f79'];
const SHAPES = [
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  [[1, 1], [1, 1]],
  [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
];
export type StackPiece = { kind: number; x: number; y: number; shape: number[][] };
export type StackGame = { board: number[][]; active: StackPiece; next: number; bag: number[]; score: number; lines: number; over: boolean };
export type StackCell = { x: number; y: number; kind: number };

export const emptyStackBoard = () => Array.from({ length: STACK_HEIGHT }, () => Array<number>(STACK_WIDTH).fill(0));
export const stackLevel = (lines: number) => 1 + Math.floor(lines / 8);
export function makeStackPiece(kind: number): StackPiece {
  const shape = SHAPES[kind].map((row) => [...row]);
  return { kind, shape, x: Math.floor((STACK_WIDTH - shape.length) / 2), y: 0 };
}
export function stackCells(piece: StackPiece): StackCell[] {
  return piece.shape.flatMap((row, y) => row.flatMap((filled, x) => filled ? [{ x: x + piece.x, y: y + piece.y, kind: piece.kind }] : []));
}
export function canPlaceStack(board: number[][], piece: StackPiece) {
  return stackCells(piece).every(({ x, y }) => x >= 0 && x < STACK_WIDTH && y < STACK_HEIGHT && (y < 0 || board[y][x] === 0));
}
export function drawStackKind(bag: number[], random: () => number = Math.random) {
  const remaining = [...bag];
  if (!remaining.length) {
    remaining.push(0, 1, 2, 3, 4, 5, 6);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
  }
  return { kind: remaining.pop()!, bag: remaining };
}
export function createStackGame(random: () => number = Math.random): StackGame {
  const first = drawStackKind([], random);
  const second = drawStackKind(first.bag, random);
  return { board: emptyStackBoard(), active: makeStackPiece(first.kind), next: second.kind, bag: second.bag, score: 0, lines: 0, over: false };
}
export function moveStack(game: StackGame, dx: number, dy = 0): StackGame {
  if (game.over) return game;
  const active = { ...game.active, x: game.active.x + dx, y: game.active.y + dy };
  return canPlaceStack(game.board, active) ? { ...game, active } : game;
}
export function rotateStack(game: StackGame, clockwise = true): StackGame {
  if (game.over || game.active.kind === 3) return game;
  const old = game.active.shape;
  const n = old.length;
  const shape = old.map((row, y) => row.map((_, x) => clockwise ? old[n - 1 - x][y] : old[x][n - 1 - y]));
  // Small wall/floor adjustments keep rotation usable near settled pieces.
  for (const dy of [0, -1, -2]) for (const dx of [0, -1, 1, -2, 2]) {
    const active = { ...game.active, shape, x: game.active.x + dx, y: game.active.y + dy };
    if (canPlaceStack(game.board, active)) return { ...game, active };
  }
  return game;
}
export function stackLanding(game: StackGame): StackPiece {
  let active = game.active;
  while (canPlaceStack(game.board, { ...active, y: active.y + 1 })) active = { ...active, y: active.y + 1 };
  return active;
}
export function lockStack(game: StackGame, random: () => number = Math.random): StackGame {
  if (game.over) return game;
  const cells = stackCells(game.active);
  if (cells.some(({ y }) => y < 0) || !canPlaceStack(game.board, game.active)) return { ...game, over: true };
  const board = game.board.map((row) => [...row]);
  cells.forEach(({ x, y, kind }) => { board[y][x] = kind + 1; });
  const remaining = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = STACK_HEIGHT - remaining.length;
  const nextBoard = [...Array.from({ length: cleared }, () => Array<number>(STACK_WIDTH).fill(0)), ...remaining];
  const upcoming = drawStackKind(game.bag, random);
  const active = makeStackPiece(game.next);
  return { board: nextBoard, active, next: upcoming.kind, bag: upcoming.bag,
    score: game.score + [0, 100, 300, 500, 800][cleared] * stackLevel(game.lines),
    lines: game.lines + cleared, over: !canPlaceStack(nextBoard, active) };
}
export function hardDropStack(game: StackGame, random: () => number = Math.random) {
  if (game.over) return game;
  const active = stackLanding(game);
  return lockStack({ ...game, active, score: game.score + (active.y - game.active.y) * 2 }, random);
}
