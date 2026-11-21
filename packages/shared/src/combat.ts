import {
  areAdjacent,
  clearAndRefill,
  cloneBoard,
  createBoard,
  findMatches,
  findValidMoves,
  isInsideBoard,
  shuffleBoard,
  swapCellsInPlace,
} from './board.js';
import { getElementMultiplier, getFieldElementModifier } from './elements.js';
import { SeededRandom } from './prng.js';
import type {
  ActiveStatus,
  BattleEvent,
  BattleFighter,
  BattleState,
  BotDifficulty,
  ElementType,
  EvolutionTier,
  GemType,
  MatchGroup,
  PetDef,
  Pos,
  QteGrade,
  Side,
  SkillDef,
  SupportCardId,
} from './types.js';

export const MATCH_CONSTANTS = {
  MAX_RAGE: 250,
  BASE_MAX_MANA: 320,
  START_MANA: 80,
  FUSION_MANA_COST: 120,
  DEFAULT_CAST_MANA_COST: 160,
  FUSION_HP_BONUS_PCT: 0.7,
  FUSION_MANA_BONUS: 200,
  MAX_CONSECUTIVE_PASSES: 2,
} as const;

const EVO_ORDER: readonly EvolutionTier[] = ['BASE', 'S', 'MEGA', 'GALAXY', 'ANCIENT', 'MECH'];

export function otherSide(side: Side): Side {
  return side === 'P1' ? 'P2' : 'P1';
}

export interface FighterBonusOptions {
  hpBonus?: number;
  atkBonus?: number;
  magicBonus?: number;
  defenseBonus?: number;
  speedBonus?: number;
  manaBonus?: number;
  mercenaryBuff?: boolean;
  secondMercenaryBuff?: boolean;
  equippedSupportCards?: SupportCardId[];
  supportCardLevels?: Partial<Record<SupportCardId, number>>;
  petStars?: number;
  genLevel?: number;
  breakthroughLevel?: number;
  auraId?: string;
  guardPet?: PetDef | null;
  /** Authentic Pokiwar 4.0 Pet Hợp Thể (Secondary Fusion Partner) */
  fusionPet?: PetDef | null;
  /** Pokiwar 4.0 Hiệu Ứng Ngũ Hành Đấu Trường */
  fieldElement?: ElementType;
  /** Pokiwar 4.0 Đảo Châu Báu Equalizer Rules (bans Mega/Galaxy/Fantasy special cards, Guard & Fusion) */
  restrictedRules?: boolean;
  /** Empower enemy P2 as a true Pokiwar Boss (×1.65 Max HP, ×1.22 ATK/MAG, ×1.18 DEF, initial Boss Shield & starting Rage/Mana) */
  isBossEncounter?: boolean;
}

export function createFighter(
  side: Side,
  pet: PetDef,
  scale = 1,
  level = 1,
  bonuses?: FighterBonusOptions,
): BattleFighter {
  const restricted = Boolean(bonuses?.restrictedRules);
  const activeSkills = restricted
    ? pet.skills.filter((s) => !s.isSpecialCard && !s.boardEffect)
    : pet.skills;

  const cooldowns: Record<string, number> = {};
  for (const sk of activeSkills) {
    cooldowns[sk.id] = 0;
  }
  const guardPet = restricted ? null : (bonuses?.guardPet ?? null);
  const fusionPet = restricted ? null : (bonuses?.fusionPet ?? null);
  const guardHp = guardPet ? Math.round(guardPet.maxHp * 0.16) : 0;
  const guardAtk = guardPet ? Math.round(guardPet.attack * 0.16) : 0;
  const guardMag = guardPet ? Math.round(guardPet.magic * 0.16) : 0;
  const fusionHp = fusionPet ? Math.round(fusionPet.maxHp * 0.12) : 0;
  const fusionAtk = fusionPet ? Math.round(fusionPet.attack * 0.12) : 0;
  const fusionMag = fusionPet ? Math.round(fusionPet.magic * 0.12) : 0;

  const fieldMod = getFieldElementModifier(pet.element, bonuses?.fieldElement);
  const hpMult = (1 + (bonuses?.mercenaryBuff ? 0.15 : 0) + (bonuses?.secondMercenaryBuff ? 0.1 : 0)) * fieldMod.hpMult;
  const atkMult = 1 + (bonuses?.mercenaryBuff ? 0.15 : 0);
  const magicMult = 1 + (bonuses?.mercenaryBuff ? 0.15 : 0) + (bonuses?.secondMercenaryBuff ? 0.15 : 0);
  const maxHp = Math.max(200, Math.round(pet.maxHp * scale * hpMult) + (bonuses?.hpBonus ?? 0) + guardHp + fusionHp);
  const attack = Math.round(pet.attack * scale * atkMult) + (bonuses?.atkBonus ?? 0) + guardAtk + fusionAtk;
  const magic =
    Math.round(pet.magic * scale * magicMult) +
    (bonuses?.magicBonus ?? Math.round((bonuses?.atkBonus ?? 0) * 0.7)) +
    guardMag +
    fusionMag;
  const defense = Math.round(pet.defense * scale) + (bonuses?.defenseBonus ?? 0);
  const speed = pet.speed + (bonuses?.speedBonus ?? 0);
  const maxMana = MATCH_CONSTANTS.BASE_MAX_MANA + (bonuses?.manaBonus ?? 0);
  const startMana = Math.min(maxMana, MATCH_CONSTANTS.START_MANA + (bonuses?.secondMercenaryBuff ? 45 : 0));
  const startRage = bonuses?.secondMercenaryBuff ? 25 : 0;
  const equippedSupportCards: SupportCardId[] =
    bonuses?.equippedSupportCards && bonuses.equippedSupportCards.length > 0
      ? bonuses.equippedSupportCards.slice(0, 3)
      : ['MANA_100', 'RAGE_50', 'HP_350'];
  const allyCount = (bonuses?.mercenaryBuff ? 1 : 0) + (bonuses?.secondMercenaryBuff ? 1 : 0);

  const safeGen = Math.max(0, Math.min(5, bonuses?.genLevel ?? pet.genLevel ?? 0));
  let reviveCharges = 0;
  if (pet.passiveSkill?.kind === 'HOI_SINH') {
    reviveCharges += Math.max(1, Math.round(pet.passiveSkill.value));
  }
  if (safeGen >= 3) {
    reviveCharges = Math.max(reviveCharges, safeGen >= 5 ? 2 : 1);
  }
  const initShield =
    pet.passiveSkill?.kind === 'HO_GIAP'
      ? Math.round(maxHp * Math.min(0.4, pet.passiveSkill.value || 0.25))
      : 0;

  return {
    side,
    petId: pet.id,
    spriteId: pet.spriteId,
    evolutionSprites: pet.evolutionSprites ?? {},
    name: pet.name,
    level,
    element: pet.element,
    tier: pet.tier,
    hp: maxHp,
    maxHp,
    shield: initShield,
    mana: startMana,
    maxMana,
    rage: startRage,
    maxRage: Math.max(pet.maxRage, MATCH_CONSTANTS.MAX_RAGE),
    attack,
    magic,
    defense,
    speed,
    consecutivePasses: 0,
    inBattleEvolved: false,
    colorPrimary: pet.colorPrimary,
    colorSecondary: pet.colorSecondary,
    skills: activeSkills,
    cooldowns,
    statuses: [],
    supportUsed: {},
    equippedSupportCards,
    supportCardLevels: bonuses?.supportCardLevels ?? {},
    stars: bonuses?.petStars ?? pet.stars ?? 1,
    genLevel: safeGen,
    reviveCharges,
    maxReviveCharges: reviveCharges,
    passiveSkill: pet.passiveSkill,
    auraId: bonuses?.auraId,
    guardPetId: guardPet?.id,
    guardPetName: guardPet?.name,
    guardPetSpriteId: guardPet?.spriteId,
    fusionPetId: fusionPet?.id,
    fusionPetName: fusionPet?.name,
    fusionPetSpriteId: fusionPet?.spriteId,
    fusionStrikeUsed: false,
    accumStacks: 0,
    breakthroughLevel: bonuses?.breakthroughLevel ?? 0,
    allyCount,
  };
}

