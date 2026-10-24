/* Vanilla (no React) wrapper around robot-heads' renderer, for the MCGAAW site.
   robot-heads © 2026 Fayaz Ahmed, MIT License — https://github.com/fayazara/robot-heads */
import type { RobotHeadShape, RobotHeadState } from './lib/types';
import { getShape } from './lib/tv/geometry';
import { RobotSim, restPose } from './lib/tv/sim';
import { RobotRenderer, frameFor, type Palette } from './lib/tv/render';
import { linear } from './lib/tv/light';
import { parseColor } from './lib/color';
import { subscribe, pointer } from './lib/ticker';

interface Opts { shape?: RobotHeadShape; state?: RobotHeadState; size?: number; color?: string; trimColor?: string; screenColor?: string; antenna?: boolean; floorShadow?: boolean; seed?: number; label?: string }

function palette(color: string, trim: string, screen: string): Palette {
  const shell = parseColor(color) ?? [48, 80, 172];
  const metal = parseColor(trim) ?? [150, 168, 200];
  const led = parseColor(screen) ?? [232, 242, 255];
  return {
    shell: { albedo: linear(shell), f0: 0.05, metal: 0.15, spec: 0.55, shininess: 70, rim: 0.9 },
    trim: { albedo: linear(metal), f0: 0.2, metal: 0.65, spec: 0.8, shininess: 45, rim: 0.7 },
    led,
  };
}

export function mount(box: HTMLElement, o: Opts = {}) {
  const shape = o.shape ?? 'rectangle', size = o.size ?? 72, antenna = o.antenna ?? true, floorShadow = o.floorShadow ?? true;
  let state: RobotHeadState = o.state ?? 'idle';
  const pal = palette(o.color ?? '#2b49a3', o.trimColor ?? '#93a6c8', o.screenColor ?? '#e8f2ff');
  const sim = new RobotSim(Math.min(1, Math.max(0, o.seed ?? 0.37)), state);
  const renderer = new RobotRenderer();
  const frame = frameFor(getShape(shape), antenna, size);
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', o.label ?? 'Robot');
  Object.assign(box.style, { position: 'relative', display: 'block', width: size + 'px', height: size + 'px' });
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', left: -frame.padSide + 'px', top: -frame.padTop + 'px', width: frame.box + 2 * frame.padSide + 'px', height: frame.box + frame.padTop + frame.padBottom + 'px', display: 'block', pointerEvents: 'none' });
  box.appendChild(canvas);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint = (animated: boolean) => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round((frame.box + 2 * frame.padSide) * dpr), h = Math.round((frame.box + frame.padTop + frame.padBottom) * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    renderer.draw(ctx, frame, dpr, animated ? sim.pose : restPose(state), animated ? sim : null, state, getShape(shape), pal, { floorShadow, antenna });
  };
  let stop: (() => void) | null = null;
  if (still) paint(false);
  else stop = subscribe((dt) => {
    if (Number.isFinite(pointer.x)) {
      const r = box.getBoundingClientRect();
      const dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + frame.cy - frame.padTop);
      sim.pointer = Math.hypot(dx, dy) < 700 ? { x: dx, y: dy } : null;
    } else sim.pointer = null;
    sim.update(dt);
    paint(true);
  });
  return {
    setState(s: RobotHeadState) { state = s; sim.setState(s); if (still) paint(false); box.setAttribute('aria-label', (o.label ?? 'Robot') + ', ' + s); },
    getState() { return state; },
    poke() { if (!still) sim.poke(); },
    destroy() { stop?.(); canvas.remove(); },
  };
}
