import { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { ElementType, Side } from '@pokiwar/shared';

export interface AnimCommand {
  id: number;
  actor: Side;
  type: 'ATTACK' | 'SKILL' | 'HEAL' | 'SHIELD' | 'RAGE' | 'MANA' | 'ENERGY' | 'HIT';
  element?: ElementType;
  crit?: boolean;
}

export interface StageActionCue {
  id: number;
  attackerSide: Side;
  kind: 'SKILL' | 'GEM_ATTACK';
  colorHex?: string;
}

export interface SpineStageCanvasProps {
  width?: number;
  height?: number;
  mode?: 'DUEL' | 'SINGLE';
  mySpriteId?: string;
  enemySpriteId?: string;
  mySpineId?: string;
  enemySpineId?: string;
  myElement?: ElementType;
  enemyElement?: ElementType;
  myAuraColorHex?: string;
  isBoss?: boolean;
  mySide?: Side;
  activeTurn?: Side;
  defeatedSide?: Side | null;
  animCommand?: AnimCommand | null;
  actionCue?: StageActionCue | null;
  scaleMultiplier?: number;
}

const ELEMENT_COLORS: Record<ElementType, number> = {
  KIM: 0xfacc15,
  MOC: 0x4ade80,
  THUY: 0x38bdf8,
  HOA: 0xf97316,
  THO: 0xeab308,
};

const textureCache = new Map<string, Texture>();
const trimmedPetTextureCache = new Map<string, Texture>();

async function loadSafeTexture(url: string): Promise<Texture | null> {
  const cached = textureCache.get(url);
  if (cached && cached !== Texture.EMPTY) return cached;
  try {
    const tex = await Assets.load<Texture>(url);
    if (tex && tex !== Texture.EMPTY) {
      textureCache.set(url, tex);
      return tex;
    }
  } catch {
    // ignore missing sprite fallback
  }
  return null;
}

/**
 * Auto-trims empty transparent padding around Pet PNG sprites once on load,
 * ensuring every Pet fills its Kho Pet / Battle pedestal at authentic Pokiwar scale!
 */
async function loadTrimmedPetTexture(url: string): Promise<Texture | null> {
  const cached = trimmedPetTextureCache.get(url);
  if (cached && cached !== Texture.EMPTY) return cached;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image load failed'));
      el.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w > 4 && h > 4 && typeof document !== 'undefined') {
      const scan = document.createElement('canvas');
      scan.width = w;
      scan.height = h;
      const ctx = scan.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 14) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX > minX + 8 && maxY > minY + 8) {
          const pad = 4;
          const sx = Math.max(0, minX - pad);
          const sy = Math.max(0, minY - pad);
          const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
          const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);
          const out = document.createElement('canvas');
          out.width = sw;
          out.height = sh;
          const octx = out.getContext('2d');
          if (octx) {
            octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            const trimmedTex = Texture.from(out);
            trimmedPetTextureCache.set(url, trimmedTex);
            return trimmedTex;
          }
        }
      }
    }
  } catch {
    // fall back to standard Pixi loader
  }
  const fallback = await loadSafeTexture(url);
  if (fallback) trimmedPetTextureCache.set(url, fallback);
  return fallback;
}

function normalizeSpriteId(raw?: string): string {
  if (!raw) return '583';
  return raw.replace(/^pet-/, '');
}

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
}

interface ShockRing {
  gfx: Graphics;
  x: number;
  y: number;
  color: number;
  life: number;
  maxLife: number;
  maxRadius: number;
}

interface ActiveAnim {
  cmd: AnimCommand;
  elapsed: number;
  duration: number;
  impactFired: boolean;
}

interface StageRig {
  app: Application;
  myBaseX: number;
  enemyBaseX: number;
  baseY: number;
  myHolder: Container;
  enemyHolder: Container;
  mySprite: Sprite;
  enemySprite: Sprite;
  myAura: Sprite;
  enemyAura: Sprite;
  myPedestal: Sprite;
  enemyPedestal: Sprite;
  myTurnRing: Graphics;
  enemyTurnRing: Graphics;
  vfxLayer: Container;
  projGfx: Graphics;
  myFitScale: number;
  enemyFitScale: number;
  particles: Particle[];
  rings: ShockRing[];
  activeAnim: ActiveAnim | null;
  koState: { side: Side; elapsed: number; burstFired: boolean; smokeFired: boolean } | null;
}