export function createBattleState(
  p1Pet: PetDef,
  p2Pet: PetDef,
  seed: number,
  p2Scale = 1,
  p1Level = 1,
  p2Level = 1,
  rows = 8,
  cols = 8,
  p1Bonuses?: FighterBonusOptions,
): BattleState {
  const rng = new SeededRandom(seed);
  const { board, nextGemId } = createBoard(rows, cols, rng, 1);
  const p1 = createFighter('P1', p1Pet, 1, p1Level, p1Bonuses);
  const p2 = createFighter('P2', p2Pet, p2Scale, p2Level, {
    fieldElement: p1Bonuses?.fieldElement,
    restrictedRules: p1Bonuses?.restrictedRules,
  });
  if (p1Bonuses?.isBossEncounter) {
    p2.maxHp = Math.round(p2.maxHp * 1.65);
    p2.hp = p2.maxHp;
    p2.attack = Math.round(p2.attack * 1.22);
    p2.magic = Math.round(p2.magic * 1.22);
    p2.defense = Math.round(p2.defense * 1.18);
    p2.shield = Math.max(p2.shield, Math.round(p2.maxHp * 0.22));
    p2.rage = Math.min(p2.maxRage, p2.rage + 45);
    p2.mana = Math.min(p2.maxMana, p2.mana + 70);
  }
  // Pokiwar classic rule: Player moves first unless faster PvP opponent is P2
  const firstTurn: Side = p1.speed >= p2.speed ? 'P1' : 'P2';

  return {
    rows,
    cols,
    board,
    fighters: { P1: p1, P2: p2 },
    currentTurn: firstTurn,
    turnNumber: 1,
    winner: null,
    rngState: rng.getState(),
    nextGemId,
    bonusGold: { P1: 0, P2: 0 },
    fieldElement: p1Bonuses?.fieldElement,
    restrictedRules: p1Bonuses?.restrictedRules,
  };
}

function getEffectiveAttack(fighter: BattleFighter, fieldElement?: ElementType): number {
  const atkUp = fighter.statuses.find((s) => s.kind === 'ATK_UP');
  const bonus = atkUp ? 1 + atkUp.value : 1;
  let cuongHuyetMult = 1;
  if (fighter.passiveSkill?.kind === 'CUONG_HUYET') {
    const missingPct = Math.max(0, 1 - fighter.hp / Math.max(1, fighter.maxHp));
    cuongHuyetMult = 1 + Math.floor(missingPct * 10) * (fighter.passiveSkill.value || 0.05);
  }
  const accumMult = 1 + (fighter.accumStacks ?? 0) * 0.05;
  const fieldMult = getFieldElementModifier(fighter.element, fieldElement).dmgMult;
  return fighter.attack * bonus * cuongHuyetMult * accumMult * fieldMult;
}

function getEffectiveMagic(fighter: BattleFighter, fieldElement?: ElementType): number {
  const accumMult = 1 + (fighter.accumStacks ?? 0) * 0.05;
  const fieldMult = getFieldElementModifier(fighter.element, fieldElement).dmgMult;
  return fighter.magic * accumMult * fieldMult;
}

function tryReviveFighter(fighter: BattleFighter, events: BattleEvent[]): boolean {
  if (fighter.hp > 0) return false;
  const charges = fighter.reviveCharges ?? 0;
  if (charges <= 0) return false;
  fighter.reviveCharges = charges - 1;
  const hpRestored = Math.round(fighter.maxHp * 0.42);
  fighter.hp = hpRestored;
  fighter.shield = Math.min(Math.round(fighter.maxHp * 0.65), fighter.shield + Math.round(fighter.maxHp * 0.15));
  events.push({
    type: 'REVIVE',
    side: fighter.side,
    hpRestored,
    remainingCharges: fighter.reviveCharges,
  });
  return true;
}

function getRageDamageMultiplier(rage: number): number {
  if (rage >= 200) return 1.55;
  if (rage >= 100) return 1.28;
  return 1.0;
}

function applyDamage(
  target: BattleFighter,
  rawDamage: number,
): { hpDamage: number; shieldAbsorbed: number } {
  const dmg = Math.max(1, Math.round(rawDamage));
  let shieldAbsorbed = 0;
  let remaining = dmg;

  if (target.shield > 0) {
    shieldAbsorbed = Math.min(target.shield, remaining);
    target.shield -= shieldAbsorbed;
    remaining -= shieldAbsorbed;
  }

  const hpDamage = Math.min(target.hp, remaining);
  target.hp -= hpDamage;
  return { hpDamage, shieldAbsorbed };
}

function computeGemEffects(
  state: BattleState,
  attacker: BattleFighter,
  defender: BattleFighter,
  gemType: GemType,
  effectiveCount: number,
  comboMultiplier: number,
  rng: SeededRandom,
): BattleEvent {
  const side = attacker.side;
  const target = defender.side;
  const scaleFactor = effectiveCount / 3;
  const elemMult = getElementMultiplier(attacker.element, defender.element);

  if (gemType === 'SWORD') {
    const baseStat = getEffectiveAttack(attacker, state.fieldElement);
    const rageBuff = getRageDamageMultiplier(attacker.rage);
    const pierceRatio = attacker.passiveSkill?.kind === 'XUYEN_GIAP' ? attacker.passiveSkill.value || 0.35 : 0;
    const mitigation = 100 / (100 + defender.defense * (1 - pierceRatio) * 0.72);
    const isCrit = rng.next() < 0.14;
    const critMult = isCrit ? 1.5 : 1.0;
    const rawDamage =
      baseStat * 1.15 * scaleFactor * rageBuff * comboMultiplier * elemMult * mitigation * critMult;
    const { hpDamage, shieldAbsorbed } = applyDamage(defender, rawDamage);
    const totalDealt = hpDamage + shieldAbsorbed;
    const rageMult = attacker.passiveSkill?.kind === 'CUONG_NO' ? 1.35 : 1;
    const rageGain = Math.min(attacker.maxRage - attacker.rage, Math.round(effectiveCount * 4 * rageMult));
    attacker.rage += rageGain;

    let passiveHeal: number | undefined;
    if (attacker.passiveSkill?.kind === 'HAP_HUYET' && totalDealt > 0) {
      const h = Math.min(attacker.maxHp - attacker.hp, Math.round(totalDealt * (attacker.passiveSkill.value || 0.18)));
      if (h > 0) {
        attacker.hp += h;
        passiveHeal = h;
      }
    }
    const reflectStatus = defender.statuses.find((s) => s.kind === 'REFLECT');
    const reflectRatio =
      (defender.passiveSkill?.kind === 'PHAN_DON' ? defender.passiveSkill.value || 0.14 : 0) +
      (reflectStatus ? reflectStatus.value : 0);
    if (reflectRatio > 0 && totalDealt > 0 && attacker.hp > 1) {
      const reflect = Math.round(totalDealt * reflectRatio);
      attacker.hp = Math.max(1, attacker.hp - reflect);
    }

    return {
      type: 'RESOURCE_DELTA',
      side,
      target,
      gemType,
      count: effectiveCount,
      damage: totalDealt,
      shieldAbsorbed,
      heal: passiveHeal,
      rageGain,
      elementMultiplier: elemMult,
      isCrit,
    };
  }

  if (gemType === 'FIRE') {
    // Authentic Pokiwar Zing Me Fire gem: ONLY charges Rage (Nộ 0..250) on caster — NEVER deals damage or attacks!
    const rageMult = attacker.passiveSkill?.kind === 'CUONG_NO' ? 1.35 : 1;
    const rageGain = Math.min(
      attacker.maxRage - attacker.rage,
      Math.round(effectiveCount * 22 * comboMultiplier * rageMult),
    );
    attacker.rage += rageGain;

    return {
      type: 'RESOURCE_DELTA',
      side,
      target: side,
      gemType,
      count: effectiveCount,
      rageGain,
    };
  }

  if (gemType === 'LIGHTNING') {
    // Authentic Pokiwar Blue Lightning gem: ONLY restores Mana on caster — no attack!
    const manaGain = Math.min(attacker.maxMana - attacker.mana, Math.round(effectiveCount * 20 * comboMultiplier));
    attacker.mana += manaGain;
    return {
      type: 'RESOURCE_DELTA',
      side,
      target: side,
      gemType,
      count: effectiveCount,
      manaGain,
    };
  }

  if (gemType === 'HEART') {
    // Authentic Pokiwar Green Heart gem: ONLY heals HP on caster — no attack!
    const hasDeepWound = attacker.statuses.some((s) => s.kind === 'DEEP_WOUND');
    const rawHeal = Math.round(attacker.maxHp * 0.045 * scaleFactor * comboMultiplier * (hasDeepWound ? 0.65 : 1));
    const actualHeal = Math.min(attacker.maxHp - attacker.hp, rawHeal);
    attacker.hp += actualHeal;
    return {
      type: 'RESOURCE_DELTA',
      side,
      target: side,
      gemType,
      count: effectiveCount,
      heal: actualHeal,
    };
  }

  if (gemType === 'YINYANG') {
    // Authentic Pokiwar Zing Me Purple Shield gem (gem_armor.png): builds Shield/Armor on caster + drains enemy Mana!
    const shieldGain = Math.round(
      (attacker.defense * 0.62 + attacker.maxHp * 0.036) * scaleFactor * comboMultiplier,
    );
    const maxShield = Math.round(attacker.maxHp * 0.65);
    const actualShield = Math.max(0, Math.min(maxShield - attacker.shield, shieldGain));
    attacker.shield += actualShield;

    const manaDrained = Math.min(defender.mana, Math.round(effectiveCount * 10 * comboMultiplier));
    defender.mana -= manaDrained;

    return {
      type: 'RESOURCE_DELTA',
      side,
      target: side,
      gemType,
      count: effectiveCount,
      shieldGain: actualShield,
      manaDrained: manaDrained > 0 ? manaDrained : undefined,
    };
  }

  // COIN (gem_steal.png — Authentic Pokiwar White Yin-Yang / Âm Dương): drains Mana, Rage & light HP (Lifesteal) from enemy + bonus Gold!
  const manaDrained = Math.min(defender.mana, Math.round(effectiveCount * 11 * comboMultiplier));
  defender.mana -= manaDrained;
  const manaGain = Math.min(attacker.maxMana - attacker.mana, manaDrained + Math.round(effectiveCount * 4));
  attacker.mana += manaGain;

  const rageDrained = Math.min(defender.rage, Math.round(effectiveCount * 10 * comboMultiplier));
  defender.rage -= rageDrained;
  const rageGain = Math.min(attacker.maxRage - attacker.rage, rageDrained + Math.round(effectiveCount * 3));
  attacker.rage += rageGain;

  // Classic Pokiwar Yin-Yang Lifesteal (light HP drain without physical attack lunge)
  const drainRaw = Math.max(12, Math.round(attacker.magic * 0.24 * scaleFactor * comboMultiplier));
  const { hpDamage } = applyDamage(defender, drainRaw);
  const actualHeal = Math.min(attacker.maxHp - attacker.hp, hpDamage);
  attacker.hp += actualHeal;

  const goldGain = Math.round(effectiveCount * 15 * comboMultiplier);
  state.bonusGold[side] += goldGain;

  return {
    type: 'RESOURCE_DELTA',
    side,
    target: side,
    gemType,
    count: effectiveCount,
    heal: actualHeal > 0 ? actualHeal : undefined,
    manaGain: manaGain > 0 ? manaGain : undefined,
    rageGain: rageGain > 0 ? rageGain : undefined,
    manaDrained: manaDrained > 0 ? manaDrained : undefined,
    rageDrained: rageDrained > 0 ? rageDrained : undefined,
    goldGain,
  };
}

