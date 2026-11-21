import { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text as PixiText, Texture } from 'pixi.js';
import {
  areAdjacent,
  GEM_META,
  GEM_TYPES,
  type BattleEvent,
  type BoardGrid,
  type GemType,
  type Pos,
} from '@pokiwar/shared';

export interface ActiveSwipeFx {
  id: number;
  from: Pos;
  to: Pos;
  valid: boolean;
}

export interface ActiveBreakGroupFx {
  id: number;
  positions: Pos[];
  gemType: GemType;
  cascadeIndex: number;
}

interface BoardCanvasProps {
  board: BoardGrid;
  events: BattleEvent[];
  canInteract: boolean;
  hintMove: { from: Pos; to: Pos } | null;
  activeSwipe?: ActiveSwipeFx | null;
  breakingGroup?: ActiveBreakGroupFx | null;
  onSwap: (from: Pos, to: Pos) => void;
}

const CELL_SIZE = 46;
const PADDING = 4;
const BOARD_PX = CELL_SIZE * 8 + PADDING * 2; // 376x376 tight Pokiwar grid

const GEM_HEX_COLOR: Record<GemType, number> = {
  SWORD: 0xfacc15,
  LIGHTNING: 0x38bdf8,
  FIRE: 0xef4444,
  HEART: 0x22c55e,
  YINYANG: 0xc084fc,
  COIN: 0xf1f5f9,
};

interface BurstParticle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
}

interface BurstRing {
  gfx: Graphics;
  x: number;
  y: number;
  color: number;
  life: number;
  maxLife: number;
  maxRadius: number;
}

interface SwipeSlash {
  gfx: Graphics;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
  life: number;
  maxLife: number;
}

interface InvalidBounce {
  idA: number;
  idB: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  elapsed: number;
  duration: number;
}

function createGemSpriteNode(type: GemType, multiplier = 1): Container {
  const container = new Container();
  const sprite = Sprite.from(Texture.from(GEM_META[type].spritePath));
  sprite.anchor.set(0.5);
  // Tight edge-to-edge Pokiwar Zing Me jewel fit (98.5% of cell!)
  sprite.width = CELL_SIZE * 0.985;
  sprite.height = CELL_SIZE * 0.985;
  container.addChild(sprite);

  if (multiplier > 1) {
    // Classic Pokiwar Zing Me crisp corner multiplier ("x2" / "x3" / "x4") with thick black outline — no bulky box!
    const fillHex = multiplier >= 4 ? 0xfb7185 : multiplier === 3 ? 0xfb923c : 0xfef08a;
    const label = new PixiText(`x${multiplier}`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: 13.5,
      fontWeight: '900',
      fill: fillHex,
      stroke: 0x111827,
      strokeThickness: 3.8,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 1.5,
      dropShadowBlur: 2,
    });
    label.anchor.set(1, 1);
    label.position.set(CELL_SIZE * 0.44, CELL_SIZE * 0.46);
    container.addChild(label);
  }
  return container;
}

