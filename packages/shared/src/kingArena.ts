import { getElementMultiplier } from './elements.js';
import { SeededRandom } from './prng.js';
import type {
  KingArenaAction,
  KingArenaResult,
  KingArenaUnitInput,
  KingArenaUnitState,
  Side,
} from './types.js';

function makeUnitState(side: Side, inp: KingArenaUnitInput): KingArenaUnitState {
  const safeLv = Math.max(1, Math.min(15, inp.level));
  const safeStars = Math.max(1, Math.min(6, inp.stars));
  const safeGen = Math.max(0, Math.min(5, inp.genLevel));

  const lvMult = 1 + (safeLv - 1) * 0.065;
  const starMult = 1 + (safeStars - 1) * 0.08;
  const genMult = 1 + safeGen * 0.06;
  const mult = lvMult * starMult * genMult;

  const maxHp = Math.round(inp.pet.maxHp * mult * 1.45);
  const attack = Math.round(inp.pet.attack * mult);
  const magic = Math.round(inp.pet.magic * mult);
  const defense = Math.round(inp.pet.defense * mult);
  const speed = Math.round(inp.pet.speed + (safeLv - 1) * 2 + (safeStars - 1) * 4 + safeGen * 3);

  const passive = inp.pet.passiveSkill;
  let reviveCharges = 0;
  if (passive?.kind === 'HOI_SINH') {
    reviveCharges += Math.max(1, Math.round(passive.value));
  }
  if (safeGen >= 3 || inp.pet.tier === 'TITAN' || inp.pet.tier === 'ANCIENT') {
    reviveCharges = Math.max(reviveCharges, safeGen >= 5 ? 2 : 1);
  }
  const initShield = passive?.kind === 'HO_GIAP' ? Math.round(maxHp * (passive.value || 0.25)) : 0;

  return {
    id: `${side}-${inp.slot}`,
    side,
    slot: inp.slot,
    petId: inp.pet.id,
    spriteId: inp.pet.spriteId,
    name: inp.pet.name,
    element: inp.pet.element,
    tier: inp.pet.tier,
    level: safeLv,
    stars: safeStars,
    hp: maxHp,
    maxHp,
    shield: initShield,
    rage: 25,
    attack,
    magic,
    defense,
    speed,
    reviveCharges,
    passiveSkill: passive,
    alive: true,
  };
}

function captureSnapshot(units: KingArenaUnitState[]): KingArenaAction['snapshot'] {
  const snap: KingArenaAction['snapshot'] = {};
  for (const u of units) {
    snap[u.id] = {
      hp: u.hp,
      maxHp: u.maxHp,
      shield: u.shield,
      rage: u.rage,
      alive: u.alive,
      reviveCharges: u.reviveCharges,
    };
  }
  return snap;
}

/**
 * Chuẩn Pokiwar 4.0 Zing Me - Đấu Trường Bá Vương (5v5) & Chiến Bang (3v3):
 * - Trận hình 2 Tiền Tuyến (slot 0, 1) + 3 Hậu Tuyến (slot 2, 3, 4).
 * - Thứ tự ưu tiên mục tiêu: Tiền tuyến trước (slot nhỏ -> lớn), hết tiền tuyến mới đánh hậu tuyến.
 * - Kích hoạt Nội tại (Cuồng Huyết, Hồi Sinh, Phản Đòn, Xuyên Giáp, Hấp Huyết, Hộ Giáp, Cuồng Nộ) & Tuyệt kỹ 100 Nộ!
 */