function advanceTurn(
  state: BattleState,
  events: BattleEvent[],
  allowExtraTurn: boolean,
  extraTurnReason?: string,
): void {
  // Mega Twin Frost authentic Pokiwar 4.0 Zing Me passive: heal to 70% Max HP once when dropping <= 20% HP
  for (const sideKey of ['P1', 'P2'] as const) {
    const f = state.fighters[sideKey];
    if (
      f.petId === 'pet-mega-twinfrost' &&
      !f.emergencyHealUsed &&
      f.hp > 0 &&
      f.hp <= Math.round(f.maxHp * 0.2)
    ) {
      f.emergencyHealUsed = true;
      const targetHp = Math.round(f.maxHp * 0.7);
      const gained = Math.max(0, targetHp - f.hp);
      if (gained > 0) {
        f.hp = targetHp;
        events.push({
          type: 'REVIVE',
          side: sideKey,
          hpRestored: gained,
          remainingCharges: f.reviveCharges ?? 0,
        });
      }
    }
  }

  if (state.fighters.P1.hp <= 0) {
    if (!tryReviveFighter(state.fighters.P1, events)) {
      state.winner = 'P2';
      events.push({ type: 'BATTLE_END', winner: 'P2', reason: 'KO' });
      return;
    }
  }
  if (state.fighters.P2.hp <= 0) {
    if (!tryReviveFighter(state.fighters.P2, events)) {
      state.winner = 'P1';
      events.push({ type: 'BATTLE_END', winner: 'P1', reason: 'KO' });
      return;
    }
  }

  if (allowExtraTurn) {
    events.push({
      type: 'EXTRA_TURN',
      side: state.currentTurn,
      reason: extraTurnReason ?? 'Combo 4+ ngọc — Thưởng thêm lượt!',
    });
    return;
  }

  const finishingFighter = state.fighters[state.currentTurn];
  for (const skId of Object.keys(finishingFighter.cooldowns)) {
    if (finishingFighter.cooldowns[skId] > 0) {
      finishingFighter.cooldowns[skId] -= 1;
    }
  }

  let nextTurn = otherSide(state.currentTurn);
  state.turnNumber += 1;

  for (let guard = 0; guard < 2; guard++) {
    const active = state.fighters[nextTurn];
    let stunned = false;
    const remainingStatuses: ActiveStatus[] = [];

    for (const st of active.statuses) {
      if (st.kind === 'BURN' || st.kind === 'POISON') {
        const { hpDamage } = applyDamage(active, st.value);
        events.push({ type: 'STATUS_TICK', side: nextTurn, kind: st.kind, damage: hpDamage });
      } else if (st.kind === 'DEEP_WOUND') {
        const woundDmg = Math.max(40, Math.round(active.maxHp * 0.06));
        const { hpDamage } = applyDamage(active, woundDmg);
        events.push({ type: 'STATUS_TICK', side: nextTurn, kind: 'DEEP_WOUND', damage: hpDamage });
      } else if (st.kind === 'SHIELD_REGEN') {
        active.shield = Math.min(Math.round(active.maxHp * 0.65), active.shield + st.value);
        events.push({ type: 'STATUS_TICK', side: nextTurn, kind: st.kind, heal: st.value });
      } else if (st.kind === 'STUN') {
        stunned = true;
        events.push({ type: 'STATUS_TICK', side: nextTurn, kind: 'STUN', skippedTurn: true });
      }

      if (st.remainingTurns > 1) {
        remainingStatuses.push({ ...st, remainingTurns: st.remainingTurns - 1 });
      }
    }

    active.statuses = remainingStatuses;

    if (active.hp <= 0) {
      const winner = otherSide(nextTurn);
      state.winner = winner;
      events.push({ type: 'BATTLE_END', winner, reason: 'KO' });
      return;
    }

    if (stunned) {
      nextTurn = otherSide(nextTurn);
      state.turnNumber += 1;
    } else {
      break;
    }
  }

  state.currentTurn = nextTurn;
  events.push({
    type: 'TURN_CHANGE',
    nextTurn,
    turnNumber: state.turnNumber,
  });
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  state: BattleState;
  events: BattleEvent[];
}

/** Shared cascade resolver used by both gem swaps and row-burning Mega skills. */
function resolveMatchCascade(
  state: BattleState,
  attacker: BattleFighter,
  defender: BattleFighter,
  initialMatches: ReturnType<typeof findMatches>,
  rng: SeededRandom,
  events: BattleEvent[],
): boolean {
  let matches = initialMatches;
  let cascadeIndex = 1;
  let earnedExtraTurn = false;

  while (matches.length > 0) {
    const comboMultiplier = 1 + (cascadeIndex - 1) * 0.22;
    events.push({
      type: 'MATCH_CLEAR',
      cascadeIndex,
      groups: matches,
      comboMultiplier,
    });

    for (const group of matches) {
      if (group.isExtraTurn || group.length >= 4) {
        earnedExtraTurn = true;
        attacker.accumStacks = Math.min(10, (attacker.accumStacks ?? 0) + 1);
      }
      events.push(
        computeGemEffects(
          state,
          attacker,
          defender,
          group.gemType,
          group.effectiveValue,
          comboMultiplier,
          rng,
        ),
      );
    }

    const refilled = clearAndRefill(state.board, matches, rng, state.nextGemId);
    state.board = refilled.board;
    state.nextGemId = refilled.nextGemId;

    events.push({
      type: 'BOARD_REFILL',
      drops: refilled.drops,
      boardAfter: cloneBoard(state.board),
    });

    if (defender.hp <= 0) {
      if (!tryReviveFighter(defender, events)) {
        break;
      }
    }
    if (attacker.hp <= 0) {
      if (!tryReviveFighter(attacker, events)) {
        break;
      }
    }

    matches = findMatches(state.board);
    cascadeIndex++;
  }

  return earnedExtraTurn;
}