export function BoardCanvas({
  board,
  events,
  canInteract,
  hintMove,
  activeSwipe = null,
  breakingGroup = null,
  onSwap,
}: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const gridLayerRef = useRef<Container | null>(null);
  const vfxLayerRef = useRef<Container | null>(null);
  const selectionRef = useRef<Graphics | null>(null);
  const hintRef = useRef<Graphics | null>(null);
  const dragTrailRef = useRef<Graphics | null>(null);
  const breakHighlightRef = useRef<Graphics | null>(null);

  const selectedPosRef = useRef<Pos | null>(null);
  const dragStartRef = useRef<{ pos: Pos; x: number; y: number } | null>(null);
  const canInteractRef = useRef(canInteract);
  const onSwapRef = useRef(onSwap);
  const boardRef = useRef(board);
  const hintMoveRef = useRef(hintMove);

  const gemNodesRef = useRef<
    Map<
      number,
      {
        node: Container;
        gemType: GemType;
        targetX: number;
        targetY: number;
        multiplier: number;
        breaking: boolean;
        breakAge: number;
      }
    >
  >(new Map());

  const particlesRef = useRef<BurstParticle[]>([]);
  const ringsRef = useRef<BurstRing[]>([]);
  const slashesRef = useRef<SwipeSlash[]>([]);
  const invalidBounceRef = useRef<InvalidBounce | null>(null);

  canInteractRef.current = canInteract;
  onSwapRef.current = onSwap;
  boardRef.current = board;
  hintMoveRef.current = hintMove;

  const cellCenter = (row: number, col: number) => ({
    x: PADDING + col * CELL_SIZE + CELL_SIZE / 2,
    y: PADDING + row * CELL_SIZE + CELL_SIZE / 2,
  });

  const spawnSwipeSlash = (from: Pos, to: Pos, valid: boolean) => {
    const vfx = vfxLayerRef.current;
    if (!vfx) return;
    const p1 = cellCenter(from.row, from.col);
    const p2 = cellCenter(to.row, to.col);
    const color = valid ? 0xfef08a : 0xf87171;
    const gfx = new Graphics();
    vfx.addChild(gfx);
    slashesRef.current.push({
      gfx,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      color,
      life: 0,
      maxLife: valid ? 0.34 : 0.28,
    });
    // Sparkles along swipe path
    const count = valid ? 10 : 6;
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const sx = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * 8;
      const sy = p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * 8;
      const pg = new Graphics();
      pg.beginFill(color, 1);
      pg.drawCircle(0, 0, valid ? 3 : 2.4);
      pg.endFill();
      pg.position.set(sx, sy);
      vfx.addChild(pg);
      const ang = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 55;
      particlesRef.current.push({
        gfx: pg,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.14,
        gravity: 40,
      });
    }
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    Assets.load(GEM_TYPES.map((t) => GEM_META[t].spritePath)).catch(() => {});

    const app = new Application({
      width: BOARD_PX,
      height: BOARD_PX,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    appRef.current = app;

    const view = app.view as HTMLCanvasElement;
    view.style.width = '100%';
    view.style.height = '100%';
    view.style.display = 'block';
    view.style.touchAction = 'none';
    host.innerHTML = '';
    host.appendChild(view);

    const bgLayer = new Container();
    const boardPlate = new Graphics();
    boardPlate.lineStyle(2, 0x38bdf8, 0.55);
    boardPlate.beginFill(0x051229, 0.94);
    boardPlate.drawRoundedRect(1, 1, BOARD_PX - 2, BOARD_PX - 2, 10);
    boardPlate.endFill();
    bgLayer.addChild(boardPlate);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const tile = new Graphics();
        tile.lineStyle(0.8, 0x1e3a5f, 0.45);
        tile.beginFill((r + c) % 2 === 0 ? 0x0a2246 : 0x071833, 0.92);
        tile.drawRoundedRect(
          PADDING + c * CELL_SIZE + 0.5,
          PADDING + r * CELL_SIZE + 0.5,
          CELL_SIZE - 1,
          CELL_SIZE - 1,
          5,
        );
        tile.endFill();
        bgLayer.addChild(tile);
      }
    }

    const gridLayer = new Container();
    gridLayerRef.current = gridLayer;

    const breakHighlight = new Graphics();
    breakHighlightRef.current = breakHighlight;

    const selection = new Graphics();
    selection.visible = false;
    selectionRef.current = selection;

    const hint = new Graphics();
    hint.visible = false;
    hintRef.current = hint;

    const dragTrail = new Graphics();
    dragTrailRef.current = dragTrail;

    const vfxLayer = new Container();
    vfxLayerRef.current = vfxLayer;

    app.stage.addChild(bgLayer, gridLayer, breakHighlight, hint, selection, dragTrail, vfxLayer);

    let elapsedTick = 0;
    app.ticker.add((delta) => {
      if (disposed) return;
      const dt = Math.min(0.05, delta / 60);
      elapsedTick += dt;

      // Animate invalid bounce-back if active
      const bounce = invalidBounceRef.current;
      if (bounce) {
        bounce.elapsed += dt;
        const p = Math.min(1, bounce.elapsed / bounce.duration);
        // Sine arc: 0 -> 0.48 -> 0
        const k = Math.sin(p * Math.PI) * 0.48;
        const entA = gemNodesRef.current.get(bounce.idA);
        const entB = gemNodesRef.current.get(bounce.idB);
        if (entA) {
          entA.node.x = bounce.ax + (bounce.bx - bounce.ax) * k;
          entA.node.y = bounce.ay + (bounce.by - bounce.ay) * k;
        }
        if (entB) {
          entB.node.x = bounce.bx + (bounce.ax - bounce.bx) * k;
          entB.node.y = bounce.by + (bounce.ay - bounce.by) * k;
        }
        if (p >= 1) {
          invalidBounceRef.current = null;
        }
      }

      // Smooth slide + gravity drop + breaking pop animation
      for (const [id, item] of gemNodesRef.current.entries()) {
        if (bounce && (id === bounce.idA || id === bounce.idB)) continue;
        item.node.x += (item.targetX - item.node.x) * 0.32;
        item.node.y += (item.targetY - item.node.y) * 0.3;

        if (item.breaking) {
          item.breakAge += dt;
          const bp = Math.min(1, item.breakAge / 0.17);
          if (bp < 0.42) {
            const s = 1 + (bp / 0.42) * 0.34;
            item.node.scale.set(s);
            item.node.alpha = 1;
          } else {
            const s = Math.max(0.01, 1.34 * (1 - (bp - 0.42) / 0.58));
            item.node.scale.set(s);
            item.node.alpha = Math.max(0, 1 - (bp - 0.42) / 0.58);
          }
        } else {
          item.node.alpha = 1;
          if (item.node.scale.x < 1) {
            const next = Math.min(1, item.node.scale.x + 0.14);
            item.node.scale.set(next);
          }
        }
      }

      // Pulse selection glow softly
      if (selection.visible) {
        selection.alpha = 0.78 + Math.sin(elapsedTick * 9) * 0.22;
      }

      // Draw bright pulsing Hint highlight (Gợi ý) cleanly every frame when active!
      const hm = hintMoveRef.current;
      if (hm) {
        hint.visible = true;
        hint.clear();
        const pulse = 0.72 + Math.sin(elapsedTick * 10) * 0.28;
        hint.lineStyle(4, 0xfef08a, pulse);
        hint.beginFill(0x38bdf8, 0.26 * pulse);
        for (const p of [hm.from, hm.to]) {
          hint.drawRoundedRect(
            PADDING + p.col * CELL_SIZE + 2,
            PADDING + p.row * CELL_SIZE + 2,
            CELL_SIZE - 4,
            CELL_SIZE - 4,
            10,
          );
        }
        hint.endFill();
        const c1 = cellCenter(hm.from.row, hm.from.col);
        const c2 = cellCenter(hm.to.row, hm.to.col);
        hint.lineStyle(3.5, 0xfef08a, pulse);
        hint.moveTo(c1.x, c1.y);
        hint.lineTo(c2.x, c2.y);
      } else if (hint.visible) {
        hint.clear();
        hint.visible = false;
      }

      // Update swipe slashes
      for (let i = slashesRef.current.length - 1; i >= 0; i--) {
        const s = slashesRef.current[i];
        s.life += dt;
        const p = s.life / s.maxLife;
        if (p >= 1) {
          s.gfx.parent?.removeChild(s.gfx);
          s.gfx.destroy();
          slashesRef.current.splice(i, 1);
          continue;
        }
        const alpha = 1 - p;
        s.gfx.clear();
        s.gfx.lineStyle(12 * (1 - p * 0.45), s.color, alpha * 0.35);
        s.gfx.moveTo(s.x1, s.y1);
        s.gfx.lineTo(s.x2, s.y2);
        s.gfx.lineStyle(4.5 * (1 - p * 0.3), 0xffffff, alpha * 0.95);
        s.gfx.moveTo(s.x1, s.y1);
        s.gfx.lineTo(s.x2, s.y2);
      }

      // Update shatter particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const pt = particlesRef.current[i];
        pt.life += dt;
        const p = pt.life / pt.maxLife;
        if (p >= 1) {
          pt.gfx.parent?.removeChild(pt.gfx);
          pt.gfx.destroy();
          particlesRef.current.splice(i, 1);
          continue;
        }
        pt.vy += pt.gravity * dt;
        pt.gfx.x += pt.vx * dt;
        pt.gfx.y += pt.vy * dt;
        pt.gfx.alpha = 1 - p;
        pt.gfx.scale.set(1 - p * 0.55);
      }

      // Update expanding shockwave rings
      for (let i = ringsRef.current.length - 1; i >= 0; i--) {
        const rg = ringsRef.current[i];
        rg.life += dt;
        const p = rg.life / rg.maxLife;
        if (p >= 1) {
          rg.gfx.parent?.removeChild(rg.gfx);
          rg.gfx.destroy();
          ringsRef.current.splice(i, 1);
          continue;
        }
        rg.gfx.clear();
        rg.gfx.lineStyle(3.2 * (1 - p), rg.color, (1 - p) * 0.95);
        rg.gfx.drawCircle(rg.x, rg.y, 8 + p * rg.maxRadius);
      }
    });

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    const toCell = (x: number, y: number): Pos | null => {
      const col = Math.floor((x - PADDING) / CELL_SIZE);
      const row = Math.floor((y - PADDING) / CELL_SIZE);
      if (row < 0 || row >= 8 || col < 0 || col >= 8) return null;
      return { row, col };
    };

    const drawSelection = (pos: Pos | null) => {
      const g = selectionRef.current;
      if (!g) return;
      g.clear();
      if (!pos) {
        g.visible = false;
        return;
      }
      g.visible = true;
      g.lineStyle(3.2, 0xfef08a, 1);
      g.beginFill(0xfacc15, 0.14);
      g.drawRoundedRect(
        PADDING + pos.col * CELL_SIZE + 2.5,
        PADDING + pos.row * CELL_SIZE + 2.5,
        CELL_SIZE - 5,
        CELL_SIZE - 5,
        10,
      );
      g.endFill();
    };

    const clearDragTrail = () => {
      dragTrailRef.current?.clear();
    };

    app.stage.on('pointerdown', (ev) => {
      if (!canInteractRef.current) return;
      const pos = toCell(ev.global.x, ev.global.y);
      if (!pos) return;
      dragStartRef.current = { pos, x: ev.global.x, y: ev.global.y };

      const prev = selectedPosRef.current;
      if (!prev) {
        selectedPosRef.current = pos;
        drawSelection(pos);
        return;
      }
      if (prev.row === pos.row && prev.col === pos.col) {
        selectedPosRef.current = null;
        drawSelection(null);
        return;
      }
      if (areAdjacent(prev, pos)) {
        selectedPosRef.current = null;
        drawSelection(null);
        dragStartRef.current = null;
        clearDragTrail();
        onSwapRef.current(prev, pos);
      } else {
        selectedPosRef.current = pos;
        drawSelection(pos);
      }
    });

    app.stage.on('pointermove', (ev) => {
      if (!canInteractRef.current || !dragStartRef.current) return;
      const dx = ev.global.x - dragStartRef.current.x;
      const dy = ev.global.y - dragStartRef.current.y;
      const dist = Math.hypot(dx, dy);

      // Live glowing finger/mouse swipe preview while dragging!
      const startCenter = cellCenter(dragStartRef.current.pos.row, dragStartRef.current.pos.col);
      const trail = dragTrailRef.current;
      if (trail && dist > 4) {
        trail.clear();
        trail.lineStyle(6, 0x38bdf8, 0.35);
        trail.moveTo(startCenter.x, startCenter.y);
        trail.lineTo(ev.global.x, ev.global.y);
        trail.lineStyle(2.5, 0xfef08a, 0.9);
        trail.moveTo(startCenter.x, startCenter.y);
        trail.lineTo(ev.global.x, ev.global.y);
      }

      if (dist < 17) return;

      const start = dragStartRef.current.pos;
      dragStartRef.current = null;
      selectedPosRef.current = null;
      drawSelection(null);
      clearDragTrail();

      const target: Pos =
        Math.abs(dx) > Math.abs(dy)
          ? { row: start.row, col: start.col + (dx > 0 ? 1 : -1) }
          : { row: start.row + (dy > 0 ? 1 : -1), col: start.col };
      if (target.row >= 0 && target.row < 8 && target.col >= 0 && target.col < 8) {
        onSwapRef.current(start, target);
      }
    });

    const endDrag = () => {
      dragStartRef.current = null;
      clearDragTrail();
    };
    app.stage.on('pointerup', endDrag);
    app.stage.on('pointerupoutside', endDrag);

    return () => {
      disposed = true;
      gemNodesRef.current.clear();
      particlesRef.current = [];
      ringsRef.current = [];
      slashesRef.current = [];
      invalidBounceRef.current = null;
      gridLayerRef.current = null;
      vfxLayerRef.current = null;
      selectionRef.current = null;
      hintRef.current = null;
      dragTrailRef.current = null;
      breakHighlightRef.current = null;
      selectedPosRef.current = null;
      try {
        const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
        app.destroy(true, { children: true, texture: false, baseTexture: false });
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // ignore cleanup errors
      }
      appRef.current = null;
    };
  }, []);

  // Trigger glowing swipe trail (and bounce-back on invalid swap!)
  useEffect(() => {
    if (!activeSwipe) return;
    spawnSwipeSlash(activeSwipe.from, activeSwipe.to, activeSwipe.valid);
    if (!activeSwipe.valid) {
      const b = boardRef.current;
      const cellA = b[activeSwipe.from.row]?.[activeSwipe.from.col];
      const cellB = b[activeSwipe.to.row]?.[activeSwipe.to.col];
      if (cellA && cellB) {
        const pA = cellCenter(activeSwipe.from.row, activeSwipe.from.col);
        const pB = cellCenter(activeSwipe.to.row, activeSwipe.to.col);
        invalidBounceRef.current = {
          idA: cellA.id,
          idB: cellB.id,
          ax: pA.x,
          ay: pA.y,
          bx: pB.x,
          by: pB.y,
          elapsed: 0,
          duration: 0.28,
        };
      }
    }
  }, [activeSwipe]);

  // Trigger sequential Match-3 break flash, shatter particles & pop-out animation!
  useEffect(() => {
    const hl = breakHighlightRef.current;
    const vfx = vfxLayerRef.current;
    if (!hl) return;
    hl.clear();

    if (!breakingGroup || breakingGroup.positions.length === 0) return;

    const color = GEM_HEX_COLOR[breakingGroup.gemType] ?? 0xfef08a;
    hl.lineStyle(3.2, 0xfef08a, 0.98);
    hl.beginFill(color, 0.34);

    const b = boardRef.current;
    for (const pos of breakingGroup.positions) {
      hl.drawRoundedRect(
        PADDING + pos.col * CELL_SIZE + 2,
        PADDING + pos.row * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4,
        10,
      );
      const cell = b[pos.row]?.[pos.col];
      if (cell) {
        const entry = gemNodesRef.current.get(cell.id);
        if (entry) {
          entry.breaking = true;
          entry.breakAge = 0;
        }
      }
      if (vfx) {
        const ctr = cellCenter(pos.row, pos.col);
        // Expanding shockwave ring per broken gem
        const rg = new Graphics();
        vfx.addChild(rg);
        ringsRef.current.push({
          gfx: rg,
          x: ctr.x,
          y: ctr.y,
          color,
          life: 0,
          maxLife: 0.32,
          maxRadius: 24,
        });
        // Shatter diamond shards
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
          const spd = 48 + Math.random() * 68;
          const pg = new Graphics();
          pg.beginFill(i % 2 === 0 ? color : 0xffffff, 1);
          pg.drawPolygon([-3, 0, 0, -4.5, 3, 0, 0, 4.5]);
          pg.endFill();
          pg.position.set(ctr.x, ctr.y);
          vfx.addChild(pg);
          particlesRef.current.push({
            gfx: pg,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 20,
            life: 0,
            maxLife: 0.34 + Math.random() * 0.12,
            gravity: 170,
          });
        }
      }
    }
    hl.endFill();
  }, [breakingGroup]);

  // Sync displayed board grid smoothly
  useEffect(() => {
    const layer = gridLayerRef.current;
    if (!layer) return;

    const activeIds = new Set<number>();
    const dropFromRowMap = new Map<number, number>();
    for (const ev of events) {
      if (ev.type === 'BOARD_REFILL') {
        for (const d of ev.drops) {
          if (d.isNew) {
            dropFromRowMap.set(d.gemId, d.fromRow);
          }
        }
      }
    }

    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        const cell = board[r][c];
        activeIds.add(cell.id);
        const { x, y } = cellCenter(r, c);
        const mult = cell.multiplier ?? 1;
        let entry = gemNodesRef.current.get(cell.id);
        if (!entry || entry.multiplier !== mult || entry.gemType !== cell.type) {
          const prevPos = entry ? { x: entry.node.x, y: entry.node.y } : null;
          if (entry) {
            layer.removeChild(entry.node);
            entry.node.destroy({ children: true });
          }
          const node = createGemSpriteNode(cell.type, mult);
          if (prevPos) {
            node.x = prevPos.x;
            node.y = prevPos.y;
            node.scale.set(1.18);
          } else {
            const startRow = dropFromRowMap.get(cell.id);
            node.x = x;
            node.y = startRow !== undefined ? cellCenter(startRow, c).y - 16 : y - 34;
            node.scale.set(0.55);
          }
          layer.addChild(node);
          entry = {
            node,
            gemType: cell.type,
            targetX: x,
            targetY: y,
            multiplier: mult,
            breaking: false,
            breakAge: 0,
          };
          gemNodesRef.current.set(cell.id, entry);
        } else {
          entry.targetX = x;
          entry.targetY = y;
          entry.breaking = false;
          entry.breakAge = 0;
        }
      }
    }

    for (const [id, entry] of gemNodesRef.current.entries()) {
      if (!activeIds.has(id)) {
        layer.removeChild(entry.node);
        entry.node.destroy({ children: true });
        gemNodesRef.current.delete(id);
      }
    }

    selectedPosRef.current = null;
    if (selectionRef.current) {
      selectionRef.current.clear();
      selectionRef.current.visible = false;
    }
  }, [board, events]);

  useEffect(() => {
    const g = hintRef.current;
    if (!g) return;
    g.clear();
    if (!hintMove) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.lineStyle(3, 0x38bdf8, 0.95);
    for (const p of [hintMove.from, hintMove.to]) {
      g.drawRoundedRect(
        PADDING + p.col * CELL_SIZE + 3,
        PADDING + p.row * CELL_SIZE + 3,
        CELL_SIZE - 6,
        CELL_SIZE - 6,
        10,
      );
    }
  }, [hintMove]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
