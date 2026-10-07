export function bookTurnTiming(count: number) {
  const leaves = Math.max(1, Math.min(5, Math.round(count) || 1));
  const duration = leaves === 1 ? 520 : 420;
  const stagger = 55;
  return { leaves, duration, stagger, total: duration + (leaves - 1) * stagger };
}