function ensurePlayableBoard(
  state: BattleState,
  rng: SeededRandom,
  events: BattleEvent[],
): void {
  if (!state.winner && state.fighters.P1.hp > 0 && state.fighters.P2.hp > 0) {
    if (findValidMoves(state.board).length === 0 || findMatches(state.board).length > 0) {
      const shuffled = shuffleBoard(state.board, rng, state.nextGemId);
      state.board = shuffled.board;
      state.nextGemId = shuffled.nextGemId;
      events.push({
        type: 'BOARD_SHUFFLE',
        boardAfter: cloneBoard(state.board),
      });
    }
  }
}

export function executeSwap(
  state: BattleState,
  side: Side,
  from: Pos,
  to: Pos,
): ActionResult {
  if (state.winner) {
    return { ok: false, error: 'Trận đấu đã kết thúc.', state, events: [] };
  }
  if (state.currentTurn !== side) {
    return { ok: false, error: 'Chưa đến lượt của bạn.', state, events: [] };
  }
  if (!isInsideBoard(state.board, from) || !isInsideBoard(state.board, to) || !areAdjacent(from, to)) {
    return { ok: false, error: 'Nước đi không hợp lệ.', state, events: [] };
  }

  const testBoard = cloneBoard(state.board);
  swapCellsInPlace(testBoard, from, to);
  const initialMatches = findMatches(testBoard);
  if (initialMatches.length === 0) {
    return { ok: false, error: 'Nước đi này không tạo thành chuỗi 3 ngọc.', state, events: [] };
  }

  const rng = new SeededRandom(state.rngState);
  const events: BattleEvent[] = [{ type: 'SWAP', side, from, to }];

  state.board = testBoard;
  const attacker = state.fighters[side];
  const defender = state.fighters[otherSide(side)];
  attacker.consecutivePasses = 0;

  const earnedExtraTurn = resolveMatchCascade(state, attacker, defender, initialMatches, rng, events);
  ensurePlayableBoard(state, rng, events);

  state.rngState = rng.getState();
  advanceTurn(
    state,
    events,
    earnedExtraTurn,
    earnedExtraTurn ? 'Ăn 4+ ngọc — Thưởng thêm 1 lượt!' : undefined,
  );

  return { ok: true, state, events };
}

/**
 * Thẻ Hóa Thần trong trận (FusionCardUI):
 * - Chi phí: 120 Mana
 * - Free Action (KHÔNG mất lượt), dùng tối đa 1 lần mỗi trận từ Lượt 2+
 * - Cộng +70% Max HP (+ hồi phần HP đó), +200 Max Mana, +20% Công/Phép, kích hoạt hào quang Hóa Thần (giữ nguyên ngoại hình Pet độc lập!)
 */
export function executeInBattleEvolve(state: BattleState, side: Side): ActionResult {
  if (state.winner) {
    return { ok: false, error: 'Trận đấu đã kết thúc.', state, events: [] };
  }
  if (state.currentTurn !== side) {
    return { ok: false, error: 'Chưa đến lượt của bạn.', state, events: [] };
  }
  if (state.turnNumber < 2) {
    return { ok: false, error: 'Chỉ mở khóa Thẻ Hóa Thần từ lượt thứ 2 trở đi.', state, events: [] };
  }
  const fighter = state.fighters[side];
  if (fighter.inBattleEvolved) {
    return { ok: false, error: 'Pet đã kích hoạt Hóa Thần trong trận này rồi.', state, events: [] };
  }
  if (fighter.mana < MATCH_CONSTANTS.FUSION_MANA_COST) {
    return { ok: false, error: `Cần ${MATCH_CONSTANTS.FUSION_MANA_COST} Mana để kích hoạt Hóa Thần!`, state, events: [] };
  }

  fighter.mana -= MATCH_CONSTANTS.FUSION_MANA_COST;
  fighter.inBattleEvolved = true;

  const hpBonus = Math.round(fighter.maxHp * MATCH_CONSTANTS.FUSION_HP_BONUS_PCT);
  fighter.maxHp += hpBonus;
  fighter.hp = Math.min(fighter.maxHp, fighter.hp + hpBonus);
  fighter.maxMana += MATCH_CONSTANTS.FUSION_MANA_BONUS;
  fighter.mana = Math.min(fighter.maxMana, fighter.mana + 60);
  fighter.attack = Math.round(fighter.attack * 1.2);
  fighter.magic = Math.round(fighter.magic * 1.2);

  return {
    ok: true,
    state,
    events: [
      {
        type: 'IN_BATTLE_EVOLVE',
        side,
        newTier: fighter.tier,
        newSpriteId: fighter.spriteId,
        hpBonus,
        manaBonus: MATCH_CONSTANTS.FUSION_MANA_BONUS,
      },
    ],
  };
}

/**
 * 8 Thẻ Hỗ Trợ chuẩn Pokiwar / Pukiwo (người chơi chọn mang tối đa 3 thẻ/trận):
 * Dùng 1 lần/trận, Free Action (không mất lượt, không reset consecutivePasses).
 */
export const SUPPORT_CARDS: Record<
  SupportCardId,
  { id: SupportCardId; name: string; label: string; description: string; image: string; amount: number }
> = {
  MANA_100: {
    id: 'MANA_100',
    name: 'Bình Mana Lớn',
    label: '+100 Mana',
    description: 'Hồi ngay +100 Mana (Năng lượng) trong lượt mà không mất lượt.',
    image: '/assets/pokiguard/cards/card1.png',
    amount: 100,
  },
  RAGE_50: {
    id: 'RAGE_50',
    name: 'Thuốc Cuồng Nộ',
    label: '+50 Nộ',
    description: 'Tăng ngay +50 Nộ (Rage) để tung Tuyệt Kỹ.',
    image: '/assets/pokiguard/cards/card2.png',
    amount: 50,
  },
  HP_350: {
    id: 'HP_350',
    name: 'Bình Máu Đại',
    label: '+350 Máu',
    description: 'Hồi ngay +350 HP trong trận mà không mất lượt.',
    image: '/assets/pokiguard/cards/card8.png',
    amount: 350,
  },
  SHIELD_300: {
    id: 'SHIELD_300',
    name: 'Khiên Hộ Thể',
    label: '+320 Giáp',
    description: 'Tạo ngay lớp Giáp Hộ Thể +320 Giáp chặn sát thương.',
    image: '/assets/pokiguard/cards/card4.png',
    amount: 320,
  },
  ATK_BUFF: {
    id: 'ATK_BUFF',
    name: 'Chiến Cổ Cuồng Nộ',
    label: '+35% Công',
    description: 'Tăng +35% Sức Công trong 2 lượt liên tiếp.',
    image: '/assets/pokiguard/cards/card5.png',
    amount: 35,
  },
  FREEZE_1: {
    id: 'FREEZE_1',
    name: 'Băng Phong Phù',
    label: 'Đóng Băng',
    description: 'Gây 80 sát thương băng và làm Choáng đối thủ 1 lượt.',
    image: '/assets/pokiguard/cards/card6.png',
    amount: 80,
  },
  PURIFY_HEAL: {
    id: 'PURIFY_HEAL',
    name: 'Thánh Thủy Thanh Tẩy',
    label: 'Giải +240HP',
    description: 'Xóa toàn bộ hiệu ứng Đốt/Độc và hồi ngay +240 HP.',
    image: '/assets/pokiguard/cards/card7.png',
    amount: 240,
  },
  DRAIN_60: {
    id: 'DRAIN_60',
    name: 'Hấp Tinh Đại Pháp',
    label: 'Hút M/Nộ',
    description: 'Hút tới 60 Mana & 40 Nộ của đối thủ chuyển sang bản thân.',
    image: '/assets/pokiguard/cards/card10.png',
    amount: 60,
  },
};

export function getSupportCardScaledAmount(cardId: SupportCardId, level = 1): number {
  const def = SUPPORT_CARDS[cardId];
  if (!def) return 0;
  const safeLv = Math.max(1, Math.min(5, level));
  const mult = 1 + (safeLv - 1) * 0.2;
  return Math.round(def.amount * mult);
}