export function simulateKingArenaBattle(
  playerTeam: KingArenaUnitInput[],
  enemyTeam: KingArenaUnitInput[],
  seed = Date.now(),
): KingArenaResult {
  const rng = new SeededRandom(seed);
  const p1Units = playerTeam.slice(0, 5).map((u) => makeUnitState('P1', u));
  const p2Units = enemyTeam.slice(0, 5).map((u) => makeUnitState('P2', u));
  const allUnits = [...p1Units, ...p2Units];
  const initialUnits = allUnits.map((u) => ({ ...u }));

  const actions: KingArenaAction[] = [];
  let step = 0;
  let round = 1;
  const maxRounds = 18;

  const aliveOf = (side: Side) =>
    allUnits.filter((u) => u.side === side && u.alive).sort((a, b) => a.slot - b.slot);

  const pickTargets = (enemySide: Side, count: number): KingArenaUnitState[] => {
    const alive = aliveOf(enemySide);
    if (alive.length === 0) return [];
    const front = alive.filter((u) => u.slot <= 1);
    const back = alive.filter((u) => u.slot >= 2);
    const ordered = [...front, ...back];
    return ordered.slice(0, Math.min(count, ordered.length));
  };

  while (round <= maxRounds && aliveOf('P1').length > 0 && aliveOf('P2').length > 0) {
    // Speed order each round (P1 wins speed ties slightly)
    const turnOrder = allUnits
      .filter((u) => u.alive)
      .sort((a, b) => b.speed - a.speed || (a.side === 'P1' ? -1 : 1) || a.slot - b.slot);

    for (const actor of turnOrder) {
      if (!actor.alive) continue;
      const enemySide: Side = actor.side === 'P1' ? 'P2' : 'P1';
      if (aliveOf(enemySide).length === 0) break;

      const isUltimate = actor.rage >= 100;
      const targetCount = isUltimate ? 2 : 1;
      const targets = pickTargets(enemySide, targetCount);
      if (targets.length === 0) break;

      const skillName = isUltimate
        ? `Tuyệt Kỹ ${actor.name}`
        : `Đòn Đánh ${actor.name}`;

      // Passive: Cuồng Huyết (+5% ATK per 10% missing HP)
      let cuongHuyetMult = 1;
      if (actor.passiveSkill?.kind === 'CUONG_HUYET') {
        const missingPct = Math.max(0, 1 - actor.hp / actor.maxHp);
        cuongHuyetMult = 1 + Math.floor(missingPct * 10) * (actor.passiveSkill.value || 0.05);
      }

      // Passive: Xuyên Giáp
      const pierceRatio = actor.passiveSkill?.kind === 'XUYEN_GIAP' ? actor.passiveSkill.value || 0.4 : 0;

      const baseOffense = Math.max(actor.attack, actor.magic) * cuongHuyetMult;
      const powerMult = isUltimate ? 1.85 : 1.05;

      const damages: Record<string, number> = {};
      const heals: Record<string, number> = {};
      const revivedIds: string[] = [];
      let totalDealt = 0;
      let totalReflected = 0;

      for (const target of targets) {
        const elemMult = getElementMultiplier(actor.element, target.element);
        const effDef = target.defense * (1 - pierceRatio);
        const mitigation = 100 / (100 + effDef * 0.65);
        const crit = rng.next() < (isUltimate ? 0.28 : 0.14) ? 1.45 : 1.0;
        const spread = 0.94 + rng.next() * 0.12;
        const rawDmg = Math.max(
          25,
          Math.round(baseOffense * powerMult * elemMult * mitigation * crit * spread),
        );

        let rem = rawDmg;
        if (target.shield > 0) {
          const abs = Math.min(target.shield, rem);
          target.shield -= abs;
          rem -= abs;
        }
        const hpDmg = Math.min(target.hp, rem);
        target.hp -= hpDmg;
        damages[target.id] = rawDmg;
        totalDealt += rawDmg;

        // Target gains rage on hit
        target.rage = Math.min(100, target.rage + 22);

        // Target Passive: Phản Đòn
        if (target.passiveSkill?.kind === 'PHAN_DON' && actor.alive) {
          const refDmg = Math.max(10, Math.round(rawDmg * (target.passiveSkill.value || 0.2)));
          actor.hp = Math.max(1, actor.hp - refDmg);
          totalReflected += refDmg;
        }

        // Check Target KO / Revival Heart (Hồi Sinh)
        if (target.hp <= 0) {
          if (target.reviveCharges > 0) {
            target.reviveCharges -= 1;
            target.hp = Math.round(target.maxHp * 0.42);
            target.shield += Math.round(target.maxHp * 0.15);
            target.alive = true;
            revivedIds.push(target.id);
          } else {
            target.hp = 0;
            target.alive = false;
          }
        }
      }

      // Passive: Hấp Huyết
      if (actor.passiveSkill?.kind === 'HAP_HUYET' && totalDealt > 0) {
        const healAmt = Math.min(
          actor.maxHp - actor.hp,
          Math.round(totalDealt * (actor.passiveSkill.value || 0.25)),
        );
        if (healAmt > 0) {
          actor.hp += healAmt;
          heals[actor.id] = healAmt;
        }
      }

      // Rage update
      if (isUltimate) {
        actor.rage = 0;
      } else {
        const rageGain = actor.passiveSkill?.kind === 'CUONG_NO' ? 60 : 38;
        actor.rage = Math.min(100, actor.rage + rageGain);
      }

      step += 1;
      const targetNames = targets.map((t) => t.name).join(' & ');
      let summary = `[Hiệp ${round}] ${actor.name} tung ${skillName} vào ${targetNames} (-${totalDealt} HP)`;
      if (revivedIds.length > 0) {
        summary += ` • ❤️ Hồi Sinh kích hoạt!`;
      }
      if (totalReflected > 0) {
        summary += ` • 🛡️ Phản đòn -${totalReflected}`;
      }

      actions.push({
        step,
        round,
        actorId: actor.id,
        actorSide: actor.side,
        actorName: actor.name,
        targetIds: targets.map((t) => t.id),
        skillName,
        isUltimate,
        damages,
        heals: Object.keys(heals).length > 0 ? heals : undefined,
        reflected: totalReflected > 0 ? totalReflected : undefined,
        revivedIds: revivedIds.length > 0 ? revivedIds : undefined,
        summary,
        snapshot: captureSnapshot(allUnits),
      });
    }

    round += 1;
  }

  const p1Left = aliveOf('P1');
  const p2Left = aliveOf('P2');
  let winner: Side = 'P1';
  if (p1Left.length === 0) {
    winner = 'P2';
  } else if (p2Left.length === 0) {
    winner = 'P1';
  } else {
    const p1HpPct = p1Left.reduce((s, u) => s + u.hp / u.maxHp, 0);
    const p2HpPct = p2Left.reduce((s, u) => s + u.hp / u.maxHp, 0);
    winner = p1HpPct >= p2HpPct ? 'P1' : 'P2';
  }

  return {
    winner,
    rounds: Math.min(round - 1, maxRounds),
    initialUnits,
    actions,
    playerSurvivors: p1Left.length,
    enemySurvivors: p2Left.length,
  };
}
