import type { CSSProperties } from "react";

// Line-drawn axonometric villa for the hero. Faces are filled with the background colour so
// hidden edges are masked, and every outline draws itself in on load (see .bp in globals.css).
const C30 = Math.cos(Math.PI / 6);
const S60 = Math.sin(Math.PI / 3);
const proj = (x: number, b: number, z: number): [number, number] => [x * C30 - b * 0.5, -(x * 0.5) - b * S60 - z];

type Shape = { d: string; cls?: string; delay: number };

function quad(points: [number, number, number][]) {
  return "M" + points.map((p) => proj(...p).map((n) => n.toFixed(2)).join(" ")).join(" L") + " Z";
}
function line(a: [number, number, number], b: [number, number, number]) {
  return `M${proj(...a).map((n) => n.toFixed(2)).join(" ")} L${proj(...b).map((n) => n.toFixed(2)).join(" ")}`;
}
function box(x0: number, x1: number, b0: number, b1: number, z0: number, z1: number, delay: number): Shape[] {
  return [
    { d: quad([[x0, b0, z0], [x1, b0, z0], [x1, b0, z1], [x0, b0, z1]]), cls: "face", delay },
    { d: quad([[x0, b0, z0], [x0, b1, z0], [x0, b1, z1], [x0, b0, z1]]), cls: "face", delay: delay + 0.15 },
    { d: quad([[x0, b0, z1], [x1, b0, z1], [x1, b1, z1], [x0, b1, z1]]), cls: "face", delay: delay + 0.3 },
  ];
}
function frontWin(x: number, w: number, b: number, z: number, h: number, delay: number): Shape[] {
  const out: Shape[] = [{ d: quad([[x, b, z], [x + w, b, z], [x + w, b, z + h], [x, b, z + h]]), cls: "glass", delay }];
  const n = Math.max(1, Math.round(w / 1.4));
  for (let i = 1; i < n; i++) out.push({ d: line([x + (w * i) / n, b, z], [x + (w * i) / n, b, z + h]), cls: "thin", delay: delay + 0.1 });
  return out;
}
function sideWin(x: number, b: number, w: number, z: number, h: number, delay: number): Shape[] {
  return [{ d: quad([[x, b, z], [x, b + w, z], [x, b + w, z + h], [x, b, z + h]]), cls: "glass", delay }];
}

export default function HeroBlueprint() {
  const shapes: Shape[] = [];
  // site grid
  for (let x = -2; x <= 20; x += 2) shapes.push({ d: line([x, -3, 0], [x, 13, 0]), cls: "grid", delay: 0 });
  for (let b = -3; b <= 13; b += 2) shapes.push({ d: line([-2, b, 0], [20, b, 0]), cls: "grid", delay: 0.05 });
  // volumes (painter's order: far to near)
  shapes.push(...box(14.2, 18.4, 0, 6.6, 0, 3.0, 0.3));
  shapes.push({ d: quad([[14.6, 0, 0], [18, 0, 0], [18, 0, 2.4], [14.6, 0, 2.4]]), cls: "thin", delay: 0.7 });
  shapes.push(...box(0, 14.2, 0, 10, 0, 3.3, 0.45));
  shapes.push(...frontWin(1, 4.6, 0, 0.15, 2.7, 1.0));
  shapes.push(...frontWin(6.4, 2.6, 0, 0.15, 2.7, 1.1));
  shapes.push({ d: quad([[9.8, 0, 0], [10.9, 0, 0], [10.9, 0, 2.5], [9.8, 0, 2.5]]), cls: "accent", delay: 1.2 });
  shapes.push(...sideWin(0, 2, 3.2, 0.15, 2.7, 1.15));
  shapes.push(...sideWin(0, 6.4, 2, 0.9, 1.6, 1.2));
  shapes.push(...box(3.2, 16.6, 1.2, 10, 3.3, 6.6, 0.9));
  shapes.push(...frontWin(4.4, 5.2, 1.2, 3.7, 2.5, 1.5));
  shapes.push(...frontWin(10.4, 4.8, 1.2, 3.7, 2.5, 1.6));
  shapes.push(...sideWin(3.2, 3.4, 3.6, 3.7, 2.5, 1.65));
  shapes.push(...box(3.0, 16.8, 1.0, 10.2, 6.6, 7.1, 1.4));
  // dimension line along the front
  shapes.push({ d: line([0, -1.6, 0], [14.2, -1.6, 0]), cls: "accent", delay: 1.9 });
  shapes.push({ d: line([0, -1.2, 0], [0, -2.0, 0]), cls: "accent", delay: 1.95 });
  shapes.push({ d: line([14.2, -1.2, 0], [14.2, -2.0, 0]), cls: "accent", delay: 1.95 });
  // level markers
  shapes.push({ d: line([16.8, 1, 7.1], [19.5, 1, 7.1]), cls: "thin", delay: 2.0 });
  shapes.push({ d: line([18.4, 0, 0], [21, 0, 0]), cls: "thin", delay: 2.0 });

  const all = shapes.map((s) => s.d.match(/-?\d+(\.\d+)?/g)!.map(Number));
  const xs = all.flatMap((a) => a.filter((_, i) => i % 2 === 0));
  const ys = all.flatMap((a) => a.filter((_, i) => i % 2 === 1));
  const pad = 1.5;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2];
  const [dimX, dimY] = proj(7.1, -2.4, 0);
  const [lvX, lvY] = proj(19.6, 1, 7.1);

  return (
    <svg className="bp" viewBox={vb.map((n) => n.toFixed(2)).join(" ")} role="img" aria-label="Axonometric line drawing of a two-storey villa">
      {shapes.map((s, i) => (
        <path key={i} d={s.d} pathLength={1} className={s.cls} style={{ "--d": `${s.delay}s` } as CSSProperties} />
      ))}
      <text x={dimX} y={dimY} fontSize="0.55" textAnchor="middle">14.20</text>
      <text x={lvX} y={lvY - 0.2} fontSize="0.5">+7.10</text>
    </svg>
  );
}