export function SpineStageCanvas({
  width = 960,
  height = 290,
  mode,
  mySpriteId,
  enemySpriteId,
  mySpineId,
  enemySpineId,
  myElement = 'HOA',
  enemyElement = 'THUY',
  myAuraColorHex,
  isBoss = false,
  mySide = 'P1',
  activeTurn = 'P1',
  defeatedSide = null,
  animCommand = null,
  actionCue = null,
  scaleMultiplier = 1,
}: SpineStageCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<StageRig | null>(null);
  const propsRef = useRef({
    myId: normalizeSpriteId(mySpriteId ?? mySpineId),
    enemyId: enemySpriteId ?? enemySpineId ? normalizeSpriteId(enemySpriteId ?? enemySpineId) : undefined,
    resolvedMode: mode ?? (enemySpriteId || enemySpineId ? 'DUEL' : 'SINGLE'),
    myElement,
    enemyElement,
    myAuraColorHex,
    isBoss,
    mySide,
    activeTurn,
    defeatedSide,
    scaleMultiplier,
    width,
    height,
  });

  propsRef.current = {
    myId: normalizeSpriteId(mySpriteId ?? mySpineId),
    enemyId: enemySpriteId ?? enemySpineId ? normalizeSpriteId(enemySpriteId ?? enemySpineId) : undefined,
    resolvedMode: mode ?? (enemySpriteId || enemySpineId ? 'DUEL' : 'SINGLE'),
    myElement,
    enemyElement,
    myAuraColorHex,
    isBoss,
    mySide,
    activeTurn,
    defeatedSide,
    scaleMultiplier,
    width,
    height,
  };

  const resolvedMode = propsRef.current.resolvedMode;
  const resolvedMyId = propsRef.current.myId;
  const resolvedEnemyId = propsRef.current.enemyId;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const app = new Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
      autoDensity: true,
    });

    const view = app.view as HTMLCanvasElement;
    view.style.width = '100%';
    view.style.height = '100%';
    view.style.display = 'block';
    view.style.pointerEvents = 'none';
    host.innerHTML = '';
    host.appendChild(view);

    const root = new Container();
    app.stage.addChild(root);

    const myBaseX = resolvedMode === 'SINGLE' ? width * 0.5 : width * 0.165;
    const enemyBaseX = width * 0.835;
    const baseY = resolvedMode === 'SINGLE' ? height * 0.72 : height * 0.62;

    const myPedestal = new Sprite();
    myPedestal.anchor.set(0.5);
    myPedestal.position.set(myBaseX, baseY + (resolvedMode === 'SINGLE' ? 38 : 48));

    const enemyPedestal = new Sprite();
    enemyPedestal.anchor.set(0.5);
    enemyPedestal.position.set(enemyBaseX, baseY + 48);
    enemyPedestal.visible = resolvedMode === 'DUEL';

    const myTurnRing = new Graphics();
    myTurnRing.position.set(myBaseX, baseY + (resolvedMode === 'SINGLE' ? 32 : 42));
    const enemyTurnRing = new Graphics();
    enemyTurnRing.position.set(enemyBaseX, baseY + 42);
    enemyTurnRing.visible = resolvedMode === 'DUEL';

    const myAura = new Sprite();
    myAura.anchor.set(0.5);
    myAura.position.set(myBaseX, baseY - 22);
    myAura.alpha = 0.58;

    const enemyAura = new Sprite();
    enemyAura.anchor.set(0.5);
    enemyAura.position.set(enemyBaseX, baseY - 22);
    enemyAura.alpha = 0.58;
    enemyAura.visible = resolvedMode === 'DUEL';

    const myHolder = new Container();
    myHolder.position.set(myBaseX, baseY);
    const mySprite = new Sprite();
    mySprite.anchor.set(0.5, 0.9);
    mySprite.position.set(0, resolvedMode === 'SINGLE' ? 34 : 46);
    myHolder.addChild(mySprite);

    const enemyHolder = new Container();
    enemyHolder.position.set(enemyBaseX, baseY);
    enemyHolder.visible = resolvedMode === 'DUEL';
    const enemySprite = new Sprite();
    enemySprite.anchor.set(0.5, 0.9);
    enemySprite.position.set(0, 46);
    enemyHolder.addChild(enemySprite);

    const vfxLayer = new Container();
    const projGfx = new Graphics();
    vfxLayer.addChild(projGfx);

    root.addChild(
      myPedestal,
      enemyPedestal,
      myTurnRing,
      enemyTurnRing,
      myAura,
      enemyAura,
      myHolder,
      enemyHolder,
      vfxLayer,
    );

    const rig: StageRig = {
      app,
      myBaseX,
      enemyBaseX,
      baseY,
      myHolder,
      enemyHolder,
      mySprite,
      enemySprite,
      myAura,
      enemyAura,
      myPedestal,
      enemyPedestal,
      myTurnRing,
      enemyTurnRing,
      vfxLayer,
      projGfx,
      myFitScale: 1,
      enemyFitScale: 1,
      particles: [],
      rings: [],
      activeAnim: null,
      koState: null,
    };
    rigRef.current = rig;

    const spawnBurst = (x: number, y: number, color: number, count: number, upward = false) => {
      for (let i = 0; i < count; i++) {
        const gfx = new Graphics();
        const radius = upward ? 3 + Math.random() * 4 : 2.5 + Math.random() * 5;
        gfx.beginFill(color, 0.92);
        gfx.drawCircle(0, 0, radius);
        gfx.endFill();
        gfx.position.set(x + (Math.random() - 0.5) * 34, y + (Math.random() - 0.5) * 34);
        vfxLayer.addChild(gfx);

        const angle = upward ? -Math.PI / 2 + (Math.random() - 0.5) * 0.9 : Math.random() * Math.PI * 2;
        const speed = upward ? 65 + Math.random() * 95 : 110 + Math.random() * 210;
        rig.particles.push({
          gfx,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 0.42 + Math.random() * 0.28,
          gravity: upward ? -20 : 180,
        });
      }
    };

    const spawnRing = (x: number, y: number, color: number, maxRadius: number) => {
      const gfx = new Graphics();
      vfxLayer.addChild(gfx);
      rig.rings.push({ gfx, x, y, color, life: 0, maxLife: 0.48, maxRadius });
    };

    let elapsedTotal = 0;
    let ambientTimer = 0;

    const tick = (delta: number) => {
      if (cancelled) return;
      const dt = Math.min(delta / 60, 0.05);
      elapsedTotal += dt;
      ambientTimer += dt;

      const cur = propsRef.current;
      const customAuraColor = cur.myAuraColorHex
        ? Number.parseInt(cur.myAuraColorHex.replace('#', ''), 16)
        : null;
      const myColor =
        customAuraColor && !Number.isNaN(customAuraColor)
          ? customAuraColor
          : ELEMENT_COLORS[cur.myElement] ?? 0xfacc15;
      const enemyColor = ELEMENT_COLORS[cur.enemyElement] ?? 0x38bdf8;

      // Living multi-axis idle motion: elastic squash-and-stretch breathing + hover bob + gentle posture sway
      const myPhase = elapsedTotal * 2.8;
      const enPhase = elapsedTotal * 2.8 + 1.5;
      const myBob = Math.sin(myPhase) * 7.5;
      const enemyBob = Math.sin(enPhase) * 7.5;
      const myScaleXBase = 1 + Math.sin(myPhase) * 0.035;
      const myScaleYBase = 1 - Math.sin(myPhase) * 0.04;
      const enemyScaleXBase = 1 + Math.sin(enPhase) * 0.035;
      const enemyScaleYBase = 1 - Math.sin(enPhase) * 0.04;
      let myRot = Math.sin(elapsedTotal * 1.9) * 0.042;
      let enemyRot = Math.sin(elapsedTotal * 1.9 + 1.5) * 0.042;
      let mySkewX = Math.sin(elapsedTotal * 2.2) * 0.025;
      let enemySkewX = Math.sin(elapsedTotal * 2.2 + 1.5) * 0.025;
      let myExtraScaleX = 1;
      let myExtraScaleY = 1;
      let enemyExtraScaleX = 1;
      let enemyExtraScaleY = 1;
      let shakeX = 0;
      let shakeY = 0;

      rig.myAura.rotation += dt * (customAuraColor ? 1.05 : 0.6);
      rig.myAura.tint = myColor;
      rig.myAura.alpha = customAuraColor ? 0.82 : 0.58;
      rig.enemyAura.rotation -= dt * 0.6;
      rig.enemyAura.tint = enemyColor;

      // Draw turn halo rings on the arena floor
      rig.myTurnRing.clear();
      const myActive = cur.resolvedMode === 'SINGLE' || cur.activeTurn === cur.mySide;
      rig.myTurnRing.lineStyle(myActive ? 3.5 : 1.8, myColor, myActive ? 0.8 + Math.sin(elapsedTotal * 4) * 0.2 : 0.35);
      rig.myTurnRing.drawEllipse(0, 0, 74, 22);
      if (customAuraColor) {
        rig.myTurnRing.lineStyle(2.2, 0xfef08a, 0.72 + Math.sin(elapsedTotal * 5) * 0.22);
        rig.myTurnRing.drawEllipse(0, 0, 88 + Math.sin(elapsedTotal * 3) * 4, 27);
      }

      if (cur.resolvedMode === 'DUEL') {
        const enemyActive = cur.activeTurn !== cur.mySide;
        rig.enemyTurnRing.clear();
        rig.enemyTurnRing.lineStyle(
          enemyActive ? 3 : 1.5,
          enemyColor,
          enemyActive ? 0.72 + Math.sin(elapsedTotal * 4) * 0.2 : 0.25,
        );
        rig.enemyTurnRing.drawEllipse(0, 0, 74, 22);
      }

      if (ambientTimer > 0.35) {
        ambientTimer = 0;
        const targetX = cur.resolvedMode === 'SINGLE' || cur.activeTurn === cur.mySide ? rig.myBaseX : rig.enemyBaseX;
        const color = cur.resolvedMode === 'SINGLE' || cur.activeTurn === cur.mySide ? myColor : enemyColor;
        const m = new Graphics();
        m.beginFill(color, 0.55);
        m.drawCircle(0, 0, 2.2 + Math.random() * 2);
        m.endFill();
        m.position.set(targetX + (Math.random() - 0.5) * 86, rig.baseY + 26);
        vfxLayer.addChild(m);
        rig.particles.push({
          gfx: m,
          vx: (Math.random() - 0.5) * 20,
          vy: -38 - Math.random() * 28,
          life: 0,
          maxLife: 0.75,
          gravity: -10,
        });
      }

      // Reset default positions before animation offsets
      let myOffsetX = 0;
      let myOffsetY = myBob;
      let enemyOffsetX = 0;
      let enemyOffsetY = enemyBob;
      rig.mySprite.tint = 0xffffff;
      rig.enemySprite.tint = 0xffffff;
      rig.projGfx.clear();

      // Active combat animation timeline
      const anim = rig.activeAnim;
      if (anim) {
        anim.elapsed += dt;
        const p = Math.min(anim.elapsed / anim.duration, 1);
        const isPlayerActor = anim.cmd.actor === cur.mySide;
        const dir = isPlayerActor ? 1 : -1;
        const cmdColor = ELEMENT_COLORS[anim.cmd.element ?? (isPlayerActor ? cur.myElement : cur.enemyElement)] ?? 0xfacc15;
        const actorX = isPlayerActor ? rig.myBaseX : rig.enemyBaseX;
        const targetX = cur.resolvedMode === 'DUEL' ? (isPlayerActor ? rig.enemyBaseX : rig.myBaseX) : rig.myBaseX;

        if (anim.cmd.type === 'ATTACK' || anim.cmd.type === 'SKILL') {
          const isSkillCast = anim.cmd.type === 'SKILL';
          const elem: ElementType = anim.cmd.element ?? (isPlayerActor ? cur.myElement : cur.enemyElement);
          // 3 diverse attack motion styles (0 = melee dash, 1 = aerial barrage, 2 = arcane sky-strike) + 3 = Ultimate SKILL
          const attackStyle = isSkillCast ? 3 : anim.cmd.id % 3;
          const lungeDist =
            cur.resolvedMode === 'DUEL'
              ? attackStyle === 0
                ? 215
                : attackStyle === 1
                  ? 135
                  : attackStyle === 2
                    ? 48
                    : 125
              : 34;
          let move = 0;
          let jumpY = 0;
          let poseRot = 0;
          let poseSX = 1;
          let poseSY = 1;

          if (p < 0.24) {
            const wp = p / 0.24;
            move = -24 * wp;
            jumpY = attackStyle === 1 || isSkillCast ? -42 * wp : attackStyle === 2 ? -24 * wp : 6 * wp;
            poseRot = -0.16 * dir * wp;
            poseSX = isSkillCast ? 1 + 0.1 * wp : 1 + 0.09 * wp;
            poseSY = isSkillCast ? 1 + 0.12 * wp : 1 - 0.11 * wp;
          } else if (p < 0.5) {
            const lp = (p - 0.24) / 0.26;
            move = -24 + (lungeDist + 24) * lp;
            jumpY =
              attackStyle === 1
                ? -42 - Math.sin(lp * Math.PI) * 28
                : attackStyle === 2 || isSkillCast
                  ? -34
                  : -Math.sin(lp * Math.PI) * 32;
            poseRot = 0.24 * dir * Math.sin(lp * Math.PI);
            poseSX = 1.16;
            poseSY = 0.91;
            // Speed dash streaks behind attacker
            rig.projGfx.lineStyle(3.5, cmdColor, 0.62);
            for (let s = 0; s < 4; s++) {
              const sy = rig.baseY - 72 + s * 22;
              rig.projGfx.moveTo(actorX + move * dir - dir * 28, sy);
              rig.projGfx.lineTo(actorX + move * dir - dir * 92, sy);
            }
          } else {
            const back = (p - 0.5) / 0.5;
            move = lungeDist * (1 - back);
            jumpY = -Math.sin((1 - back) * Math.PI) * 18;
            poseRot = 0.08 * dir * (1 - back);
          }

          if (isPlayerActor) {
            myOffsetX += move * dir;
            myOffsetY += jumpY;
            myRot += poseRot;
            myExtraScaleX = poseSX;
            myExtraScaleY = poseSY;
          } else {
            enemyOffsetX += move * dir;
            enemyOffsetY += jumpY;
            enemyRot += poseRot;
            enemyExtraScaleX = poseSX;
            enemyExtraScaleY = poseSY;
          }

          // Dual spinning arcane cast circles under caster during SKILL or Style 2 sky-strike
          if ((isSkillCast || attackStyle === 2) && p < 0.68) {
            const ringAlpha = Math.sin(Math.min(1, p / 0.68) * Math.PI);
            const cx = actorX + move * dir;
            rig.projGfx.lineStyle(4, 0xfef08a, ringAlpha * 0.95);
            rig.projGfx.drawEllipse(cx, rig.baseY + 42, 96, 28);
            rig.projGfx.lineStyle(3, cmdColor, ringAlpha * 0.85);
            rig.projGfx.drawEllipse(cx, rig.baseY + 42, 72, 20);
          }

          // ELEMENT-SPECIFIC DIVERSE ATTACK & SKILL VFX!
          const ix = cur.resolvedMode === 'DUEL' ? targetX : actorX;
          const iy = rig.baseY - 48;

          if (cur.resolvedMode === 'DUEL' && p < 0.56) {
            const projT = Math.min(1, p / 0.5);
            const projX = actorX + (targetX - actorX) * projT;
            const projY = rig.baseY - 62 - Math.sin(projT * Math.PI) * (attackStyle === 1 ? 62 : 28);
            const orbRadius = isSkillCast ? 26 : 16;

            if (elem === 'KIM') {
              // ⚡ KIM: Jagged sky-to-target lightning bolt + golden razor crescents
              if (p > 0.22) {
                rig.projGfx.lineStyle(isSkillCast ? 6 : 4, 0xfef08a, 0.95);
                rig.projGfx.moveTo(ix + (Math.random() - 0.5) * 32, 0);
                for (let seg = 1; seg <= 6; seg++) {
                  const ty = ((iy + 20) * seg) / 6;
                  const tx = ix + (seg === 6 ? 0 : (Math.random() - 0.5) * 44);
                  rig.projGfx.lineTo(tx, ty);
                }
                rig.projGfx.lineStyle(2.5, 0xffffff, 0.95);
                rig.projGfx.moveTo(ix, 0);
                rig.projGfx.lineTo(ix + (Math.random() - 0.5) * 26, iy * 0.5);
                rig.projGfx.lineTo(ix, iy);
              }
              // Golden blade wave
              rig.projGfx.lineStyle(isSkillCast ? 6 : 4, 0xfacc15, 0.95);
              const arcStart = dir > 0 ? -Math.PI * 0.45 : Math.PI * 0.55;
              const arcEnd = dir > 0 ? Math.PI * 0.45 : Math.PI * 1.45;
              rig.projGfx.arc(projX, projY, orbRadius + 16, arcStart, arcEnd);
            } else if (elem === 'THO') {
              // 🪨 THỔ: Molten meteor plunging diagonally from upper sky into target
              const metX = ix - dir * 180 * (1 - projT);
              const metY = -30 + (iy + 30) * projT;
              rig.projGfx.beginFill(0xf97316, 0.45);
              rig.projGfx.drawCircle(metX, metY, orbRadius + 12);
              rig.projGfx.endFill();
              rig.projGfx.beginFill(0x78350f, 0.95);
              rig.projGfx.drawPolygon([
                metX - orbRadius, metY - 4,
                metX - 6, metY - orbRadius,
                metX + orbRadius, metY - 6,
                metX + 10, metY + orbRadius,
                metX - 12, metY + orbRadius * 0.8,
              ]);
              rig.projGfx.endFill();
              rig.projGfx.lineStyle(3, 0xfde047, 0.85);
              rig.projGfx.moveTo(metX, metY);
              rig.projGfx.lineTo(metX - dir * 55, metY - 48);
            } else if (elem === 'THUY') {
              // ❄️ THỦY: Spinning 6-point frost crystal lance + cyan tidal waves
              for (let tIdx = 3; tIdx >= 0; tIdx--) {
                const pt = Math.max(0, projT - tIdx * 0.06);
                const px = actorX + (targetX - actorX) * pt;
                const py = rig.baseY - 60 - Math.sin(pt * Math.PI) * 34;
                const r = (orbRadius + 4) * (1 - tIdx * 0.16);
                rig.projGfx.lineStyle(3, tIdx === 0 ? 0xe0f2fe : 0x38bdf8, 0.9 - tIdx * 0.18);
                for (let k = 0; k < 3; k++) {
                  const ang = elapsedTotal * 12 + (k * Math.PI) / 3;
                  rig.projGfx.moveTo(px - Math.cos(ang) * r, py - Math.sin(ang) * r);
                  rig.projGfx.lineTo(px + Math.cos(ang) * r, py + Math.sin(ang) * r);
                }
              }
            } else if (elem === 'MOC') {
              // 🍃 MỘC: Twin spiraling emerald vine ribbons + razor leaf barrage
              rig.projGfx.lineStyle(isSkillCast ? 5 : 3.5, 0x4ade80, 0.92);
              for (let strand = -1; strand <= 1; strand += 2) {
                rig.projGfx.moveTo(actorX, rig.baseY - 56);
                for (let s = 1; s <= 12; s++) {
                  const st = (projT * s) / 12;
                  const sx = actorX + (targetX - actorX) * st;
                  const sy = rig.baseY - 56 + Math.sin(st * Math.PI * 4) * 26 * strand;
                  rig.projGfx.lineTo(sx, sy);
                }
              }
              rig.projGfx.beginFill(0xbbf7d0, 0.95);
              rig.projGfx.drawEllipse(projX, projY, orbRadius + 6, 7);
              rig.projGfx.endFill();
            } else {
              // 🔥 HỎA: Blazing spiral fireball + ember comet tail
              for (let tIdx = 5; tIdx >= 1; tIdx--) {
                const prevT = Math.max(0, projT - tIdx * 0.05);
                const px = actorX + (targetX - actorX) * prevT;
                const py = rig.baseY - 62 - Math.sin(prevT * Math.PI) * 32 + Math.sin(prevT * 24) * 6;
                rig.projGfx.beginFill(tIdx % 2 === 0 ? 0xf97316 : 0xfacc15, 0.32 * (1 - tIdx * 0.14));
                rig.projGfx.drawCircle(px, py, Math.max(5, orbRadius * (1.15 - tIdx * 0.14)));
                rig.projGfx.endFill();
              }
              rig.projGfx.beginFill(0xef4444, 0.55);
              rig.projGfx.drawCircle(projX, projY, orbRadius + 9);
              rig.projGfx.endFill();
              rig.projGfx.beginFill(0xfef08a, 0.95);
              rig.projGfx.drawCircle(projX, projY, orbRadius * 0.58);
              rig.projGfx.endFill();
            }
          }

          // Impact Phase: Elemental Pillar / Cross Slash / Impact Flash!
          if (p >= 0.38 && p < 0.76) {
            const slashProg = (p - 0.38) / 0.38;
            const slashAlpha = Math.max(0, 1 - slashProg);
            const span = (isSkillCast ? 72 : 46) * (0.65 + slashProg * 0.55);

            // Rising Elemental Pillar on SKILL or HOA/KIM/THUY sky strike
            if (isSkillCast || attackStyle === 2) {
              const pillarW = (isSkillCast ? 88 : 54) * (1 - slashProg * 0.35);
              rig.projGfx.beginFill(cmdColor, slashAlpha * 0.34);
              rig.projGfx.drawRect(ix - pillarW / 2, 0, pillarW, rig.baseY + 46);
              rig.projGfx.endFill();
              rig.projGfx.beginFill(0xffffff, slashAlpha * 0.42);
              rig.projGfx.drawRect(ix - pillarW * 0.18, 0, pillarW * 0.36, rig.baseY + 46);
              rig.projGfx.endFill();
            }

            // Crisp Double X-Slash + White Core
            rig.projGfx.lineStyle(6 * slashAlpha + 1, cmdColor, slashAlpha * 0.95);
            rig.projGfx.moveTo(ix - span, iy - span * 0.78);
            rig.projGfx.lineTo(ix + span, iy + span * 0.78);
            rig.projGfx.moveTo(ix + span, iy - span * 0.78);
            rig.projGfx.lineTo(ix - span, iy + span * 0.78);
            rig.projGfx.lineStyle(2.8 * slashAlpha, 0xffffff, slashAlpha);
            rig.projGfx.moveTo(ix - span * 0.82, iy - span * 0.62);
            rig.projGfx.lineTo(ix + span * 0.82, iy + span * 0.62);
          }

          if (!anim.impactFired && p >= 0.4) {
            anim.impactFired = true;
            const impactX = cur.resolvedMode === 'DUEL' ? targetX : actorX;
            const impactY = rig.baseY - 42;
            const burstCount = isSkillCast || anim.cmd.crit ? 34 : 20;
            spawnBurst(impactX, impactY, cmdColor, burstCount, elem === 'HOA');
            spawnBurst(impactX, impactY, 0xffffff, 10, false);
            spawnRing(impactX, impactY, cmdColor, isSkillCast ? 155 : 98);
            if (isSkillCast) {
              spawnRing(impactX, impactY, 0xfef08a, 108);
            }
          }

          if (p >= 0.4 && p < 0.78 && cur.resolvedMode === 'DUEL') {
            const hitDecay = 1 - (p - 0.4) / 0.38;
            const jitter = Math.sin(p * 88) * 13 * hitDecay;
            if (anim.cmd.type === 'SKILL' || anim.cmd.crit) {
              shakeX = Math.sin(p * 110) * 6 * hitDecay;
              shakeY = Math.cos(p * 95) * 4 * hitDecay;
            }
            if (isPlayerActor) {
              enemyOffsetX += jitter + 14 * hitDecay;
              enemyRot += 0.18 * hitDecay;
              enemyExtraScaleX = 1 - 0.1 * hitDecay;
              enemyExtraScaleY = 1 + 0.08 * hitDecay;
              rig.enemySprite.tint = Math.floor(p * 30) % 2 === 0 ? 0xff9999 : 0xffffff;
            } else {
              myOffsetX += jitter - 14 * hitDecay;
              myRot -= 0.18 * hitDecay;
              myExtraScaleX = 1 - 0.1 * hitDecay;
              myExtraScaleY = 1 + 0.08 * hitDecay;
              rig.mySprite.tint = Math.floor(p * 30) % 2 === 0 ? 0xff9999 : 0xffffff;
            }
          }
        } else if (anim.cmd.type === 'HEAL') {
          if (!anim.impactFired) {
            anim.impactFired = true;
            spawnBurst(actorX, rig.baseY, 0x4ade80, 22, true);
            spawnRing(actorX, rig.baseY - 12, 0x4ade80, 96);
          }
          if (isPlayerActor) {
            rig.mySprite.tint = 0xbbf7d0;
          } else {
            rig.enemySprite.tint = 0xbbf7d0;
          }
        } else if (anim.cmd.type === 'SHIELD') {
          // Authentic Pokiwar 4.0 Crescent Moon Shield self-buff (no attack lunge)
          if (!anim.impactFired) {
            anim.impactFired = true;
            spawnBurst(actorX, rig.baseY - 12, 0xe2e8f0, 18, true);
            spawnBurst(actorX, rig.baseY - 12, 0x38bdf8, 12, true);
            spawnRing(actorX, rig.baseY - 18, 0x7dd3fc, 118);
          }
          const shieldAlpha = Math.sin(p * Math.PI);
          rig.projGfx.lineStyle(4, 0xbae6fd, shieldAlpha * 0.9);
          rig.projGfx.drawCircle(actorX, rig.baseY - 40, 68 + p * 12);
        } else if (anim.cmd.type === 'RAGE') {
          // Authentic Pokiwar Fire gem: Red flame aura rises around caster ONLY (no attack!)
          if (!anim.impactFired) {
            anim.impactFired = true;
            spawnBurst(actorX, rig.baseY + 8, 0xef4444, 24, true);
            spawnBurst(actorX, rig.baseY + 8, 0xfacc15, 14, true);
            spawnRing(actorX, rig.baseY - 10, 0xf97316, 108);
          }
          const auraAlpha = Math.sin(p * Math.PI);
          rig.projGfx.beginFill(0xef4444, auraAlpha * 0.28);
          rig.projGfx.drawEllipse(actorX, rig.baseY - 36, 56, 86);
          rig.projGfx.endFill();
          rig.projGfx.lineStyle(3.5, 0xfacc15, auraAlpha * 0.88);
          rig.projGfx.drawEllipse(actorX, rig.baseY + 34, 82, 24);
          if (isPlayerActor) {
            myExtraScaleX = 1 + 0.08 * auraAlpha;
            myExtraScaleY = 1 + 0.08 * auraAlpha;
            rig.mySprite.tint = 0xfed7aa;
          } else {
            enemyExtraScaleX = 1 + 0.08 * auraAlpha;
            enemyExtraScaleY = 1 + 0.08 * auraAlpha;
            rig.enemySprite.tint = 0xfed7aa;
          }
        } else if (anim.cmd.type === 'MANA') {
          // Authentic Pokiwar Blue Lightning gem: Self-charge blue aura (no attack!)
          if (!anim.impactFired) {
            anim.impactFired = true;
            spawnBurst(actorX, rig.baseY, 0x38bdf8, 22, true);
            spawnRing(actorX, rig.baseY - 14, 0x38bdf8, 102);
          }
          const mAlpha = Math.sin(p * Math.PI);
          rig.projGfx.lineStyle(3, 0x7dd3fc, mAlpha * 0.9);
          rig.projGfx.drawEllipse(actorX, rig.baseY + 32, 78, 22);
          if (isPlayerActor) rig.mySprite.tint = 0xbae6fd;
          else rig.enemySprite.tint = 0xbae6fd;
        } else if (anim.cmd.type === 'ENERGY') {
          // Authentic Pokiwar 4.0 Purple Sun/Star gem: Self-charge Purple Accumulation Vortex (no attack!)
          if (!anim.impactFired) {
            anim.impactFired = true;
            spawnBurst(actorX, rig.baseY - 8, 0xa855f7, 24, true);
            spawnBurst(actorX, rig.baseY - 8, 0xfef08a, 10, true);
            spawnRing(actorX, rig.baseY - 16, 0xc084fc, 114);
          }
          const eAlpha = Math.sin(p * Math.PI);
          rig.projGfx.lineStyle(3.5, 0xc084fc, eAlpha * 0.95);
          rig.projGfx.drawEllipse(actorX, rig.baseY - 34, 62 * (0.7 + p * 0.5), 62 * (0.7 + p * 0.5));
          rig.projGfx.lineStyle(2.5, 0xfef08a, eAlpha * 0.85);
          rig.projGfx.drawEllipse(actorX, rig.baseY + 34, 84, 24);
          if (isPlayerActor) rig.mySprite.tint = 0xe9d5ff;
          else rig.enemySprite.tint = 0xe9d5ff;
        } else if (anim.cmd.type === 'HIT') {
          if (!anim.impactFired) {
            anim.impactFired = true;
            spawnBurst(actorX, rig.baseY - 20, 0xf87171, 16, false);
            spawnRing(actorX, rig.baseY - 20, 0xf87171, 84);
          }
          const jitter = Math.sin(p * 75) * 12 * (1 - p);
          if (isPlayerActor) {
            myOffsetX += jitter;
            rig.mySprite.tint = 0xffaaaa;
          } else {
            enemyOffsetX += jitter;
            rig.enemySprite.tint = 0xffaaaa;
          }
        }

        if (p >= 1) {
          rig.activeAnim = null;
        }
      }

      // ==================== AUTHENTIC POKIWAR BOSS / PET DEFEAT (KO) ANIMATION ====================
      let myAlpha = 1;
      let enemyAlpha = 1;
      if (cur.defeatedSide && cur.resolvedMode === 'DUEL') {
        if (!rig.koState || rig.koState.side !== cur.defeatedSide) {
          rig.koState = { side: cur.defeatedSide, elapsed: 0, burstFired: false, smokeFired: false };
        }
        const ko = rig.koState;
        ko.elapsed += dt;
        const isEnemyDefeated = ko.side !== cur.mySide;
        const koX = isEnemyDefeated ? rig.enemyBaseX : rig.myBaseX;
        const koY = rig.baseY - 46;
        const winX = isEnemyDefeated ? rig.myBaseX : rig.enemyBaseX;

        if (!ko.burstFired) {
          ko.burstFired = true;
          spawnBurst(koX, koY, 0xfde047, 36, false);
          spawnBurst(koX, koY, 0xf97316, 26, false);
          spawnRing(koX, koY, 0xfde047, 170);
          spawnRing(koX, koY, 0xffffff, 115);
        }

        if (ko.elapsed < 0.55) {
          // Phase 1: Violent KO shake + flashing red/white + golden starburst rays!
          const kp = ko.elapsed / 0.55;
          const koShake = Math.sin(ko.elapsed * 95) * 16 * (1 - kp * 0.35);
          shakeX += Math.sin(ko.elapsed * 115) * 7 * (1 - kp);
          shakeY += Math.cos(ko.elapsed * 105) * 5 * (1 - kp);
          // Comic golden starburst
          const rayR = 52 + kp * 68;
          rig.projGfx.lineStyle(4 * (1 - kp) + 1.5, 0xfde047, 0.92);
          for (let rIdx = 0; rIdx < 10; rIdx++) {
            const ang = (rIdx * Math.PI) / 5 + ko.elapsed * 3;
            rig.projGfx.moveTo(koX + Math.cos(ang) * 18, koY + Math.sin(ang) * 18);
            rig.projGfx.lineTo(koX + Math.cos(ang) * rayR, koY + Math.sin(ang) * rayR);
          }
          const flashTint = Math.floor(ko.elapsed * 28) % 2 === 0 ? 0xff6666 : 0xffffff;
          if (isEnemyDefeated) {
            enemyOffsetX += koShake;
            enemyRot += 0.25 * kp;
            rig.enemySprite.tint = flashTint;
          } else {
            myOffsetX += koShake;
            myRot -= 0.25 * kp;
            rig.mySprite.tint = flashTint;
          }
        } else {
          // Phase 2: White smoke cloud + gold coin explosion + cute Pokiwar ghost soul floating skyward!
          const dp = Math.min(1, (ko.elapsed - 0.55) / 0.95);
          if (!ko.smokeFired) {
            ko.smokeFired = true;
            // White billowing smoke puffs (Pokiwar 2)
            for (let s = 0; s < 14; s++) {
              const g = new Graphics();
              g.beginFill(0xf8fafc, 0.88);
              g.drawCircle(0, 0, 14 + Math.random() * 18);
              g.endFill();
              g.position.set(koX + (Math.random() - 0.5) * 70, koY + (Math.random() - 0.5) * 60);
              vfxLayer.addChild(g);
              const ang = Math.random() * Math.PI * 2;
              rig.particles.push({
                gfx: g,
                vx: Math.cos(ang) * (35 + Math.random() * 55),
                vy: Math.sin(ang) * (35 + Math.random() * 45) - 35,
                life: 0,
                maxLife: 0.95 + Math.random() * 0.35,
                gravity: -28,
              });
            }
            // Gold coins burst (Pokiwar 3 Boss clear!)
            for (let c = 0; c < 18; c++) {
              const cg = new Graphics();
              cg.lineStyle(2, 0xb45309, 1);
              cg.beginFill(0xfde047, 1);
              cg.drawCircle(0, 0, 7);
              cg.endFill();
              cg.position.set(koX, koY);
              vfxLayer.addChild(cg);
              const ang = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
              const spd = 140 + Math.random() * 210;
              rig.particles.push({
                gfx: cg,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd - 60,
                life: 0,
                maxLife: 1.15,
                gravity: 340,
              });
            }
          }

          // Shrink & fade out defeated Boss/Pet
          const shrink = Math.max(0.05, 1 - dp);
          if (isEnemyDefeated) {
            enemyAlpha = Math.max(0, 1 - dp * 1.25);
            enemyExtraScaleX = shrink;
            enemyExtraScaleY = shrink;
            enemyRot += dp * 0.65;
          } else {
            myAlpha = Math.max(0, 1 - dp * 1.25);
            myExtraScaleX = shrink;
            myExtraScaleY = shrink;
            myRot -= dp * 0.65;
          }

          // Cute classic Pokiwar 1.0 white-cyan ghost soul floating upward!
          const soulY = koY - dp * 165;
          const soulX = koX + Math.sin(dp * Math.PI * 4) * 14;
          const soulAlpha = dp < 0.75 ? 0.92 : Math.max(0, (1 - dp) / 0.25);
          if (soulAlpha > 0.02) {
            rig.projGfx.beginFill(0xe0f2fe, soulAlpha);
            rig.projGfx.lineStyle(2.5, 0x38bdf8, soulAlpha);
            rig.projGfx.drawCircle(soulX, soulY, 20);
            rig.projGfx.drawPolygon([
              soulX - 20, soulY,
              soulX - 18, soulY + 26,
              soulX - 7, soulY + 18,
              soulX, soulY + 27,
              soulX + 8, soulY + 18,
              soulX + 18, soulY + 26,
              soulX + 20, soulY,
            ]);
            rig.projGfx.endFill();
            // Cute eyes on the floating soul
            rig.projGfx.beginFill(0x0f172a, soulAlpha);
            rig.projGfx.drawCircle(soulX - 6, soulY - 2, 3);
            rig.projGfx.drawCircle(soulX + 6, soulY - 2, 3);
            rig.projGfx.endFill();
          }
        }

        // Celebratory victory bounce + golden light pillar on winner!
        const victoryHop = -Math.abs(Math.sin(ko.elapsed * 9)) * 28;
        const winPillarAlpha = 0.24 + Math.sin(ko.elapsed * 8) * 0.08;
        rig.projGfx.beginFill(0xfde047, winPillarAlpha);
        rig.projGfx.drawRect(winX - 48, 0, 96, rig.baseY + 52);
        rig.projGfx.endFill();
        if (isEnemyDefeated) {
          myOffsetY += victoryHop;
          myExtraScaleX = 1.06;
          myExtraScaleY = 1.06;
        } else {
          enemyOffsetY += victoryHop;
          enemyExtraScaleX = 1.06;
          enemyExtraScaleY = 1.06;
        }
      } else {
        rig.koState = null;
      }

      root.position.set(shakeX, shakeY);
      rig.myHolder.position.set(rig.myBaseX + myOffsetX, rig.baseY + myOffsetY);
      rig.mySprite.alpha = myAlpha;
      rig.mySprite.scale.set(
        rig.myFitScale * myScaleXBase * myExtraScaleX,
        rig.myFitScale * myScaleYBase * myExtraScaleY,
      );
      rig.mySprite.rotation = myRot;
      rig.mySprite.skew.x = mySkewX;

      if (cur.resolvedMode === 'DUEL') {
        rig.enemyHolder.position.set(rig.enemyBaseX + enemyOffsetX, rig.baseY + enemyOffsetY);
        rig.enemySprite.alpha = enemyAlpha;
        rig.enemySprite.scale.set(
          rig.enemyFitScale * enemyScaleXBase * enemyExtraScaleX,
          rig.enemyFitScale * enemyScaleYBase * enemyExtraScaleY,
        );
        rig.enemySprite.rotation = enemyRot;
        rig.enemySprite.skew.x = enemySkewX;
      }

      // Update particles
      for (let i = rig.particles.length - 1; i >= 0; i--) {
        const pt = rig.particles[i];
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          pt.gfx.destroy();
          rig.particles.splice(i, 1);
          continue;
        }
        pt.vy += pt.gravity * dt;
        pt.gfx.x += pt.vx * dt;
        pt.gfx.y += pt.vy * dt;
        pt.gfx.alpha = 1 - pt.life / pt.maxLife;
      }

      // Update shockwave rings
      for (let i = rig.rings.length - 1; i >= 0; i--) {
        const r = rig.rings[i];
        r.life += dt;
        if (r.life >= r.maxLife) {
          r.gfx.destroy();
          rig.rings.splice(i, 1);
          continue;
        }
        const prog = r.life / r.maxLife;
        r.gfx.clear();
        r.gfx.lineStyle(4 * (1 - prog) + 1, r.color, (1 - prog) * 0.9);
        r.gfx.drawCircle(r.x, r.y, 16 + r.maxRadius * prog);
      }
    };

    app.ticker.add(tick);

    // Load common environment textures immediately
    void (async () => {
      const [auraTex, myPedTex, enemyPedTex] = await Promise.all([
        loadSafeTexture('/assets/pokiguard/sprites/haoquang.png'),
        loadSafeTexture(
          resolvedMode === 'SINGLE'
            ? '/assets/pokiguard/sprites/pedestal.png'
            : '/assets/pokiguard/sprites/effects-01_0.png',
        ),
        loadSafeTexture(
          resolvedMode === 'SINGLE'
            ? '/assets/pokiguard/sprites/pedestal.png'
            : '/assets/pokiguard/sprites/effects-02_0.png',
        ),
      ]);
      if (cancelled) return;
      if (auraTex) {
        myAura.texture = auraTex;
        const s = (height * (resolvedMode === 'SINGLE' ? 0.72 : 0.48)) / Math.max(auraTex.height, 1);
        myAura.scale.set(s);
        enemyAura.texture = auraTex;
        enemyAura.scale.set(s);
      }
      if (myPedTex) {
        myPedestal.texture = myPedTex;
        if (resolvedMode === 'SINGLE') {
          const ps = 210 / Math.max(myPedTex.width, 1);
          myPedestal.scale.set(ps);
        } else {
          myPedestal.width = 276;
          myPedestal.height = 84;
        }
      }
      if (enemyPedTex) {
        enemyPedestal.texture = enemyPedTex;
        if (resolvedMode === 'SINGLE') {
          const es = 210 / Math.max(enemyPedTex.width, 1);
          enemyPedestal.scale.set(es);
        } else {
          enemyPedestal.width = isBoss ? 310 : 276;
          enemyPedestal.height = isBoss ? 94 : 84;
        }
      }
    })();

    return () => {
      cancelled = true;
      rigRef.current = null;
      app.ticker.remove(tick);
      try {
        const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
        app.destroy(true, { children: true, texture: false, baseTexture: false });
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // ignore cleanup errors
      }
      if (host) {
        host.innerHTML = '';
      }
    };
  }, [width, height, resolvedMode, isBoss]);

  // Swap pet sprites dynamically when Pet ID or Scale changes
  useEffect(() => {
    let cancelled = false;
    const syncSprites = async () => {
      const rig = rigRef.current;
      if (!rig) return;

      const myUrl = `/assets/pokiguard/pets/${resolvedMyId}.png`;
      const myTex = await loadTrimmedPetTexture(myUrl);
      if (cancelled || !rigRef.current) return;

      if (myTex) {
        rig.mySprite.texture = myTex;
        const targetH = height * (resolvedMode === 'SINGLE' ? 0.85 : 0.68) * scaleMultiplier;
        const maxW = width * (resolvedMode === 'SINGLE' ? 0.8 : 0.28) * scaleMultiplier;
        rig.myFitScale = Math.min(targetH / Math.max(myTex.height, 1), maxW / Math.max(myTex.width, 1));
      }

      if (resolvedMode === 'DUEL' && resolvedEnemyId) {
        const enemyUrl = `/assets/pokiguard/pets/${resolvedEnemyId}.png`;
        const enemyTex = await loadTrimmedPetTexture(enemyUrl);
        if (cancelled || !rigRef.current) return;
        if (enemyTex) {
          rig.enemySprite.texture = enemyTex;
          const targetH = height * (isBoss ? 0.76 : 0.68) * scaleMultiplier;
          const maxW = width * (isBoss ? 0.3 : 0.28) * scaleMultiplier;
          rig.enemyFitScale = Math.min(targetH / Math.max(enemyTex.height, 1), maxW / Math.max(enemyTex.width, 1));
        }
      }
    };

    void syncSprites();
    return () => {
      cancelled = true;
    };
  }, [resolvedMyId, resolvedEnemyId, resolvedMode, height, width, isBoss, scaleMultiplier]);

  // Enqueue combat animation command from either animCommand or StageActionCue
  useEffect(() => {
    const resolvedCmd: AnimCommand | null = animCommand
      ? animCommand
      : actionCue
        ? {
            id: actionCue.id,
            actor: actionCue.attackerSide,
            type: actionCue.kind === 'SKILL' ? 'SKILL' : 'ATTACK',
            crit: actionCue.kind === 'SKILL',
          }
        : null;
    if (!resolvedCmd || !rigRef.current) return;
    const duration =
      resolvedCmd.type === 'SKILL'
        ? 0.78
        : resolvedCmd.type === 'HIT'
          ? 0.38
          : 0.62;
    rigRef.current.activeAnim = {
      cmd: resolvedCmd,
      elapsed: 0,
      duration,
      impactFired: false,
    };
  }, [animCommand, actionCue]);

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        pointerEvents: 'none',
      }}
    />
  );
}

export const PokiPetStageCanvas = SpineStageCanvas;
