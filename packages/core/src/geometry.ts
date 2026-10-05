import type { Point, Rectangle } from '@aether/shared';

export const ENTITY_SIZE = 160;
export const ENTITY_HIT_RADIUS = 49;
export const DRAG_THRESHOLD = 4;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, Math.max(low, high)));
export function clampPosition(position: Point | null, workAreas: readonly Rectangle[]): Point {
  const primary = workAreas[0];
  if (!primary) throw new Error('Aucun écran disponible.');
  if (!position) return { x: primary.x + Math.max(0, primary.width - ENTITY_SIZE - 40), y: primary.y + Math.max(0, primary.height - ENTITY_SIZE - 40) };
  const center = { x: position.x + ENTITY_SIZE / 2, y: position.y + ENTITY_SIZE / 2 };
  let nearest = primary;
  let distance = Infinity;
  for (const area of workAreas) {
    const dx = center.x - clamp(center.x, area.x, area.x + area.width);
    const dy = center.y - clamp(center.y, area.y, area.y + area.height);
    const squared = dx * dx + dy * dy;
    if (squared < distance) { distance = squared; nearest = area; }
  }
  return { x: Math.round(clamp(position.x, nearest.x, nearest.x + nearest.width - ENTITY_SIZE)), y: Math.round(clamp(position.y, nearest.y, nearest.y + nearest.height - ENTITY_SIZE)) };
}
export function isEntityHit(cursor: Point, bounds: Rectangle): boolean {
  const x = cursor.x - bounds.x - ENTITY_SIZE / 2;
  const y = cursor.y - bounds.y - ENTITY_SIZE / 2;
  return x * x + y * y <= ENTITY_HIT_RADIUS * ENTITY_HIT_RADIUS;
}