export function getSupportCardScaledLabel(cardId: SupportCardId, level = 1): string {
  const amt = getSupportCardScaledAmount(cardId, level);
  switch (cardId) {
    case 'MANA_100':
      return `+${amt} Mana`;
    case 'RAGE_50':
      return `+${amt} Nộ`;
    case 'HP_350':
      return `+${amt} Máu`;
    case 'SHIELD_300':
      return `+${amt} Giáp`;
    case 'ATK_BUFF':
      return `+${amt}% Công`;
    case 'FREEZE_1':
      return `Băng ${amt}ST`;
    case 'PURIFY_HEAL':
      return `Giải +${amt}HP`;
    case 'DRAIN_60':
      return `Hút ${amt}M`;
  }
}

export function executeSupportCard(
  state: BattleState,
  side: Side,
  cardId: SupportCardId,
): ActionResult {
  if (state.winner) {
    return { ok: false, error: 'Trận đấu đã kết thúc.', state, events: [] };
  }
  if (state.currentTurn !== side) {
    return { ok: false, error: 'Chưa đến lượt của bạn.', state, events: [] };
  }
  const def = SUPPORT_CARDS[cardId];
  if (!def) {
    return { ok: false, error: 'Thẻ hỗ trợ không tồn tại.', state, events: [] };
  }
  const fighter = state.fighters[side];
  const defender = state.fighters[otherSide(side)];
  fighter.supportUsed ??= {};
  if (fighter.supportUsed[cardId]) {
    return { ok: false, error: `${def.name} đã được dùng trong trận này.`, state, events: [] };
  }
  if (Object.keys(fighter.supportUsed).length >= 3) {
    return { ok: false, error: 'Chỉ được dùng tối đa 3 Thẻ Hỗ Trợ mỗi trận.', state, events: [] };
  }

  const cardLv = Math.max(1, Math.min(5, fighter.supportCardLevels?.[cardId] ?? 1));
  const scaledAmount = getSupportCardScaledAmount(cardId, cardLv);
  const mult = 1 + (cardLv - 1) * 0.2;

  fighter.supportUsed[cardId] = true;
  let manaGain: number | undefined;
  let rageGain: number | undefined;
  let heal: number | undefined;
  let shieldGain: number | undefined;
  let damage: number | undefined;
  let manaDrained: number | undefined;
  let rageDrained: number | undefined;
  let appliedStatus: ActiveStatus['kind'] | undefined;

  if (cardId === 'MANA_100') {
    manaGain = Math.max(0, Math.min(fighter.maxMana - fighter.mana, scaledAmount));
    fighter.mana += manaGain;
  } else if (cardId === 'RAGE_50') {
    rageGain = Math.max(0, Math.min(fighter.maxRage - fighter.rage, scaledAmount));
    fighter.rage += rageGain;
  } else if (cardId === 'HP_350') {
    heal = Math.max(0, Math.min(fighter.maxHp - fighter.hp, scaledAmount));
    fighter.hp += heal;
  } else if (cardId === 'SHIELD_300') {
    const maxShield = Math.round(fighter.maxHp * 0.65);
    shieldGain = Math.max(0, Math.min(maxShield - fighter.shield, scaledAmount));
    fighter.shield += shieldGain;
  } else if (cardId === 'ATK_BUFF') {
    fighter.statuses.push({ kind: 'ATK_UP', value: Number((0.35 * mult).toFixed(2)), remainingTurns: 2 });
    appliedStatus = 'ATK_UP';
  } else if (cardId === 'FREEZE_1') {
    const res = applyDamage(defender, scaledAmount);
    damage = res.hpDamage + res.shieldAbsorbed;
    defender.statuses.push({ kind: 'STUN', value: 1, remainingTurns: 1 });
    appliedStatus = 'STUN';
  } else if (cardId === 'PURIFY_HEAL') {
    fighter.statuses = fighter.statuses.filter((s) => s.kind !== 'BURN' && s.kind !== 'POISON');
    heal = Math.max(0, Math.min(fighter.maxHp - fighter.hp, scaledAmount));
    fighter.hp += heal;
  } else if (cardId === 'DRAIN_60') {
    const maxManaDrain = Math.round(60 * mult);
    const maxRageDrain = Math.round(40 * mult);
    manaDrained = Math.min(maxManaDrain, defender.mana);
    rageDrained = Math.min(maxRageDrain, defender.rage);
    defender.mana -= manaDrained;
    defender.rage -= rageDrained;
    manaGain = Math.max(0, Math.min(fighter.maxMana - fighter.mana, Math.max(Math.round(40 * mult), manaDrained)));
    rageGain = Math.max(0, Math.min(fighter.maxRage - fighter.rage, Math.max(Math.round(30 * mult), rageDrained)));
    fighter.mana += manaGain;
    fighter.rage += rageGain;
  }

  const events: BattleEvent[] = [
    {
      type: 'SUPPORT_CARD_CAST',
      side,
      cardId,
      cardName: def.name,
      manaGain,
      rageGain,
      heal,
      shieldGain,
      damage,
      manaDrained,
      rageDrained,
      appliedStatus,
    },
  ];

  if (defender.hp <= 0) {
    state.winner = side;
    events.push({ type: 'BATTLE_END', winner: side, reason: 'KO' });
  }

  return {
    ok: true,
    state,
    events,
  };
}

/**
 * Thẻ Chưởng Mặc Định (160 Mana): gây sát thương phép hệ nguyên tố và kết thúc lượt
 */
export function executeDefaultCast(state: BattleState, side: Side): ActionResult {
  if (state.winner) {
    return { ok: false, error: 'Trận đấu đã kết thúc.', state, events: [] };
  }
  if (state.currentTurn !== side) {
    return { ok: false, error: 'Chưa đến lượt của bạn.', state, events: [] };
  }
  const attacker = state.fighters[side];
  const defender = state.fighters[otherSide(side)];
  if (attacker.mana < MATCH_CONSTANTS.DEFAULT_CAST_MANA_COST) {
    return { ok: false, error: `Cần ${MATCH_CONSTANTS.DEFAULT_CAST_MANA_COST} Mana để tung Thẻ Chưởng!`, state, events: [] };
  }

  attacker.mana -= MATCH_CONSTANTS.DEFAULT_CAST_MANA_COST;
  attacker.consecutivePasses = 0;

  const elemMult = getElementMultiplier(attacker.element, defender.element);
  const mitigation = 100 / (100 + defender.defense * 0.65);
  const raw = attacker.magic * 2.15 * elemMult * mitigation;
  const res = applyDamage(defender, raw);

  const events: BattleEvent[] = [
    {
      type: 'DEFAULT_CAST',
      side,
      skillName: 'Thẻ Chưởng Ngũ Hành',
      manaCost: MATCH_CONSTANTS.DEFAULT_CAST_MANA_COST,
      damage: res.hpDamage + res.shieldAbsorbed,
      shieldAbsorbed: res.shieldAbsorbed,
      elementMultiplier: elemMult,
    },
  ];

  advanceTurn(state, events, false);
  return { ok: true, state, events };
}

function spawnRandomMultipliers(
  state: BattleState,
  rng: SeededRandom,
  count: number,
  maxMult: 2 | 3 | 4 = 3,
): void {
  const candidates: Pos[] = [];
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < (state.board[r]?.length ?? 0); c++) {
      if ((state.board[r][c].multiplier ?? 1) === 1) {
        candidates.push({ row: r, col: c });
      }
    }
  }
  const targetCount = Math.min(count, candidates.length);
  for (let i = 0; i < targetCount; i++) {
    const idx = rng.nextInt(candidates.length);
    const pos = candidates.splice(idx, 1)[0];
    const roll = rng.next();
    state.board[pos.row][pos.col].multiplier =
      maxMult === 4 && roll < 0.2 ? 4 : maxMult >= 3 && roll < 0.4 ? 3 : 2;
  }
}

