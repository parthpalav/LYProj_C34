export type Point = { x: number; y: number };

/** Smooth SVG path through the points (Catmull-Rom converted to cubic Béziers). */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Monotone cubic path (Fritsch-Carlson): smooth like `smoothPath`, but never overshoots the data,
 * so a spending line can't dip below zero or bulge past a spike. Expects points sorted by x.
 */
export function monotonePath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n < 3) return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    m[i] = (points[i + 1].y - points[i].y) / dx[i];
  }
  // Tangents: weighted harmonic mean of neighbouring slopes, flat at peaks and valleys.
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }
  t[n - 1] = m[n - 2];
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const p = points[i];
    const q = points[i + 1];
    d += ` C ${p.x + h} ${p.y + h * t[i]}, ${q.x - h} ${q.y - h * t[i + 1]}, ${q.x} ${q.y}`;
  }
  return d;
}
