"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Step = { title: string; text: string };

// A floor plan that draws itself in three phases as the reader scrolls through the process steps:
// 0 grid & setting-out, 1 walls, 2 openings, stair and furniture.
const PHASES: { d: string; cls?: string }[][] = [
  [
    { d: "M60 40 V420", cls: "thin" }, { d: "M260 40 V420", cls: "thin" }, { d: "M380 40 V420", cls: "thin" }, { d: "M540 40 V420", cls: "thin" },
    { d: "M30 70 H570", cls: "thin" }, { d: "M30 230 H570", cls: "thin" }, { d: "M30 390 H570", cls: "thin" },
    { d: "M60 20 H540", cls: "accent" }, { d: "M55 15 L65 25 M535 15 L545 25", cls: "accent" },
    { d: "M15 70 V390", cls: "accent" }, { d: "M10 75 L20 65 M10 395 L20 385", cls: "accent" },
  ],
  [
    { d: "M60 70 H540 V390 H60 Z" }, { d: "M68 78 H532 V382 H68 Z" },
    { d: "M260 78 V382" }, { d: "M380 78 V230" }, { d: "M260 230 H532" }, { d: "M380 300 H532" }, { d: "M456 230 V300" },
  ],
  [
    { d: "M100 390 H220", cls: "accent" }, { d: "M100 70 H200", cls: "accent" }, { d: "M410 390 H500", cls: "accent" }, { d: "M60 140 V200", cls: "accent" },
    { d: "M300 382 V340 A42 42 0 0 1 342 382" },
    { d: "M268 150 A40 40 0 0 0 308 190 V150" },
    { d: "M390 230 V262 M400 230 V262 M410 230 V262 M420 230 V262 M430 230 V262 M440 230 V262", cls: "thin" },
    { d: "M90 300 H230 V340 H90 Z M100 310 H220 V330 H100 Z", cls: "thin" },
    { d: "M120 150 H210 V200 H120 Z", cls: "thin" },
    { d: "M90 90 H240 V112 H90 Z", cls: "thin" },
    { d: "M290 100 H360 V180 H290 Z M296 106 H322 V124 H296 Z M328 106 H354 V124 H328 Z", cls: "thin" },
    { d: "M420 110 H500 V190 H420 Z M426 116 H456 V134 H426 Z M464 116 H494 V134 H464 Z", cls: "thin" },
    { d: "M470 320 H520 V370 H470 Z M470 320 L520 370 M520 320 L470 370", cls: "thin" },
  ],
];
const LABELS = [
  { x: 160, y: 255, t: "LIVING · DINING" },
  { x: 320, y: 215, t: "BEDROOM" },
  { x: 456, y: 215, t: "BEDROOM" },
  { x: 320, y: 300, t: "HALL" },
  { x: 495, y: 270, t: "BATH" },
];

export default function ProcessBlueprint({ steps, header }: { steps: Step[]; header: ReactNode }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const groups = Array.from(el.querySelectorAll<SVGGElement>("[data-phase]"));
    const stepEls = Array.from(el.querySelectorAll<HTMLElement>(".pstep"));
    const labels = el.querySelector<SVGGElement>("[data-labels]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = reduce ? 1 : Math.min(1, Math.max(0, (vh * 0.55 - r.top) / Math.max(1, r.height - vh * 0.6)));
      groups.forEach((g, i) => {
        const local = Math.min(1, Math.max(0, p * 3 - i));
        g.querySelectorAll<SVGPathElement>("path").forEach((path) => (path.style.strokeDashoffset = String(1 - local)));
      });
      if (labels) labels.style.opacity = String(Math.min(1, Math.max(0, p * 3 - 2.2) * 2));
      // the active step is the one whose centre is closest to the middle of the viewport
      let active = 0;
      let best = Infinity;
      stepEls.forEach((s, i) => {
        const sr = s.getBoundingClientRect();
        const dist = Math.abs(sr.top + sr.height / 2 - vh / 2);
        if (dist < best) { best = dist; active = i; }
      });
      stepEls.forEach((s, i) => s.classList.toggle("active", i === active));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [steps.length]);

  return (
    <section ref={root} className="section process" id="process">
      <div className="wrap">
        {header}
        <div className="process-grid">
          <div className="process-visual" aria-hidden="true">
            <svg viewBox="0 0 600 440">
              {PHASES.map((group, gi) => (
                <g data-phase={gi} key={gi}>
                  {group.map((s, i) => (
                    <path key={i} d={s.d} pathLength={1} className={`ln ${s.cls ?? ""}`} style={{ strokeDasharray: 1, strokeDashoffset: 1 }} />
                  ))}
                </g>
              ))}
              <g data-labels style={{ opacity: 0 }}>
                {LABELS.map((l) => (
                  <text key={l.t + l.x} x={l.x} y={l.y} textAnchor="middle">
                    {l.t}
                  </text>
                ))}
              </g>
            </svg>
          </div>
          <div className="process-steps">
            {steps.map((s, i) => (
              <div className="pstep" key={s.title}>
                <span className="num">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
