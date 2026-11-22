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
  speedMultiplier?: number;
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

type PetWeaponStyle =
  | 'BOW_PHOENIX'
  | 'GREATSWORD_SLASH'
  | 'LANCE_THRUST'
  | 'JESTER_DAGGERS'
  | 'FATE_CARDS'
  | 'CHESS_DROP'
  | 'DEMON_FAN_KATANA'
  | 'FOX_CLAW'
  | 'FLAME_FIST'
  | 'ICE_SPIKES'
  | 'PHOENIX_FLAME'
  | 'ANGEL_HALO'
  | 'VOID_PORTAL'
  | 'ANCIENT_DRAGON_STORM'
  | 'ANCIENT_JUDGMENT'
  | 'ELEMENTAL';

function resolvePetWeaponStyle(spriteId?: string): PetWeaponStyle {
  if (!spriteId) return 'ELEMENTAL';
  const id = spriteId.toLowerCase();
  if (id.includes('ancient_rayquaza') || id.includes('rayquaza')) return 'ANCIENT_DRAGON_STORM';
  if (id.includes('ancient_arceus') || id.includes('arceus')) return 'ANCIENT_JUDGMENT';
  if (id.includes('icarus')) return 'BOW_PHOENIX';
  if (id.includes('zidarose') || id.includes('issylt') || id.includes('shadow_sword') || id.includes('kassadin')) {
    return 'GREATSWORD_SLASH';
  }
  if (id.includes('elpidios') || id.includes('dragon_knight') || id.includes('orithyia')) {
    return 'LANCE_THRUST';
  }
  if (id.includes('joker')) return 'JESTER_DAGGERS';
  if (id.includes('risky')) return 'FATE_CARDS';
  if (id.includes('chess_master')) return 'CHESS_DROP';
  if (id.includes('hyon')) return 'DEMON_FAN_KATANA';
  if (id.includes('ahrina')) return 'FOX_CLAW';
  if (id.includes('fireware') || id.includes('zero') || id.includes('glank')) return 'FLAME_FIST';
  if (id.includes('prysma') || id.includes('twinfrost') || id.includes('aquar')) return 'ICE_SPIKES';
  if (id.includes('twinflame') || id.includes('humex')) return 'PHOENIX_FLAME';
  if (id.includes('priest') || id.includes('fairy') || id.includes('galaxy_god') || id.includes('blume')) {
    return 'ANGEL_HALO';
  }
  if (id.includes('spetra') || id.includes('axcel')) return 'VOID_PORTAL';
  return 'ELEMENTAL';
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
  speedMultiplier = 1,
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

    const myBaseX = resolvedMode === 'SINGLE' ? width * 0.5 : width * 0.175;
    const enemyBaseX = width * 0.825;
    const baseY = resolvedMode === 'SINGLE' ? height * 0.72 : height * 0.67;

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
          const actorSpriteId = isPlayerActor ? cur.myId : cur.enemyId;
          const weaponStyle = resolvePetWeaponStyle(actorSpriteId);
          // Diverse body motion tailored to the pet's weapon (ranged archers/mages lean back & shoot; swordsmen/claw/fist dash across!)
          const isRangedStyle =
            weaponStyle === 'BOW_PHOENIX' ||
            weaponStyle === 'JESTER_DAGGERS' ||
            weaponStyle === 'FATE_CARDS' ||
            weaponStyle === 'CHESS_DROP' ||
            weaponStyle === 'ICE_SPIKES' ||
            weaponStyle === 'ANGEL_HALO' ||
            weaponStyle === 'VOID_PORTAL';
          const isHeavyMelee =
            weaponStyle === 'GREATSWORD_SLASH' ||
            weaponStyle === 'FLAME_FIST' ||
            weaponStyle === 'FOX_CLAW' ||
            weaponStyle === 'DEMON_FAN_KATANA';
          const attackStyle = isSkillCast ? 3 : anim.cmd.id % 3;
          const lungeDist =
            cur.resolvedMode === 'DUEL'
              ? isRangedStyle
                ? 36
                : isHeavyMelee
                  ? 250
                  : weaponStyle === 'LANCE_THRUST' || weaponStyle === 'PHOENIX_FLAME'
                    ? 175
                    : attackStyle === 0
                      ? 215
                      : attackStyle === 1
                        ? 135
                        : 52
              : 34;
          let move = 0;
          let jumpY = 0;
          let poseRot = 0;
          let poseSX = 1;
          let poseSY = 1;

          if (p < 0.24) {
            const wp = p / 0.24;
            move = isRangedStyle ? -32 * wp : -26 * wp;
            jumpY =
              weaponStyle === 'ANGEL_HALO' || weaponStyle === 'PHOENIX_FLAME' || isSkillCast
                ? -44 * wp
                : weaponStyle === 'BOW_PHOENIX'
                  ? -16 * wp
                  : 8 * wp;
            poseRot = (isRangedStyle ? -0.2 : -0.17) * dir * wp;
            poseSX = isRangedStyle ? 1 - 0.08 * wp : 1 + 0.1 * wp;
            poseSY = isRangedStyle ? 1 + 0.1 * wp : 1 - 0.12 * wp;
          } else if (p < 0.52) {
            const lp = (p - 0.24) / 0.28;
            move = -26 + (lungeDist + 26) * lp;
            jumpY =
              weaponStyle === 'FOX_CLAW' || weaponStyle === 'GREATSWORD_SLASH'
                ? -Math.sin(lp * Math.PI) * 58
                : weaponStyle === 'BOW_PHOENIX' || isRangedStyle
                  ? -18 * (1 - lp)
                  : -Math.sin(lp * Math.PI) * 34;
            poseRot = (isHeavyMelee ? 0.3 : 0.18) * dir * Math.sin(lp * Math.PI);
            poseSX = isHeavyMelee ? 1.2 : 1.12;
            poseSY = isHeavyMelee ? 0.88 : 0.94;
            // Afterimage speed streaks behind melee dashing pets
            if (!isRangedStyle) {
              rig.projGfx.lineStyle(4, cmdColor, 0.68);
              for (let s = 0; s < 5; s++) {
                const sy = rig.baseY - 82 + s * 22;
                rig.projGfx.moveTo(actorX + move * dir - dir * 24, sy);
                rig.projGfx.lineTo(actorX + move * dir - dir * 106, sy);
              }
            }
          } else {
            const back = (p - 0.52) / 0.48;
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

          // Dual spinning arcane cast circles under caster during SKILL or ranged casts
          if ((isSkillCast || isRangedStyle) && p < 0.68) {
            const ringAlpha = Math.sin(Math.min(1, p / 0.68) * Math.PI);
            const cx = actorX + move * dir;
            rig.projGfx.lineStyle(4, 0xfef08a, ringAlpha * 0.95);
            rig.projGfx.drawEllipse(cx, rig.baseY + 42, 98, 28);
            rig.projGfx.lineStyle(3, cmdColor, ringAlpha * 0.85);
            rig.projGfx.drawEllipse(cx, rig.baseY + 42, 72, 20);
          }

          // ==================== AUTHENTIC PER-PET SIGNATURE WEAPON & MOTION VFX ====================
          const ix = cur.resolvedMode === 'DUEL' ? targetX : actorX;
          const iy = rig.baseY - 48;
          const curActorX = actorX + move * dir;
          const curActorY = rig.baseY - 52 + jumpY;

          if (cur.resolvedMode === 'DUEL' && p < 0.66) {
            const projT = Math.min(1, Math.max(0, (p - 0.1) / 0.44));
            const projX = actorX + (targetX - actorX) * projT;
            const projY = rig.baseY - 62 - Math.sin(projT * Math.PI) * 34;
            const orbRadius = isSkillCast ? 26 : 16;

            if (weaponStyle === 'BOW_PHOENIX') {
              // 🏹 MEGA ICARUS: Glowing golden-flame Phoenix Bow draw + volley of 4 rainbow/flame arrows!
              const bowX = curActorX + dir * 48;
              const bowY = curActorY - 6;
              if (p < 0.45) {
                const bowAlpha = Math.sin(Math.min(1, p / 0.45) * Math.PI);
                rig.projGfx.lineStyle(6, 0xfacc15, bowAlpha);
                rig.projGfx.arc(bowX, bowY, 54, dir > 0 ? -1.15 : Math.PI - 1.15, dir > 0 ? 1.15 : Math.PI + 1.15);
                rig.projGfx.lineStyle(2.5, 0xffffff, bowAlpha * 0.9);
                const pullBack = p < 0.25 ? (p / 0.25) * 28 : 28 * (1 - (p - 0.25) / 0.2);
                const topTipX = bowX + dir * 22;
                const topTipY = bowY - 48;
                const botTipY = bowY + 48;
                rig.projGfx.moveTo(topTipX, topTipY);
                rig.projGfx.lineTo(bowX - dir * pullBack, bowY);
                rig.projGfx.lineTo(topTipX, botTipY);
              }
              if (p >= 0.16 && p < 0.62) {
                const arrowCount = isSkillCast ? 5 : 3;
                const arrowColors = [0xfef08a, 0xf97316, 0x38bdf8, 0xf472b6, 0x4ade80];
                for (let a = 0; a < arrowCount; a++) {
                  const at = Math.min(1, Math.max(0, (p - 0.16 - a * 0.035) / 0.34));
                  if (at <= 0 || at >= 1) continue;
                  const spreadY = (a - (arrowCount - 1) / 2) * 24;
                  const ax = bowX + (ix - bowX) * at;
                  const ay = bowY + (iy - bowY) * at - Math.sin(at * Math.PI) * (46 + Math.abs(spreadY) * 0.6) + spreadY * (1 - at);
                  const col = arrowColors[a % arrowColors.length];
                  rig.projGfx.lineStyle(5, col, 0.95);
                  rig.projGfx.moveTo(ax - dir * 44, ay + 5);
                  rig.projGfx.lineTo(ax + dir * 16, ay);
                  rig.projGfx.lineStyle(2.2, 0xffffff, 0.95);
                  rig.projGfx.moveTo(ax - dir * 36, ay + 4);
                  rig.projGfx.lineTo(ax + dir * 18, ay);
                  // Arrowhead
                  rig.projGfx.beginFill(0xffffff, 0.95);
                  rig.projGfx.drawPolygon([ax + dir * 24, ay, ax + dir * 8, ay - 7, ax + dir * 8, ay + 7]);
                  rig.projGfx.endFill();
                }
              }
            } else if (weaponStyle === 'GREATSWORD_SLASH') {
              // ⚔️ MEGA ZIDAROSE / SHADOW SWORD / ISSYLT / KASSADIN: Blazing Greatsword sweeping arc + flame/void sword pillars!
              const isShadow = actorSpriteId?.includes('shadow_sword');
              const isVoid = actorSpriteId?.includes('kassadin');
              const isIceSword = actorSpriteId?.includes('issylt');
              const bladeOuter = isShadow ? 0xdc2626 : isVoid ? 0x22d3ee : isIceSword ? 0x38bdf8 : 0xf97316;
              const bladeCore = isShadow ? 0x18181b : isVoid ? 0xe0f2fe : 0xfef08a;
              if (p >= 0.24 && p < 0.64) {
                const sp = (p - 0.24) / 0.4;
                const arcAlpha = Math.sin(sp * Math.PI);
                const slashX = curActorX + dir * 56;
                const slashR = isSkillCast ? 148 : 112;
                // Giant sweeping sword crescent wave
                rig.projGfx.lineStyle(18 * arcAlpha + 3, bladeOuter, arcAlpha * 0.92);
                rig.projGfx.arc(slashX, iy, slashR, dir > 0 ? -1.35 : Math.PI - 1.35, dir > 0 ? 1.15 : Math.PI + 1.15);
                rig.projGfx.lineStyle(7 * arcAlpha + 1, bladeCore, arcAlpha);
                rig.projGfx.arc(slashX + dir * 6, iy, slashR - 10, dir > 0 ? -1.2 : Math.PI - 1.2, dir > 0 ? 1.0 : Math.PI + 1.0);
                // Erupting ground sword pillars around enemy (signature Shadow Sword / Zidarose finish!)
                if (p >= 0.34) {
                  for (let k = -1; k <= 1; k++) {
                    const px = ix + k * 46;
                    const ph = (isSkillCast ? 230 : 155) * arcAlpha;
                    rig.projGfx.beginFill(bladeOuter, arcAlpha * 0.55);
                    rig.projGfx.drawPolygon([px, rig.baseY + 40 - ph, px - 18, rig.baseY + 40, px + 18, rig.baseY + 40]);
                    rig.projGfx.endFill();
                    rig.projGfx.beginFill(0xffffff, arcAlpha * 0.72);
                    rig.projGfx.drawPolygon([px, rig.baseY + 40 - ph * 0.85, px - 6, rig.baseY + 40, px + 6, rig.baseY + 40]);
                    rig.projGfx.endFill();
                  }
                }
              }
            } else if (weaponStyle === 'LANCE_THRUST') {
              // 🔱 MEGA ELPIDIOS / DRAGON KNIGHT / PRIMAL ORITHYIA: Piercing Lance Beam / Golden Time Orb / Moon-Trident Frost!
              const isDragonKnight = actorSpriteId?.includes('dragon_knight');
              const isOrithyia = actorSpriteId?.includes('orithyia');
              const beamCol = isDragonKnight ? 0xfacc15 : isOrithyia ? 0x67e8f9 : 0x34d399;
              if (isDragonKnight) {
                // Hurls giant spinning Golden Time-Clock Energy Orb!
                const r = isSkillCast ? 42 : 28;
                rig.projGfx.beginFill(0xf59e0b, 0.38);
                rig.projGfx.drawCircle(projX, projY, r + 14);
                rig.projGfx.endFill();
                rig.projGfx.lineStyle(4, 0xfef08a, 0.98);
                rig.projGfx.beginFill(0xfacc15, 0.82);
                rig.projGfx.drawCircle(projX, projY, r);
                rig.projGfx.endFill();
                // Spinning clock hands inside orb
                rig.projGfx.lineStyle(3.5, 0x1e3a8a, 0.95);
                rig.projGfx.moveTo(projX, projY);
                rig.projGfx.lineTo(projX + Math.cos(elapsedTotal * 14) * r * 0.75, projY + Math.sin(elapsedTotal * 14) * r * 0.75);
                rig.projGfx.moveTo(projX, projY);
                rig.projGfx.lineTo(projX + Math.cos(-elapsedTotal * 7) * r * 0.5, projY + Math.sin(-elapsedTotal * 7) * r * 0.5);
              } else {
                // Piercing Lance Energy Beam from caster to target
                const beamAlpha = Math.sin(Math.min(1, projT) * Math.PI);
                rig.projGfx.lineStyle(isSkillCast ? 24 : 15, beamCol, beamAlpha * 0.45);
                rig.projGfx.moveTo(curActorX + dir * 34, iy);
                rig.projGfx.lineTo(curActorX + (ix - curActorX) * projT, iy);
                rig.projGfx.lineStyle(isSkillCast ? 9 : 6, 0xffffff, beamAlpha * 0.95);
                rig.projGfx.moveTo(curActorX + dir * 34, iy);
                rig.projGfx.lineTo(curActorX + (ix - curActorX) * projT, iy);
                // Spear tip cone
                const tipX = curActorX + (ix - curActorX) * projT;
                rig.projGfx.beginFill(beamCol, 0.95);
                rig.projGfx.drawPolygon([tipX + dir * 32, iy, tipX - dir * 12, iy - 16, tipX - dir * 12, iy + 16]);
                rig.projGfx.endFill();
              }
            } else if (weaponStyle === 'JESTER_DAGGERS') {
              // 🃏 FANTASY JOKER: Dark-violet phantom burst + fan of 5 spinning curved daggers & cards!
              if (isSkillCast && p > 0.12 && p < 0.58) {
                rig.projGfx.beginFill(0x3b0764, 0.24);
                rig.projGfx.drawRect(0, 0, cur.width, cur.height);
                rig.projGfx.endFill();
              }
              const count = isSkillCast ? 6 : 4;
              for (let d = 0; d < count; d++) {
                const dt2 = Math.min(1, Math.max(0, (p - 0.12 - d * 0.03) / 0.36));
                if (dt2 <= 0 || dt2 >= 1) continue;
                const spread = (d - (count - 1) / 2) * 32;
                const dx = curActorX + (ix - curActorX) * dt2;
                const dy = iy + spread * (1 - dt2) - Math.sin(dt2 * Math.PI) * 38;
                const ang = elapsedTotal * 22 + d * 1.3;
                rig.projGfx.lineStyle(3, d % 2 === 0 ? 0xe879f9 : 0xf43f5e, 0.95);
                rig.projGfx.beginFill(0xf8fafc, 0.95);
                rig.projGfx.drawPolygon([
                  dx + Math.cos(ang) * 20, dy + Math.sin(ang) * 20,
                  dx + Math.cos(ang + 2.2) * 11, dy + Math.sin(ang + 2.2) * 11,
                  dx - Math.cos(ang) * 14, dy - Math.sin(ang) * 14,
                  dx + Math.cos(ang - 2.2) * 11, dy + Math.sin(ang - 2.2) * 11,
                ]);
                rig.projGfx.endFill();
              }
            } else if (weaponStyle === 'FATE_CARDS') {
              // 🎴 GALAXY RISKY: Orbiting Red / Yellow / Blue Fate Cards streaking across!
              const cardCols = [0xef4444, 0xfacc15, 0x38bdf8];
              for (let c = 0; c < 3; c++) {
                const ct = Math.min(1, Math.max(0, (p - 0.1 - c * 0.05) / 0.38));
                if (ct <= 0 || ct >= 1) continue;
                const cx = curActorX + (ix - curActorX) * ct;
                const cy = iy + Math.sin(ct * Math.PI * 3 + c * 2) * 36;
                rig.projGfx.lineStyle(2.5, 0xfef08a, 0.98);
                rig.projGfx.beginFill(cardCols[c], 0.95);
                rig.projGfx.drawRoundedRect(cx - 12, cy - 17, 24, 34, 4);
                rig.projGfx.endFill();
              }
            } else if (weaponStyle === 'CHESS_DROP') {
              // ♟️ GALAXY CHESS MASTER: Giant Glowing Chess King crashing straight down from the sky onto enemy!
              if (p >= 0.14 && p < 0.62) {
                const dropP = Math.min(1, (p - 0.14) / 0.3);
                const chessY = -90 + (iy + 100) * (dropP * dropP);
                const cAlpha = p < 0.48 ? 0.95 : Math.max(0, 1 - (p - 0.48) / 0.14);
                rig.projGfx.lineStyle(4, 0xfef08a, cAlpha);
                rig.projGfx.beginFill(0x0ea5e9, cAlpha * 0.82);
                // Giant Chess King crown + body silhouette
                rig.projGfx.drawPolygon([
                  ix - 42, chessY + 48,
                  ix + 42, chessY + 48,
                  ix + 26, chessY - 22,
                  ix + 38, chessY - 58,
                  ix + 12, chessY - 40,
                  ix, chessY - 76,
                  ix - 12, chessY - 40,
                  ix - 38, chessY - 58,
                  ix - 26, chessY - 22,
                ]);
                rig.projGfx.endFill();
              }
            } else if (weaponStyle === 'DEMON_FAN_KATANA') {
              // 🪭 MEGA HYON: Swirling lavender talismans + twin crescent katana/fan slashes!
              const hAlpha = Math.sin(Math.min(1, projT) * Math.PI);
              rig.projGfx.lineStyle(12 * hAlpha + 2, 0xc084fc, hAlpha * 0.92);
              rig.projGfx.arc(projX, iy, 68, dir > 0 ? -1.1 : Math.PI - 1.1, dir > 0 ? 1.1 : Math.PI + 1.1);
              rig.projGfx.lineStyle(5 * hAlpha + 1, 0xfef08a, hAlpha);
              rig.projGfx.arc(projX + dir * 12, iy, 54, dir > 0 ? -0.95 : Math.PI - 0.95, dir > 0 ? 0.95 : Math.PI + 0.95);
              for (let t = 0; t < 4; t++) {
                const tx = projX - dir * (25 + t * 22);
                const ty = iy + Math.sin(elapsedTotal * 12 + t * 1.6) * 42;
                rig.projGfx.beginFill(0xfef08a, 0.85);
                rig.projGfx.drawRect(tx - 5, ty - 11, 10, 22);
                rig.projGfx.endFill();
              }
            } else if (weaponStyle === 'FOX_CLAW') {
              // 🦊 MEGA AHRINA: 3 parallel blazing golden-crimson kitsune claw gashes!
              if (p >= 0.28 && p < 0.64) {
                const cp = (p - 0.28) / 0.36;
                const cAlpha = Math.sin(cp * Math.PI);
                for (let c = -1; c <= 1; c++) {
                  const off = c * 26;
                  rig.projGfx.lineStyle(10 * cAlpha + 2, 0xf43f5e, cAlpha * 0.95);
                  rig.projGfx.moveTo(ix - 74 + off * 0.4, iy - 68 + off);
                  rig.projGfx.lineTo(ix + 74 + off * 0.4, iy + 68 + off);
                  rig.projGfx.lineStyle(4 * cAlpha, 0xfef08a, cAlpha);
                  rig.projGfx.moveTo(ix - 64 + off * 0.4, iy - 58 + off);
                  rig.projGfx.lineTo(ix + 64 + off * 0.4, iy + 58 + off);
                }
              }
            } else if (weaponStyle === 'FLAME_FIST') {
              // 🥊 MEGA FIREWARE / ZERO / GLANK: Colossal Flaming/Armored Gauntlet Shockwave Punch!
              const isGlank = actorSpriteId?.includes('glank');
              const fistCol = isGlank ? 0x38bdf8 : 0xf97316;
              if (p >= 0.26 && p < 0.62) {
                const fp = (p - 0.26) / 0.36;
                const fAlpha = Math.sin(fp * Math.PI);
                const fx = curActorX + dir * 64;
                rig.projGfx.beginFill(fistCol, fAlpha * 0.52);
                rig.projGfx.drawCircle(fx, iy, 48 + fp * 44);
                rig.projGfx.endFill();
                rig.projGfx.lineStyle(7 * fAlpha, 0xfef08a, fAlpha);
                rig.projGfx.drawCircle(fx, iy, 36 + fp * 68);
                rig.projGfx.lineStyle(4 * fAlpha, fistCol, fAlpha * 0.9);
                rig.projGfx.drawEllipse(ix, rig.baseY + 38, 40 + fp * 110, 14 + fp * 26);
              }
            } else if (weaponStyle === 'ICE_SPIKES') {
              // ❄️ MEGA PRYSMA / TWIN FROST / GALAXY AQUAR: Jagged Iceberg / Water-Crystal Spears erupting beneath target!
              if (p >= 0.2 && p < 0.65) {
                const ip = (p - 0.2) / 0.45;
                const rise = Math.sin(Math.min(1, ip) * Math.PI);
                for (let k = -2; k <= 2; k++) {
                  const sx = ix + k * 34;
                  const sh = (k === 0 ? 210 : Math.abs(k) === 1 ? 155 : 105) * rise;
                  rig.projGfx.lineStyle(3, 0xe0f2fe, rise);
                  rig.projGfx.beginFill(k % 2 === 0 ? 0x38bdf8 : 0x7dd3fc, rise * 0.85);
                  rig.projGfx.drawPolygon([sx, rig.baseY + 44 - sh, sx - 20, rig.baseY + 44, sx + 20, rig.baseY + 44]);
                  rig.projGfx.endFill();
                }
              }
            } else if (weaponStyle === 'PHOENIX_FLAME') {
              // 🔥 MEGA TWIN FLAME / BOSS HUMEX: Giant Golden-Red Phoenix Wings + Spiraling Fire Vortex!
              const wAlpha = Math.sin(Math.min(1, p / 0.62) * Math.PI);
              // Phoenix fire wave spiraling to enemy
              for (let s = 0; s < 6; s++) {
                const pt = Math.max(0, projT - s * 0.055);
                const fx = actorX + (targetX - actorX) * pt;
                const fy = iy + Math.sin(pt * Math.PI * 5 + s) * 26;
                rig.projGfx.beginFill(s % 2 === 0 ? 0xef4444 : 0xfacc15, wAlpha * (0.6 - s * 0.08));
                rig.projGfx.drawCircle(fx, fy, 34 - s * 3);
                rig.projGfx.endFill();
              }
            } else if (weaponStyle === 'ANGEL_HALO') {
              // ✨ MEGA PRIEST / GALAXY FAIRY / GOD / BLUME: Sacred Halo Ring + Radiant Beams/Feathers!
              const isFairy = actorSpriteId?.includes('fairy');
              const isBlume = actorSpriteId?.includes('blume');
              const haloCol = isFairy ? 0x4ade80 : isBlume ? 0xf472b6 : 0xfef08a;
              const hAlpha = Math.sin(Math.min(1, p / 0.62) * Math.PI);
              rig.projGfx.lineStyle(5, haloCol, hAlpha * 0.95);
              rig.projGfx.drawCircle(curActorX, curActorY - 12, 48 + projT * 52);
              // Radiant light beam to enemy
              rig.projGfx.lineStyle(isSkillCast ? 28 : 16, haloCol, hAlpha * 0.45);
              rig.projGfx.moveTo(curActorX + dir * 24, iy - 6);
              rig.projGfx.lineTo(ix, iy);
              rig.projGfx.lineStyle(8, 0xffffff, hAlpha * 0.95);
              rig.projGfx.moveTo(curActorX + dir * 24, iy - 6);
              rig.projGfx.lineTo(ix, iy);
            } else if (weaponStyle === 'VOID_PORTAL') {
              // 🌀 BOSS SPETRA / BOSS AXCEL: Purple-black Void Portal + Crimson Scythe Orbs!
              const vAlpha = Math.sin(Math.min(1, p / 0.62) * Math.PI);
              rig.projGfx.lineStyle(6, 0xa855f7, vAlpha);
              rig.projGfx.beginFill(0x1e0536, vAlpha * 0.85);
              rig.projGfx.drawEllipse(curActorX + dir * 48, iy, 28, 66);
              rig.projGfx.endFill();
              // Dark void orb streaking into enemy
              rig.projGfx.beginFill(0x7e22ce, 0.72);
              rig.projGfx.drawCircle(projX, projY, orbRadius + 14);
              rig.projGfx.endFill();
              rig.projGfx.beginFill(0x090414, 0.95);
              rig.projGfx.drawCircle(projX, projY, orbRadius * 0.7);
              rig.projGfx.endFill();
              rig.projGfx.lineStyle(3.5, 0xf43f5e, 0.95);
              rig.projGfx.drawCircle(projX, projY, orbRadius + 6);
            } else if (weaponStyle === 'ANCIENT_DRAGON_STORM') {
              // 🐉 ANCIENT RAYQUAZA (A3): Emerald Sky Dragon Vortex + Golden Paralysis Lightning & Hyper Dragon Beam!
              const sAlpha = Math.sin(Math.min(1, p / 0.64) * Math.PI);
              // Emerald-gold swirling dragon energy beam from mouth to enemy
              rig.projGfx.lineStyle(isSkillCast ? 36 : 22, 0x10b981, sAlpha * 0.55);
              rig.projGfx.moveTo(curActorX + dir * 42, iy - 14);
              rig.projGfx.lineTo(ix, iy);
              rig.projGfx.lineStyle(isSkillCast ? 14 : 9, 0xfacc15, sAlpha * 0.92);
              rig.projGfx.moveTo(curActorX + dir * 42, iy - 14);
              rig.projGfx.lineTo(ix, iy);
              rig.projGfx.lineStyle(5, 0xffffff, sAlpha);
              rig.projGfx.moveTo(curActorX + dir * 42, iy - 14);
              rig.projGfx.lineTo(ix, iy);
              // Spiraling emerald wind ribbons + crackling golden paralysis lightning around enemy
              for (let r = 0; r < 5; r++) {
                const rt = Math.max(0, projT - r * 0.08);
                const rx = curActorX + (ix - curActorX) * rt;
                const ry = iy + Math.sin(rt * Math.PI * 6 + r * 1.4) * 34;
                rig.projGfx.beginFill(r % 2 === 0 ? 0x34d399 : 0xfde047, sAlpha * 0.78);
                rig.projGfx.drawCircle(rx, ry, 18 - r * 2);
                rig.projGfx.endFill();
              }
              if (p > 0.22) {
                for (let bolt = -1; bolt <= 1; bolt++) {
                  rig.projGfx.lineStyle(isSkillCast ? 5 : 3.5, 0xfef08a, sAlpha);
                  const bx = ix + bolt * 34;
                  rig.projGfx.moveTo(bx, 0);
                  rig.projGfx.lineTo(bx + (bolt % 2 === 0 ? 18 : -18), iy * 0.38);
                  rig.projGfx.lineTo(bx - (bolt % 2 === 0 ? 14 : -14), iy * 0.72);
                  rig.projGfx.lineTo(ix + bolt * 16, iy + 22);
                }
              }
            } else if (weaponStyle === 'ANCIENT_JUDGMENT') {
              // ✨ ANCIENT ARCEUS (A1): Radiant Twin Golden Angel Wings + 3 Celestial Judgment Light Pillars!
              const jAlpha = Math.sin(Math.min(1, p / 0.64) * Math.PI);
              // Twin radiant golden wings fanning out behind Arceus
              for (const sideSign of [-1, 1]) {
                rig.projGfx.lineStyle(4, 0xfef08a, jAlpha * 0.95);
                rig.projGfx.beginFill(0xfacc15, jAlpha * 0.42);
                rig.projGfx.drawPolygon([
                  curActorX, curActorY - 16,
                  curActorX + sideSign * (92 + projT * 46), curActorY - 96 - projT * 24,
                  curActorX + sideSign * (112 + projT * 38), curActorY - 26,
                  curActorX + sideSign * (64 + projT * 24), curActorY + 12,
                ]);
                rig.projGfx.endFill();
              }
              // 3 descending celestial Judgment pillars crashing onto the target!
              if (p >= 0.16) {
                for (let k = -1; k <= 1; k++) {
                  const px = ix + k * 48;
                  const pw = k === 0 ? (isSkillCast ? 44 : 30) : (isSkillCast ? 26 : 18);
                  rig.projGfx.beginFill(k === 0 ? 0xfacc15 : 0x38bdf8, jAlpha * 0.48);
                  rig.projGfx.drawRect(px - pw / 2, 0, pw, rig.baseY + 42);
                  rig.projGfx.endFill();
                  rig.projGfx.beginFill(0xffffff, jAlpha * 0.85);
                  rig.projGfx.drawRect(px - pw * 0.22, 0, pw * 0.44, rig.baseY + 42);
                  rig.projGfx.endFill();
                }
                rig.projGfx.lineStyle(4, 0xfef08a, jAlpha);
                rig.projGfx.drawEllipse(ix, rig.baseY + 34, 48 + projT * 96, 14 + projT * 22);
              }
            } else if (elem === 'KIM') {
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
              rig.projGfx.lineStyle(isSkillCast ? 6 : 4, 0xfacc15, 0.95);
              const arcStart = dir > 0 ? -Math.PI * 0.45 : Math.PI * 0.55;
              const arcEnd = dir > 0 ? Math.PI * 0.45 : Math.PI * 1.45;
              rig.projGfx.arc(projX, projY, orbRadius + 16, arcStart, arcEnd);
            } else if (elem === 'THO') {
              // 🪨 THỔ: Molten meteor plunging diagonally into target
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
              // ❄️ THỦY: Spinning 6-point frost crystal lance
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

            // Multi-layered PokiGuard Radiant Weapon Slash + Comic Starburst Rays on Impact!
            rig.projGfx.lineStyle(8 * slashAlpha + 2, 0xfde047, slashAlpha * 0.92);
            rig.projGfx.moveTo(ix - span * 1.15, iy - span * 0.85);
            rig.projGfx.lineTo(ix + span * 1.15, iy + span * 0.85);
            rig.projGfx.moveTo(ix + span * 1.15, iy - span * 0.85);
            rig.projGfx.lineTo(ix - span * 1.15, iy + span * 0.85);
            rig.projGfx.lineStyle(5 * slashAlpha + 1, cmdColor, slashAlpha * 0.95);
            rig.projGfx.moveTo(ix - span * 1.25, iy);
            rig.projGfx.lineTo(ix + span * 1.25, iy);
            rig.projGfx.lineStyle(3.2 * slashAlpha, 0xffffff, slashAlpha);
            rig.projGfx.moveTo(ix - span * 0.95, iy - span * 0.7);
            rig.projGfx.lineTo(ix + span * 0.95, iy + span * 0.7);
            rig.projGfx.moveTo(ix + span * 0.95, iy - span * 0.7);
            rig.projGfx.lineTo(ix - span * 0.95, iy + span * 0.7);
            // Jagged starburst flare rays behind impact
            if (isSkillCast || anim.cmd.crit) {
              const rayOuter = span * 1.45;
              const rayInner = span * 0.45;
              rig.projGfx.beginFill(0xfef08a, slashAlpha * 0.35);
              const starPts: number[] = [];
              for (let k = 0; k < 16; k++) {
                const ang = (k * Math.PI) / 8 + slashProg * 0.8;
                const rad = k % 2 === 0 ? rayOuter : rayInner;
                starPts.push(ix + Math.cos(ang) * rad, iy + Math.sin(ang) * rad);
              }
              rig.projGfx.drawPolygon(starPts);
              rig.projGfx.endFill();
            }
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
    const baseDuration =
      resolvedCmd.type === 'SKILL'
        ? 0.78
        : resolvedCmd.type === 'HIT'
          ? 0.38
          : 0.62;
    const duration = baseDuration / (speedMultiplier > 1 ? 1.75 : 1);
    rigRef.current.activeAnim = {
      cmd: resolvedCmd,
      elapsed: 0,
      duration,
      impactFired: false,
    };
  }, [animCommand, actionCue, speedMultiplier]);

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
