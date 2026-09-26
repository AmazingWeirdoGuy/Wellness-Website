export const CLOVER_BOARD_WIDTH = 600;
export const CLOVER_MOVE_SPEED = 360;

type HorizontalState = { x: number; vx: number };
export type CloverDirection = -1 | 0 | 1;

// Distances are in SVG coordinates; acceleration uses seconds so steering
// feels the same on phones, standard displays, and high-refresh displays.
export function stepCloverSteering(
  player: HorizontalState,
  direction: CloverDirection,
  dt: number,
  targetX?: number,
): HorizontalState {
  if (dt <= 0) return player;
  const targetVelocity = targetX === undefined
    ? direction * CLOVER_MOVE_SPEED
    : Math.max(-CLOVER_MOVE_SPEED, Math.min(CLOVER_MOVE_SPEED, (targetX - player.x) * 14));
  const reversing = player.vx * targetVelocity < 0;
  const slowing = Math.abs(targetVelocity) < Math.abs(player.vx);
  const acceleration = reversing ? 10000 : slowing ? 9000 : 6000;
  const change = targetVelocity - player.vx;
  const timeToTarget = Math.abs(change) / acceleration;
  const acceleratingTime = Math.min(dt, timeToTarget);
  const vx = timeToTarget <= dt ? targetVelocity : player.vx + Math.sign(change) * acceleration * acceleratingTime;
  let x = player.x + (player.vx + vx) * .5 * acceleratingTime + vx * (dt - acceleratingTime);

  // A pointer gives an exact landing target. Stop at it instead of oscillating
  // around it or carrying momentum past the user's finger.
  if (targetX !== undefined && (
    (targetX - player.x) * (targetX - x) <= 0 ||
    (Math.abs(targetX - x) < .5 && Math.abs(vx) < 10)
  )) {
    x = targetX;
    return { x, vx: 0 };
  }
  return { x, vx };
}

export const wrapCloverX = (x: number) => ((x % CLOVER_BOARD_WIDTH) + CLOVER_BOARD_WIDTH) % CLOVER_BOARD_WIDTH;