/** Resolves a set of board positions cleared by an authentic Pokiwar 4.0 Special Skill Card. */
function clearPositionsAndCascade(
  positions: Pos[],
  state: BattleState,
  attacker: BattleFighter,
  defender: BattleFighter,
  rng: SeededRandom,
  events: BattleEvent[],
  potencyMult: number,
  swordDouble = false,
): number {
  const seen = new Set<string>();
  const byType = new Map<GemType, { positions: Pos[]; effectiveValue: number }>();
  let totalPoints = 0;

  for (const pos of positions) {
    const row = state.board[pos.row];
    if (!row || !row[pos.col]) continue;
    const key = `${pos.row},${pos.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cell = row[pos.col];
    const mult = cell.multiplier ?? 1;
    const bucket = byType.get(cell.type) ?? { positions: [], effectiveValue: 0 };
    bucket.positions.push({ row: pos.row, col: pos.col });
    bucket.effectiveValue += mult;
    totalPoints += mult;
    byType.set(cell.type, bucket);
  }

  const syntheticGroups: MatchGroup[] = Array.from(byType.entries()).map(([gemType, data]) => ({
    positions: data.positions,
    gemType,
    length: data.positions.length,
    effectiveValue:
      swordDouble && gemType === 'SWORD' ? Math.round(data.effectiveValue * 2) : data.effectiveValue,
    isExtraTurn: false,
  }));

  if (syntheticGroups.length === 0) return 0;

  events.push({
    type: 'MATCH_CLEAR',
    cascadeIndex: 1,
    groups: syntheticGroups,
    comboMultiplier: potencyMult,
  });

  for (const grp of syntheticGroups) {
    const mult = grp.gemType === 'SWORD' ? potencyMult : Math.max(1.0, potencyMult * 0.72);
    events.push(
      computeGemEffects(state, attacker, defender, grp.gemType, grp.effectiveValue, mult, rng),
    );
  }

  const refilled = clearAndRefill(state.board, syntheticGroups, rng, state.nextGemId);
  state.board = refilled.board;
  state.nextGemId = refilled.nextGemId;
  events.push({
    type: 'BOARD_REFILL',
    drops: refilled.drops,
    boardAfter: cloneBoard(state.board),
  });

  if (defender.hp > 0 && attacker.hp > 0) {
    resolveMatchCascade(state, attacker, defender, findMatches(state.board), rng, events);
  }
  ensurePlayableBoard(state, rng, events);
  return totalPoints;
}

/** Applies authentic Pokiwar 4.0 Zing Me Special Skill Card board & deck effects. */
function applySkillBoardEffect(
  skill: SkillDef,
  state: BattleState,
  attacker: BattleFighter,
  defender: BattleFighter,
  rng: SeededRandom,
  events: BattleEvent[],
  selectedRows?: number[],
): string | undefined {
  const effect = skill.boardEffect;
  if (!effect) return undefined;

  if (effect === 'SPAWN_MULTIPLIERS') {
    spawnRandomMultipliers(state, rng, 11, 3);
    events.push({
      type: 'BOARD_REFILL',
      drops: [],
      boardAfter: cloneBoard(state.board),
    });
    return '✨ Hóa ngọc x2/x3 trên toàn bàn đấu!';
  }

  if (effect === 'FATE_CARD') {
    // Galaxy Risky (Thần Bài Vận Mệnh): Rút 1 trong 3 lá bài Đỏ / Vàng / Xanh
    const draw = rng.nextInt(3);
    if (draw === 0) {
      const rGain = Math.min(attacker.maxRage - attacker.rage, 180);
      attacker.rage += rGain;
      const bonusRes = applyDamage(defender, attacker.magic * 1.45);
      const ls = Math.min(attacker.maxHp - attacker.hp, Math.round((bonusRes.hpDamage + bonusRes.shieldAbsorbed) * 0.25));
      attacker.hp += ls;
      return `🃏 BÀI ĐỎ (+${rGain} Nộ • Hút +${ls} HP)!`;
    }
    if (draw === 1) {
      applyDamage(defender, attacker.magic * 1.05);
      defender.statuses.push({ kind: 'STUN', value: 1, remainingTurns: 1 });
      return '🃏 BÀI VÀNG (Choáng đối thủ 1 lượt)!';
    }
    const mGain = Math.min(attacker.maxMana - attacker.mana, 220);
    attacker.mana += mGain;
    applyDamage(defender, attacker.magic * 1.7);
    return `🃏 BÀI XANH (+${mGain} Mana • Sát thương cực đại)!`;
  }

  if (effect === 'SEAL_REGION') {
    // Mega Icarus (Kết Ấn) / Primal Orithyia (Băng Ngục Cổ Đại):
    // Phong ấn vùng 5x5 rực lửa -> hóa x2/x3/x4 trong vùng -> bộc hỏa nổ toàn vùng với x2 sát thương!
    const rows = state.board.length;
    const cols = state.board[0]?.length ?? 8;
    const r0 = Math.max(0, Math.min(rows - 5, 1 + rng.nextInt(Math.max(1, rows - 5))));
    const c0 = Math.max(0, Math.min(cols - 5, 1 + rng.nextInt(Math.max(1, cols - 5))));
    const positions: Pos[] = [];
    for (let r = r0; r < Math.min(rows, r0 + 5); r++) {
      for (let c = c0; c < Math.min(cols, c0 + 5); c++) {
        const roll = rng.next();
        state.board[r][c].multiplier = roll < 0.2 ? 4 : roll < 0.55 ? 3 : 2;
        positions.push({ row: r, col: c });
      }
    }
    const pts = clearPositionsAndCascade(positions, state, attacker, defender, rng, events, 2.0, true);
    if (skill.spawnMultipliersAfter) {
      spawnRandomMultipliers(state, rng, 6, 3);
      events.push({ type: 'BOARD_REFILL', drops: [], boardAfter: cloneBoard(state.board) });
    }
    return `🔥 KẾT ẤN BỘC HỎA (Ăn ${pts} điểm ngọc • x2 Sát thương)!`;
  }

  if (effect === 'CROSS_EXPLODE') {
    // Mega Fireware: Chọn 2 tâm điểm nổ 2 hình chữ thập (+) + sinh x2/x3
    const rows = state.board.length;
    const cols = state.board[0]?.length ?? 8;
    const rA = selectedRows?.[0] !== undefined ? Math.min(rows - 1, Math.max(0, selectedRows[0])) : 2;
    const rB = selectedRows?.[1] !== undefined ? Math.min(rows - 1, Math.max(0, selectedRows[1])) : 5;
    const centers: Pos[] = [
      { row: rA, col: Math.min(cols - 1, 2 + rng.nextInt(2)) },
      { row: rB, col: Math.min(cols - 1, 4 + rng.nextInt(2)) },
    ];
    const positions: Pos[] = [];
    for (const ctr of centers) {
      for (let c = 0; c < cols; c++) positions.push({ row: ctr.row, col: c });
      for (let r = 0; r < rows; r++) positions.push({ row: r, col: ctr.col });
    }
    const pts = clearPositionsAndCascade(positions, state, attacker, defender, rng, events, 1.55, true);
    spawnRandomMultipliers(state, rng, 8, 3);
    events.push({ type: 'BOARD_REFILL', drops: [], boardAfter: cloneBoard(state.board) });
    return `✚ NỔ 2 CHỮ THẬP (${pts} điểm ngọc + Sinh ngọc x2/x3)!`;
  }

  if (effect === 'BOMB_3X3') {
    // Mega Issylt: Đặt 3 bom nổ 3 vùng 3x3 + hóa ngọc x2
    const rows = state.board.length;
    const cols = state.board[0]?.length ?? 8;
    const pickedR = selectedRows && selectedRows.length > 0 ? selectedRows : [1, 4, 6];
    const centers: Pos[] = [0, 1, 2].map((i) => ({
      row: Math.min(rows - 1, Math.max(0, pickedR[i] ?? (1 + i * 2))),
      col: Math.min(cols - 1, 1 + i * 2 + rng.nextInt(2)),
    }));
    const positions: Pos[] = [];
    for (const ctr of centers) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = ctr.row + dr;
          const cc = ctr.col + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
            positions.push({ row: rr, col: cc });
          }
        }
      }
    }
    const pts = clearPositionsAndCascade(positions, state, attacker, defender, rng, events, 1.6, true);
    spawnRandomMultipliers(state, rng, 8, 2);
    events.push({ type: 'BOARD_REFILL', drops: [], boardAfter: cloneBoard(state.board) });
    return `💣 KÍCH NỔ 3 BOM 3×3 (${pts} điểm ngọc + Băng Kiếm x2)!`;
  }

  if (effect === 'CONSUME_GEMS') {
    // Mega Ahrina (Miêu Thuật - Kiếm), Galaxy Aquar (Mana+Giáp), Chess Master (Nộ+Giáp),
    // Galaxy Fairy (Mana+Hút), Galaxy Glank (Giáp), Galaxy God (Nộ+Giáp), Fantasy Joker (Đa hệ)
    const types = new Set<GemType>(skill.consumeGemTypes && skill.consumeGemTypes.length > 0 ? skill.consumeGemTypes : ['SWORD']);
    const positions: Pos[] = [];
    for (let r = 0; r < state.board.length; r++) {
      for (let c = 0; c < (state.board[r]?.length ?? 0); c++) {
        if (types.has(state.board[r][c].type)) {
          positions.push({ row: r, col: c });
        }
      }
    }
    const pts = clearPositionsAndCascade(positions, state, attacker, defender, rng, events, 1.8, true);
    // Bonus burst damage scaled directly by number of consumed gems (authentic Pokiwar 4.0 formula!)
    if (pts > 0 && defender.hp > 0) {
      const elemM = getElementMultiplier(attacker.element, defender.element);
      const bonusRaw = Math.max(attacker.attack, attacker.magic) * (0.14 * pts) * elemM;
      applyDamage(defender, bonusRaw);
    }
    if (skill.spawnMultipliersAfter) {
      spawnRandomMultipliers(state, rng, 6, 2);
      events.push({ type: 'BOARD_REFILL', drops: [], boardAfter: cloneBoard(state.board) });
    }
    return `💎 ĂN ${positions.length} VIÊN NGỌC CHỦ LỰC (${pts} điểm)!`;
  }

  // BURN_ROWS (Mega Zidarose 3 hàng, Mega Elpidios 3 hàng, Mega Hyon Tử Phiến 1 hàng)
  const targetRowCount = Math.max(1, Math.min(3, skill.burnRowCount ?? 3));
  const cleanRows = selectedRows
    ? Array.from(
        new Set(
          selectedRows.filter((r) => Number.isInteger(r) && r >= 0 && r < state.board.length),
        ),
      ).slice(0, targetRowCount)
    : [];
  let pickedRows = cleanRows;
  if (pickedRows.length === 0) {
    const rowScores = state.board.map((row, r) => {
      let score = 0;
      for (const cell of row) {
        const mult = cell.multiplier ?? 1;
        score += mult * (cell.type === 'SWORD' ? 2.5 : 1);
      }
      return { r, score };
    });
    rowScores.sort((a, b) => b.score - a.score);
    pickedRows = rowScores.slice(0, targetRowCount).map((x) => x.r);
  }

  const positions: Pos[] = [];
  for (const r of pickedRows) {
    const row = state.board[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      positions.push({ row: r, col: c });
    }
  }
  const pts = clearPositionsAndCascade(positions, state, attacker, defender, rng, events, 1.7, true);
  if (skill.spawnMultipliersAfter) {
    spawnRandomMultipliers(state, rng, 7, 3);
    events.push({ type: 'BOARD_REFILL', drops: [], boardAfter: cloneBoard(state.board) });
  }
  return `🔥 ĐỐT ${pickedRows.length} HÀNG NGANG (${pts} điểm ngọc)!`;
}

export function executeSkill(
  state: BattleState,
  side: Side,
  skillId: string,
  qteGrade?: QteGrade,
  selectedRows?: number[],
): ActionResult {
  if (state.winner) {
    return { ok: false, error: 'Trận đấu đã kết thúc.', state, events: [] };
  }
  if (state.currentTurn !== side) {
    return { ok: false, error: 'Chưa đến lượt của bạn.', state, events: [] };
  }

  const attacker = state.fighters[side];
  const defender = state.fighters[otherSide(side)];
  const skill = attacker.skills.find((s) => s.id === skillId);
  if (!skill) {
    return { ok: false, error: 'Kỹ năng không tồn tại.', state, events: [] };
  }
  if (attacker.statuses.some((s) => s.kind === 'SILENCE')) {
    return { ok: false, error: 'Đang bị Câm Lặng — không thể tung kỹ năng lượt này!', state, events: [] };
  }
  if (attacker.rage < skill.rageCost) {
    return { ok: false, error: 'Chưa đủ Nộ để tung chiêu.', state, events: [] };
  }
  const manaReq = skill.manaCost ?? 0;
  if (attacker.mana < manaReq) {
    return { ok: false, error: `Cần thêm Mana (${manaReq}) để tung chiêu.`, state, events: [] };
  }
  if ((attacker.cooldowns[skill.id] ?? 0) > 0) {
    return { ok: false, error: 'Kỹ năng đang hồi chiêu.', state, events: [] };
  }

  attacker.rage -= skill.rageCost;
  attacker.mana -= manaReq;
  attacker.cooldowns[skill.id] = skill.cooldown + 1;
  attacker.consecutivePasses = 0;

  const qteMult = skill.needPerfection
    ? qteGrade === 'PERFECT'
      ? 1.5
      : qteGrade === 'GOOD'
        ? 1.15
        : 0.8
    : 1.0;

  const events: BattleEvent[] = [];
  let damage: number | undefined;
  let shieldAbsorbed: number | undefined;
  let elemMult: number | undefined;

  if (skill.cleanseDebuffs) {
    attacker.statuses = attacker.statuses.filter((s) => s.kind !== 'BURN' && s.kind !== 'POISON');
  }

  let heal = 0;

  if (skill.damageKind !== 'NONE' && skill.powerRatio > 0) {
    const stat =
      skill.damageKind === 'PHYSICAL'
        ? getEffectiveAttack(attacker, state.fieldElement)
        : getEffectiveMagic(attacker, state.fieldElement);
    elemMult = getElementMultiplier(attacker.element, defender.element);
    const passivePierce = attacker.passiveSkill?.kind === 'XUYEN_GIAP' ? attacker.passiveSkill.value || 0.35 : 0;
    const totalPierce = Math.min(0.85, (skill.armorPierceRatio ?? 0) + passivePierce);
    const mitigation = 100 / (100 + defender.defense * (1 - totalPierce) * 0.65);
    const raw = stat * skill.powerRatio * qteMult * elemMult * mitigation;
    const res = applyDamage(defender, raw);
    damage = res.hpDamage + res.shieldAbsorbed;
    shieldAbsorbed = res.shieldAbsorbed;

    // Galaxy Aquar (Kết Ấn Tinh Thể): Execute bonus damage when target HP <= threshold
    if (
      skill.executeThresholdPercent &&
      defender.hp > 0 &&
      defender.hp / Math.max(1, defender.maxHp) <= skill.executeThresholdPercent
    ) {
      const execRaw = Math.round(defender.maxHp * 0.22);
      const execRes = applyDamage(defender, execRaw);
      damage += execRes.hpDamage + execRes.shieldAbsorbed;
      shieldAbsorbed += execRes.shieldAbsorbed;
    }

    if (skill.lifestealRatio && skill.lifestealRatio > 0 && damage > 0) {
      const ls = Math.min(attacker.maxHp - attacker.hp, Math.round(damage * skill.lifestealRatio));
      if (ls > 0) {
        attacker.hp += ls;
        heal += ls;
      }
    }
  }

  if (skill.manaRefund && skill.manaRefund > 0) {
    attacker.mana = Math.min(attacker.maxMana, attacker.mana + skill.manaRefund);
  }

  const rng = new SeededRandom(state.rngState ^ state.turnNumber);

  if (skill.maxHpBoostPercent && skill.maxHpBoostPercent > 0) {
    const hpBoost = Math.round(attacker.maxHp * skill.maxHpBoostPercent);
    attacker.maxHp += hpBoost;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + hpBoost);
  }

  if (skill.healPercentMaxHp && skill.healPercentMaxHp > 0) {
    const rawHeal = Math.round(attacker.maxHp * skill.healPercentMaxHp * qteMult);
    const actualH = Math.min(attacker.maxHp - attacker.hp, rawHeal);
    attacker.hp += actualH;
    heal += actualH;
  }
  const totalHeal: number | undefined = heal > 0 ? heal : undefined;

  let shieldGain: number | undefined;
  if (skill.shieldAmount && skill.shieldAmount > 0) {
    const maxShield = Math.round(attacker.maxHp * 0.65);
    shieldGain = Math.max(0, Math.min(maxShield - attacker.shield, Math.round(skill.shieldAmount * qteMult)));
    attacker.shield += shieldGain;
  }

  if (qteGrade === 'PERFECT' && skill.needPerfection) {
    state.bonusGold[side] += 50;
  }

  let appliedStatus: ActiveStatus['kind'] | undefined;
  if (skill.statusEffect) {
    const chance = skill.statusChance ?? 1;
    if (chance >= 1 || rng.next() < chance) {
      const targetFighter =
        skill.statusEffect.kind === 'ATK_UP' || skill.statusEffect.kind === 'SHIELD_REGEN'
          ? attacker
          : defender;
      targetFighter.statuses.push({
        kind: skill.statusEffect.kind,
        value: skill.statusEffect.value,
        remainingTurns: skill.statusEffect.durationTurns,
      });
      appliedStatus = skill.statusEffect.kind;
    }
  }

  let specialNote: string | undefined;
  if (skill.boardEffect && defender.hp > 0 && attacker.hp > 0) {
    specialNote = applySkillBoardEffect(skill, state, attacker, defender, rng, events, selectedRows);
  }
  state.rngState = rng.getState();

  events.push({
    type: 'SKILL_CAST',
    side,
    skillId: skill.id,
    skillName: skill.name,
    damage,
    shieldAbsorbed,
    heal: totalHeal,
    shieldGain,
    elementMultiplier: elemMult,
    appliedStatus,
    qteGrade: skill.needPerfection ? qteGrade : undefined,
    specialNote,
  });

  advanceTurn(state, events, false);
  return { ok: true, state, events };
}

export function passTurn(state: BattleState, side: Side): ActionResult {
  if (state.winner || state.currentTurn !== side) {
    return { ok: false, error: 'Không thể bỏ lượt lúc này.', state, events: [] };
  }
  const fighter = state.fighters[side];
  fighter.consecutivePasses += 1;

  if (fighter.consecutivePasses > MATCH_CONSTANTS.MAX_CONSECUTIVE_PASSES) {
    const winner = otherSide(side);
    state.winner = winner;
    return {
      ok: true,
      state,
      events: [
        {
          type: 'PASS_TURN',
          side,
          consecutivePasses: fighter.consecutivePasses,
          autoLost: true,
        },
        { type: 'BATTLE_END', winner, reason: 'PASS_LIMIT' },
      ],
    };
  }

  const events: BattleEvent[] = [
    {
      type: 'PASS_TURN',
      side,
      consecutivePasses: fighter.consecutivePasses,
    },
  ];
  advanceTurn(state, events, false);
  return { ok: true, state, events };
}

/**
 * Pokiwar 4.0 Thẻ Bài Hợp Thể (Pet Hợp Thể Combined Strike — 1x per battle):
 * Unleashes a combined Pet Chiến + Pet Hợp Thể strike, inflicts Vết Thương Sâu (2 turns), heals & shields!
 */
export function executeFusionStrike(state: BattleState, side: Side): ActionResult {
  if (state.winner) {
    return { ok: false, error: 'Trận đấu đã kết thúc.', state, events: [] };
  }
  if (state.currentTurn !== side) {
    return { ok: false, error: 'Chưa đến lượt của bạn.', state, events: [] };
  }
  if (state.restrictedRules) {
    return { ok: false, error: 'Luật Đảo Châu Báu cấm dùng Thẻ Bài Hợp Thể!', state, events: [] };
  }
  const attacker = state.fighters[side];
  const defender = state.fighters[otherSide(side)];
  if (!attacker.fusionPetId || !attacker.fusionPetName) {
    return { ok: false, error: 'Chưa trang bị Pet Hợp Thể trong Nhà Pet!', state, events: [] };
  }
  if (attacker.fusionStrikeUsed) {
    return { ok: false, error: 'Đã dùng Thẻ Bài Hợp Thể trong trận này rồi!', state, events: [] };
  }
  if (attacker.rage < 50 || attacker.mana < 60) {
    return { ok: false, error: 'Cần 50 Nộ & 60 Mana để kích hoạt Hợp Thể Liên Kích!', state, events: [] };
  }

  attacker.rage -= 50;
  attacker.mana -= 60;
  attacker.fusionStrikeUsed = true;
  attacker.consecutivePasses = 0;

  const elemMult = getElementMultiplier(attacker.element, defender.element);
  const combinedStat =
    (getEffectiveAttack(attacker, state.fieldElement) + getEffectiveMagic(attacker, state.fieldElement)) * 0.78;
  const mitigation = 100 / (100 + defender.defense * 0.55);
  const raw = combinedStat * 1.95 * elemMult * mitigation;
  const { hpDamage, shieldAbsorbed } = applyDamage(defender, raw);
  const damage = hpDamage + shieldAbsorbed;

  const heal = Math.min(attacker.maxHp - attacker.hp, Math.round(attacker.maxHp * 0.14));
  attacker.hp += heal;
  const maxShield = Math.round(attacker.maxHp * 0.65);
  const shieldGain = Math.max(0, Math.min(maxShield - attacker.shield, Math.round(attacker.maxHp * 0.16)));
  attacker.shield += shieldGain;

  defender.statuses.push({ kind: 'DEEP_WOUND', value: 0.06, remainingTurns: 2 });

  const events: BattleEvent[] = [
    {
      type: 'FUSION_STRIKE',
      side,
      partnerName: attacker.fusionPetName,
      damage,
      shieldAbsorbed,
      heal,
      shieldGain,
      elementMultiplier: elemMult,
    },
  ];
  advanceTurn(state, events, false);
  return { ok: true, state, events };
}

export type BotDecision =
  | { kind: 'EVOLVE' }
  | { kind: 'DEFAULT_CAST' }
  | { kind: 'SKILL'; skillId: string; qteGrade?: QteGrade }
  | { kind: 'SWAP'; from: Pos; to: Pos }
  | { kind: 'PASS' };

export function chooseBotDecision(state: BattleState, difficulty: BotDifficulty): BotDecision {
  const side = state.currentTurn;
  const bot = state.fighters[side];
  const player = state.fighters[otherSide(side)];

  if (difficulty !== 'EASY') {
    const readySkills = bot.skills.filter(
      (s) =>
        bot.rage >= s.rageCost &&
        bot.mana >= (s.manaCost ?? 0) &&
        (bot.cooldowns[s.id] ?? 0) === 0,
    );
    if (readySkills.length > 0) {
      const healSkill = readySkills.find(
        (s) => (s.healPercentMaxHp ?? 0) > 0 && bot.hp < bot.maxHp * 0.55,
      );
      if (healSkill) {
        return { kind: 'SKILL', skillId: healSkill.id, qteGrade: difficulty === 'HARD' ? 'PERFECT' : 'GOOD' };
      }
      const damageSkill = readySkills
        .filter((s) => s.powerRatio > 0)
        .sort((a, b) => b.powerRatio - a.powerRatio)[0];
      if (
        damageSkill &&
        (difficulty === 'HARD' || player.hp < player.maxHp * 0.65 || bot.rage >= bot.maxRage * 0.65)
      ) {
        return {
          kind: 'SKILL',
          skillId: damageSkill.id,
          qteGrade: difficulty === 'HARD' ? 'GOOD' : 'BAD',
        };
      }
    }

    if (bot.mana >= MATCH_CONSTANTS.DEFAULT_CAST_MANA_COST && player.hp <= bot.magic * 2.5) {
      return { kind: 'DEFAULT_CAST' };
    }
  }

  const moves = findValidMoves(state.board);
  if (moves.length === 0) return { kind: 'PASS' };

  if (difficulty === 'EASY') {
    const rng = new SeededRandom(state.rngState ^ state.turnNumber);
    const chosen = rng.pick(moves);
    return { kind: 'SWAP', from: chosen.from, to: chosen.to };
  }

  let bestScore = -1;
  let bestMove = moves[0];

  for (const move of moves) {
    const test = cloneBoard(state.board);
    swapCellsInPlace(test, move.from, move.to);
    const groups = findMatches(test);
    let score = 0;

    for (const g of groups) {
      score += g.effectiveValue * 10;
      if (g.isExtraTurn) score += difficulty === 'HARD' ? 45 : 25;
      if (g.gemType === 'SWORD') score += 18;
      if (g.gemType === 'FIRE' && bot.rage < bot.maxRage) score += 15;
      if (g.gemType === 'LIGHTNING' && bot.mana < bot.maxMana) score += 14;
      if (g.gemType === 'HEART' && bot.hp < bot.maxHp * 0.65) score += 24;
      if (g.gemType === 'COIN' && bot.shield < bot.maxHp * 0.25) score += 13;
      if (g.gemType === 'YINYANG' && (bot.accumStacks ?? 0) < 14) score += 12;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return { kind: 'SWAP', from: bestMove.from, to: bestMove.to };
}
