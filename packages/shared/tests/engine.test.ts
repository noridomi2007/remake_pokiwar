import { describe, expect, it } from 'vitest';
import {
  applyPetProgression,
  calcMultiStoneUpgradeRate,
  chooseBotDecision,
  clearAndRefill,
  computeAuraTotalBonuses,
  computeEquipmentBonuses,
  createBattleState,
  createBoard,
  DUNGEON_ISLANDS,
  executeDefaultCast,
  executeInBattleEvolve,
  executeSkill,
  executeSupportCard,
  executeSwap,
  findMatches,
  findValidMoves,
  getElementMultiplier,
  getPetById,
  getPetSpritePath,
  passTurn,
  PET_AURAS,
  PVE_STAGES,
  SeededRandom,
  simulateKingArenaBattle,
  STARTER_PETS,
  SUPPORT_CARDS,
} from '../src/index.js';
import type { BoardGrid, GemType } from '../src/index.js';

function makeGrid(rows: GemType[][]): BoardGrid {
  let id = 1;
  return rows.map((r) => r.map((type) => ({ id: id++, type, multiplier: 1 })));
}

describe('Ngũ Hành Elemental Multiplier', () => {
  it('applies +50% (1.5x) on elemental advantage and -25% (0.75x) on disadvantage', () => {
    expect(getElementMultiplier('KIM', 'MOC')).toBe(1.5);
    expect(getElementMultiplier('MOC', 'KIM')).toBe(0.75);
    expect(getElementMultiplier('THUY', 'HOA')).toBe(1.5);
    expect(getElementMultiplier('KIM', 'THUY')).toBe(1.0);
  });
});

describe('Match-3 Board Engine (6 Pokiwar Gems)', () => {
  it('creates an 8x8 board with zero initial matches and at least one valid move', () => {
    const rng = new SeededRandom(123456);
    const { board } = createBoard(8, 8, rng);
    expect(board).toHaveLength(8);
    expect(board[0]).toHaveLength(8);
    expect(findMatches(board)).toHaveLength(0);
    expect(findValidMoves(board).length).toBeGreaterThan(0);
  });

  it('merges overlapping horizontal and vertical runs into an L/T match granting extra turn', () => {
    const grid = makeGrid([
      ['SWORD', 'SWORD', 'SWORD', 'HEART'],
      ['SWORD', 'FIRE', 'YINYANG', 'LIGHTNING'],
      ['SWORD', 'LIGHTNING', 'HEART', 'COIN'],
      ['YINYANG', 'HEART', 'FIRE', 'LIGHTNING'],
    ]);
    const matches = findMatches(grid);
    expect(matches).toHaveLength(1);
    expect(matches[0].gemType).toBe('SWORD');
    expect(matches[0].length).toBe(5);
    expect(matches[0].isExtraTurn).toBe(true);
  });

  it('clears matched gems, applies gravity, and refills board without empty cells', () => {
    const grid = makeGrid([
      ['HEART', 'LIGHTNING', 'YINYANG', 'FIRE'],
      ['SWORD', 'SWORD', 'SWORD', 'HEART'],
      ['FIRE', 'YINYANG', 'COIN', 'SWORD'],
      ['YINYANG', 'HEART', 'FIRE', 'LIGHTNING'],
    ]);
    const matches = findMatches(grid);
    const rng = new SeededRandom(42);
    const { board, drops } = clearAndRefill(grid, matches, rng, 100);
    expect(drops.length).toBeGreaterThan(0);
    for (const row of board) {
      for (const cell of row) {
        expect(cell).toBeDefined();
        expect(cell.id).toBeGreaterThan(0);
      }
    }
  });
});

describe('Combat Engine, Progression & Bot AI', () => {
  it('scales pet stats properly with level & evolution', () => {
    const base = STARTER_PETS[0];
    const lv5 = applyPetProgression(base, 5, 'MECH');
    expect(lv5.maxHp).toBeGreaterThan(base.maxHp);
    expect(lv5.attack).toBeGreaterThan(base.attack);
  });

  it('executes a valid swap deterministically and updates turn/HP/rage', () => {
    const p1 = STARTER_PETS[0]; // speed 120
    const p2 = STARTER_PETS[3]; // speed 105 -> P1 moves first
    const state = createBattleState(p1, p2, 9999);
    expect(state.currentTurn).toBe('P1');

    const validMoves = findValidMoves(state.board);
    const move = validMoves[0];
    const res = executeSwap(state, 'P1', move.from, move.to);
    expect(res.ok).toBe(true);
    expect(res.events[0]).toMatchObject({ type: 'SWAP', side: 'P1' });
    expect(res.events.some((e) => e.type === 'MATCH_CLEAR')).toBe(true);
  });

  it('allows casting a Special Skill Card on Special Pets (Mega/Galaxy/Fantasy) while Regular Pets have no custom skills', () => {
    // Authentic Pokiwar Zing Me rule: Regular pets (BASE / S) have 0 custom skills
    expect(getPetById('pet-581').skills).toHaveLength(0);
    expect(getPetById('pet-583').skills).toHaveLength(0);

    const state = createBattleState(getPetById('pet-mega-zidarose'), getPetById('pet-mega-elpidios'), 555);
    const side = state.currentTurn;
    const fighter = state.fighters[side];
    const enemy = state.fighters[side === 'P1' ? 'P2' : 'P1'];
    const initialEnemyHp = enemy.hp;

    fighter.rage = 250;
    fighter.mana = 250;
    expect(fighter.skills).toHaveLength(1);
    const res = executeSkill(state, side, fighter.skills[0].id, 'PERFECT');

    expect(res.ok).toBe(true);
    expect(enemy.hp).toBeLessThan(initialEnemyHp);
    expect(res.events.some((e) => e.type === 'SKILL_CAST')).toBe(true);
  });

  it('supports PokiGuard 120-Mana Free In-Battle Evolve, 160-Mana Cast, QTE Ultimate & 3-PASS forfeit', () => {
    const state = createBattleState(STARTER_PETS[0], STARTER_PETS[2], 777);
    const side = state.currentTurn;
    const fighter = state.fighters[side];
    const enemy = state.fighters[side === 'P1' ? 'P2' : 'P1'];

    fighter.mana = 300;
    const hpBefore = fighter.maxHp;

    // Turn 1 cannot use In-Battle Evolve (Pokiwar/PokiGuard rule: must play at least 1 board turn first)
    const evoTurn1 = executeInBattleEvolve(state, side);
    expect(evoTurn1.ok).toBe(false);

    state.turnNumber = 2;
    const evoRes = executeInBattleEvolve(state, side);
    expect(evoRes.ok).toBe(true);
    expect(state.currentTurn).toBe(side); // Free action: does NOT consume turn
    expect(fighter.inBattleEvolved).toBe(true);
    expect(fighter.maxHp).toBeGreaterThan(hpBefore);
    expect(fighter.mana).toBeGreaterThanOrEqual(160);

    // 3 Support Cards (+100 Mana, +50 Nộ, +350 HP) — Free Action once per match
    fighter.hp = Math.max(100, fighter.hp - 400);
    const supHp = executeSupportCard(state, side, 'HP_350');
    const supRage = executeSupportCard(state, side, 'RAGE_50');
    const supMana = executeSupportCard(state, side, 'MANA_100');
    expect(supHp.ok && supRage.ok && supMana.ok).toBe(true);
    expect(executeSupportCard(state, side, 'HP_350').ok).toBe(false);
    expect(state.currentTurn).toBe(side);

    const castRes = executeDefaultCast(state, side);
    expect(castRes.ok).toBe(true);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    expect(state.currentTurn).not.toBe(side);

    // Ultimate skill QTE multiplier check (using Mega Elpidios Special Skill Card against tanky target)
    const sA = createBattleState(getPetById('pet-mega-elpidios'), getPetById('pet-mega-icarus'), 888, 3);
    const sB = createBattleState(getPetById('pet-mega-elpidios'), getPetById('pet-mega-icarus'), 888, 3);
    const sideA = sA.currentTurn;
    const defSide = sideA === 'P1' ? 'P2' : 'P1';
    sA.fighters[defSide].maxHp = 50000;
    sA.fighters[defSide].hp = 50000;
    sB.fighters[defSide].maxHp = 50000;
    sB.fighters[defSide].hp = 50000;
    const ult = sA.fighters[sideA].skills[0];
    sA.fighters[sideA].rage = 250;
    sA.fighters[sideA].mana = 250;
    sB.fighters[sideA].rage = 250;
    sB.fighters[sideA].mana = 250;

    const perfRes = executeSkill(sA, sideA, ult.id, 'PERFECT');
    const badRes = executeSkill(sB, sideA, ult.id, 'BAD');
    expect(perfRes.ok && badRes.ok).toBe(true);
    expect(sA.fighters[sideA === 'P1' ? 'P2' : 'P1'].hp).toBeLessThan(
      sB.fighters[sideA === 'P1' ? 'P2' : 'P1'].hp,
    );

    // 3rd consecutive PASS forfeits the match
    const passState = createBattleState(STARTER_PETS[0], STARTER_PETS[2], 123);
    const pSide = passState.currentTurn;
    passTurn(passState, pSide);
    passState.currentTurn = pSide;
    passTurn(passState, pSide);
    passState.currentTurn = pSide;
    const finalPass = passTurn(passState, pSide);
    expect(finalPass.ok).toBe(true);
    expect(passState.winner).toBe(pSide === 'P1' ? 'P2' : 'P1');
  });

  it('chooses a valid bot decision across difficulty levels', () => {
    const state = createBattleState(STARTER_PETS[0], STARTER_PETS[2], 321);
    for (const diff of ['EASY', 'NORMAL', 'HARD'] as const) {
      const decision = chooseBotDecision(state, diff);
      expect(decision.kind === 'SWAP' || decision.kind === 'SKILL').toBe(true);
    }
  });

  it('keeps each of the 70 authentic Pokiwar 4.0 pets as a standalone Pet with 1 fixed sprite and supports Synthesis Recipes, Star rating (1★..6★) & Gen T2 (0..5)', () => {
    expect(STARTER_PETS.length).toBe(70);
    expect(DUNGEON_ISLANDS).toHaveLength(6);
    expect(PVE_STAGES).toHaveLength(53);
    // Ensure fabricated / wrong-art pets were purged cleanly
    expect(STARTER_PETS.some((p) => p.id.startsWith('pet-titan-') || p.id === 'pet-fantasy-naruto' || p.id === 'pet-fantasy-yugi')).toBe(false);
    const lion = getPetById('pet-583');
    const babyLion = getPetById('pet-581');
    expect(lion.id).toBe('pet-583');
    expect(babyLion.id).toBe('pet-581');
    expect(babyLion.name).toBe('Tiểu Hỏa Sư');
    expect(getPetSpritePath(lion, 'BASE')).toBe('/assets/pokiguard/pets/583.png');
    expect(getPetSpritePath(lion, 'S')).toBe('/assets/pokiguard/pets/583.png');
    expect(getPetSpritePath(lion, 'MEGA')).toBe('/assets/pokiguard/pets/583.png');

    // Star progression (1★ -> 6★) & Gen T2 (0 -> 5) scale stats without changing spriteId or tier
    const star1 = applyPetProgression(lion, 10, undefined, 1, 0);
    const star6 = applyPetProgression(lion, 10, undefined, 6, 0);
    const star6Gen5 = applyPetProgression(lion, 10, undefined, 6, 5);
    expect(star6.maxHp).toBeGreaterThan(star1.maxHp);
    expect(star6.attack).toBeGreaterThan(star1.attack);
    expect(star6Gen5.maxHp).toBeGreaterThan(star6.maxHp);
    expect(star6Gen5.speed).toBeGreaterThan(star6.speed);
    expect(star6Gen5.spriteId).toBe(lion.spriteId);

    // Synthesis recipe check
    const zida = getPetById('pet-mega-zidarose');
    expect(zida.synthesisRecipe?.requiredPetId).toBe('pet-583');

    // Iconic Pokiwar 4.0 authentic roster check (Special Pets keep ONLY their authentic Special Skill Card)
    expect(getPetById('pet-mega-hyon').skills[0].name).toBe('Tử Phiến');
    expect(getPetById('pet-mega-icarus').skills[0].name).toBe('Kết Ấn');
    expect(getPetById('pet-mega-ahrina').skills[0].name).toBe('Miêu Thuật');
    expect(getPetById('pet-fantasy-joker').skills[0].name).toContain('Crazy');
    expect(getPetById('pet-boss-humex').name).toBe('Boss Humex');
    expect(getPetById('pet-boss-spetra').name).toBe('Boss Spetra');
  });

  it('reconstructs Mega Zidarose, Mega Elpidios, Mega Twin Flame, and Mega Icarus with authentic Zing Me sprites & Special Skill Cards', () => {
    const zida = getPetById('pet-mega-zidarose');
    const elpi = getPetById('pet-mega-elpidios');
    const twin = getPetById('pet-mega-twinflame');
    const icarus = getPetById('pet-mega-icarus');

    expect(zida.name).toBe('Mega Zidarose');
    expect(zida.skills).toHaveLength(1);
    expect(zida.skills[0].name).toBe('Phong Hỏa');
    expect(zida.skills[0].manaCost).toBe(200);
    expect(zida.skills[0].rageCost).toBe(0);
    expect(zida.skills[0].isSpecialCard).toBe(true);
    expect(zida.spriteId).toBe('pw_mega_zidarose');
    expect(elpi.spriteId).toBe('pw_mega_elpidios');
    expect(twin.spriteId).toBe('pw_mega_twinflame');
    expect(icarus.spriteId).toBe('pw_mega_icarus');
    expect(icarus.skills[0].name).toBe('Kết Ấn');
    expect(icarus.skills[0].manaCost).toBe(200);
    expect(icarus.skills[0].rageCost).toBe(100);
    expect(icarus.skills[0].boardEffect).toBe('SEAL_REGION');

    // Mega Zidarose Phong Hỏa burns player-picked 3 rows + cascades cleanly
    const sZida = createBattleState(zida, elpi, 901);
    const zSide = sZida.currentTurn;
    sZida.fighters[zSide].mana = 250;
    sZida.fighters[zSide].rage = 200;
    const zRes = executeSkill(sZida, zSide, 'sk-mz-3', 'PERFECT', [1, 3, 5]);
    expect(zRes.ok).toBe(true);
    const firstMatch = zRes.events.find((e) => e.type === 'MATCH_CLEAR');
    expect(firstMatch && firstMatch.type === 'MATCH_CLEAR').toBe(true);
    if (firstMatch && firstMatch.type === 'MATCH_CLEAR') {
      const burnedRows = new Set(firstMatch.groups.flatMap((g) => g.positions.map((p) => p.row)));
      expect(Array.from(burnedRows).sort((a, b) => a - b)).toEqual([1, 3, 5]);
    }
    expect(zRes.events.some((e) => e.type === 'BOARD_REFILL')).toBe(true);

    // Mega Elpidios boosts maxHp & shield cleanly
    const sElpi = createBattleState(elpi, icarus, 902);
    sElpi.currentTurn = 'P1';
    const baseMaxHp = sElpi.fighters.P1.maxHp;
    sElpi.fighters.P1.mana = 250;
    sElpi.fighters.P1.rage = 200;
    const eRes = executeSkill(sElpi, 'P1', 'sk-me-3', 'PERFECT');
    expect(eRes.ok).toBe(true);
    expect(sElpi.fighters.P1.maxHp).toBeGreaterThan(baseMaxHp);
    expect(sElpi.fighters.P1.shield).toBeGreaterThan(0);

    // Mega Twin Flame spawns x2/x3 multipliers onto board
    const sTwin = createBattleState(twin, elpi, 903);
    sTwin.currentTurn = 'P1';
    sTwin.fighters.P1.mana = 250;
    sTwin.fighters.P1.rage = 200;
    const tRes = executeSkill(sTwin, 'P1', 'sk-mtf-3', 'GOOD');
    expect(tRes.ok).toBe(true);
    const boostedCount = sTwin.board.flat().filter((c) => (c.multiplier ?? 1) > 1).length;
    expect(boostedCount).toBeGreaterThanOrEqual(8);
  });

  it('supports 8 customizable Support Cards, 2-Mercenary Co-op buffs, and Endless Tower / Zodiac Tomb stages', () => {
    expect(Object.keys(SUPPORT_CARDS)).toHaveLength(8);
    expect(PVE_STAGES.some((s) => s.mode === 'ENDLESS_TOWER')).toBe(true);
    expect(PVE_STAGES.filter((s) => s.mode === 'ZODIAC_TOMB').length).toBeGreaterThanOrEqual(6);

    const p1Pet = STARTER_PETS[0];
    const p2Pet = STARTER_PETS[2];
    const state = createBattleState(p1Pet, p2Pet, 4242, 1, 1, 1, 8, 8, {
      mercenaryBuff: true,
      secondMercenaryBuff: true,
      equippedSupportCards: ['SHIELD_300', 'FREEZE_1', 'DRAIN_60'],
      supportCardLevels: { SHIELD_300: 5 },
    });
    state.currentTurn = 'P1';
    const p1 = state.fighters.P1;
    const p2 = state.fighters.P2;

    expect(p1.allyCount).toBe(2);
    expect(p1.equippedSupportCards).toEqual(['SHIELD_300', 'FREEZE_1', 'DRAIN_60']);
    expect(p1.mana).toBeGreaterThan(80);
    expect(p1.rage).toBe(25);

    const shieldRes = executeSupportCard(state, 'P1', 'SHIELD_300');
    expect(shieldRes.ok).toBe(true);
    expect(p1.shield).toBe(Math.round(320 * 1.8));

    p2.mana = 70;
    p2.rage = 50;
    const drainRes = executeSupportCard(state, 'P1', 'DRAIN_60');
    expect(drainRes.ok).toBe(true);
    expect(p2.mana).toBe(10);
    expect(p2.rage).toBe(10);

    const enemyHpBefore = p2.hp;
    const freezeRes = executeSupportCard(state, 'P1', 'FREEZE_1');
    expect(freezeRes.ok).toBe(true);
    expect(p2.hp).toBe(enemyHpBefore - 80);
    expect(p2.statuses.some((s) => s.kind === 'STUN')).toBe(true);
  });

  it('triggers Revival (Tim Hồi Sinh T2), empowers Boss encounters (×1.65 HP + Boss Shield), and applies Guard Pet +16% bonuses in 1v1 combat', () => {
    const spetra = applyPetProgression(getPetById('pet-boss-spetra'), 20, undefined, 6, 5);
    const orithyia = applyPetProgression(getPetById('pet-primal-orithyia'), 20, undefined, 6, 5);
    const baseState = createBattleState(spetra, orithyia, 7771, 1, 20, 20);
    const guardState = createBattleState(spetra, orithyia, 7771, 1, 20, 20, 8, 8, {
      guardPet: orithyia,
      auraId: 'aura-hackim',
      isBossEncounter: true,
    });

    // Guard Pet adds +16% HP/ATK/MAG & Boss encounter empowers P2 significantly!
    expect(guardState.fighters.P1.maxHp).toBeGreaterThan(baseState.fighters.P1.maxHp);
    expect(guardState.fighters.P1.attack).toBeGreaterThan(baseState.fighters.P1.attack);
    expect(guardState.fighters.P1.reviveCharges).toBeGreaterThanOrEqual(1);
    expect(guardState.fighters.P2.maxHp).toBeGreaterThan(Math.round(baseState.fighters.P2.maxHp * 1.5));
    expect(guardState.fighters.P2.shield).toBeGreaterThan(0);

    // Lethal blow on Boss Spetra triggers REVIVE instead of ending the match
    guardState.currentTurn = 'P2';
    guardState.fighters.P1.hp = 10;
    guardState.fighters.P1.shield = 0;
    const chargesBefore = guardState.fighters.P1.reviveCharges ?? 0;
    guardState.fighters.P2.rage = 200;
    guardState.fighters.P2.mana = 250;
    const lethalRes = executeSkill(guardState, 'P2', guardState.fighters.P2.skills[0].id);
    expect(lethalRes.ok).toBe(true);
    expect(lethalRes.events.some((e) => e.type === 'REVIVE' && e.side === 'P1')).toBe(true);
    expect(guardState.fighters.P1.hp).toBeGreaterThan(0);
    expect(guardState.fighters.P1.reviveCharges).toBe(chargesBefore - 1);
    expect(guardState.winner).toBeNull();
  });

  it('simulates Đấu Trường Bá Vương 5v5 Auto-Battle deterministically with front-to-back targeting', () => {
    const p1Ids = [
      'pet-boss-spetra',
      'pet-primal-orithyia',
      'pet-fantasy-joker',
      'pet-galaxy-shadow-sword',
      'pet-galaxy-dragon-knight',
    ];
    const p2Ids = [
      'pet-boss-humex',
      'pet-1282',
      'pet-mega-hyon',
      'pet-mega-ahrina',
      'pet-mega-icarus',
    ];
    const p1Team = p1Ids.map((id, slot) => ({ slot, pet: getPetById(id), level: 25, stars: 5, genLevel: 3 }));
    const p2Team = p2Ids.map((id, slot) => ({ slot, pet: getPetById(id), level: 15, stars: 3, genLevel: 1 }));

    const runA = simulateKingArenaBattle(p1Team, p2Team, 2026);
    const runB = simulateKingArenaBattle(p1Team, p2Team, 2026);

    expect(runA.winner).toBe(runB.winner);
    expect(runA.winner).toBe('P1');
    expect(runA.actions.length).toBeGreaterThan(0);
    expect(runA.initialUnits).toHaveLength(10);
    expect(Object.keys(runA.actions[0].snapshot)).toHaveLength(10);
    // First attack targets a Frontline unit (slot 0 or 1)
    const firstAttack = runA.actions.find((a) => Object.values(a.damages).some((d) => d > 0));
    expect(firstAttack).toBeDefined();
    if (firstAttack) {
      const targetUnit = runA.initialUnits.find((u) => u.id === firstAttack.targetIds[0]);
      expect(targetUnit?.slot).toBeLessThanOrEqual(1);
    }
  });

  it('computes Pokiwar 4.0 Multi-Stone Luck, Aura Cumulative Stacking & 6-Slot Equipment + Xung Phá bonuses', () => {
    const rateSingle = calcMultiStoneUpgradeRate(12, [0, 1, 0, 0, 0], 0, false);
    const rateMultiLuck = calcMultiStoneUpgradeRate(12, [0, 1, 2, 1, 0], 24, true);
    expect(rateMultiLuck).toBeGreaterThan(rateSingle);
    expect(rateMultiLuck).toBeLessThanOrEqual(100);

    const allAuraBonuses = computeAuraTotalBonuses(PET_AURAS.map((a) => a.id));
    const oneAuraBonuses = computeAuraTotalBonuses(['aura-gold']);
    expect(allAuraBonuses.hpBonus).toBeGreaterThan(oneAuraBonuses.hpBonus);
    expect(allAuraBonuses.atkBonus).toBeGreaterThan(oneAuraBonuses.atkBonus);

    const eqBase = computeEquipmentBonuses({ NON: 'eq-non-1', VU_KHI: 'eq-vk-1' }, 0);
    const eqMax = computeEquipmentBonuses(
      { NON: 'eq-non-3', VU_KHI: 'eq-vk-3', CANH: 'eq-canh-3', AO: 'eq-ao-3', GIAY: 'eq-giay-3', HIEU_UNG: 'eq-fx-3' },
      15,
    );
    expect(eqMax.hpBonus).toBeGreaterThan(eqBase.hpBonus);
    expect(eqMax.speedBonus).toBeGreaterThan(eqBase.speedBonus);
  });

  it('executes authentic Pokiwar 4.0 Zing Me Special Skill Cards (Kết Ấn, Miêu Thuật, Chữ Thập, Bom 3×3, Thần Bài, No-QTE Zero, Twin Frost ≤20%→70% HP)', () => {
    // 1. Mega Icarus: Kết Ấn (SEAL_REGION 5x5 + x2/x3/x4 + heal)
    const icarus = getPetById('pet-mega-icarus');
    const glank = getPetById('pet-galaxy-glank');
    const sIc = createBattleState(icarus, glank, 5101);
    sIc.currentTurn = 'P1';
    sIc.fighters.P1.mana = 220;
    sIc.fighters.P1.rage = 120;
    const icRes = executeSkill(sIc, 'P1', 'sk-mi-3', 'PERFECT');
    expect(icRes.ok).toBe(true);
    expect(icRes.events.some((e) => e.type === 'MATCH_CLEAR')).toBe(true);
    const icCast = icRes.events.find((e) => e.type === 'SKILL_CAST');
    expect(icCast && icCast.type === 'SKILL_CAST' && icCast.specialNote).toContain('KẾT ẤN');

    // 2. Mega Ahrina: Miêu Thuật (CONSUME_GEMS SWORD)
    const ahrina = getPetById('pet-mega-ahrina');
    const sAh = createBattleState(ahrina, glank, 5102);
    sAh.currentTurn = 'P1';
    sAh.fighters.P1.mana = 220;
    sAh.fighters.P1.rage = 180;
    const ahRes = executeSkill(sAh, 'P1', 'sk-ahr-3', 'PERFECT');
    expect(ahRes.ok).toBe(true);
    expect(sAh.fighters.P2.hp).toBeLessThan(sAh.fighters.P2.maxHp);

    // 3. Mega Fireware (CROSS_EXPLODE) & Mega Issylt (BOMB_3X3)
    const fw = getPetById('pet-mega-fireware');
    const iss = getPetById('pet-mega-issylt');
    const sFw = createBattleState(fw, iss, 5103);
    sFw.currentTurn = 'P1';
    sFw.fighters.P1.mana = 220;
    sFw.fighters.P1.rage = 0; // authentic 0 Nộ!
    expect(executeSkill(sFw, 'P1', 'sk-fw-3', 'GOOD', [2, 5]).ok).toBe(true);

    const sIss = createBattleState(iss, fw, 5104);
    sIss.currentTurn = 'P1';
    sIss.fighters.P1.mana = 220;
    sIss.fighters.P1.rage = 160;
    expect(executeSkill(sIss, 'P1', 'sk-iss-3', 'GOOD', [1, 4, 6]).ok).toBe(true);

    // 4. Galaxy Risky: Thần Bài Vận Mệnh (FATE_CARD)
    const risky = getPetById('pet-galaxy-risky');
    const sRis = createBattleState(risky, glank, 5105);
    sRis.currentTurn = 'P1';
    sRis.fighters.P1.mana = 220;
    sRis.fighters.P1.rage = 220;
    const risRes = executeSkill(sRis, 'P1', 'sk-ris-3', 'PERFECT');
    expect(risRes.ok).toBe(true);
    const risCast = risRes.events.find((e) => e.type === 'SKILL_CAST');
    expect(risCast && risCast.type === 'SKILL_CAST' && risCast.specialNote).toContain('BÀI');

    // 5. Mega Zero: 200 Mana, 0 Nộ, needPerfection = false (No QTE!)
    const zero = getPetById('pet-mega-zero');
    expect(zero.skills[0].needPerfection).toBe(false);
    expect(zero.skills[0].rageCost).toBe(0);

    // 6. Mega Twin Frost: emergency heal to 70% Max HP when HP <= 20%
    const frost = getPetById('pet-mega-twinfrost');
    const joker = getPetById('pet-fantasy-joker');
    const sFr = createBattleState(frost, joker, 5106);
    sFr.currentTurn = 'P1';
    sFr.fighters.P1.hp = Math.round(sFr.fighters.P1.maxHp * 0.15);
    const passRes = passTurn(sFr, 'P1');
    expect(passRes.ok).toBe(true);
    expect(sFr.fighters.P1.emergencyHealUsed).toBe(true);
    expect(sFr.fighters.P1.hp).toBe(Math.round(sFr.fighters.P1.maxHp * 0.7));
    expect(passRes.events.some((e) => e.type === 'REVIVE' && e.side === 'P1')).toBe(true);

    // 7. Galaxy Dragon Knight (G3 - Dây Cót Thời Gian) & Galaxy Shadow Sword (G4 - Tụ Lực No-QTE)
    const dk = getPetById('pet-galaxy-dragon-knight');
    const ss = getPetById('pet-galaxy-shadow-sword');
    expect(dk.element).toBe('KIM');
    expect(dk.skills[0].name).toBe('Dây Cót Thời Gian');
    expect(ss.element).toBe('HOA');
    expect(ss.skills[0].rageCost).toBe(0);
    expect(ss.skills[0].needPerfection).toBe(false);
    const sDk = createBattleState(dk, ss, 5107);
    sDk.currentTurn = 'P1';
    sDk.fighters.P1.mana = 220;
    sDk.fighters.P1.rage = 180;
    expect(executeSkill(sDk, 'P1', 'sk-gdk-3', 'PERFECT').ok).toBe(true);
    expect(sDk.fighters.P1.mana).toBeGreaterThanOrEqual(120); // manaRefund!
    sDk.currentTurn = 'P2';
    sDk.fighters.P2.mana = 150;
    sDk.fighters.P2.rage = 0;
    expect(executeSkill(sDk, 'P2', 'sk-gss-3').ok).toBe(true);
  });

  it('enforces authentic Pokiwar Zing Me 6-gem rules: FIRE only charges Rage (zero damage), Purple Shield builds Shield, Yin-Yang drains', () => {
    const p1 = getPetById('pet-583');
    const p2 = getPetById('pet-1431');
    const state = createBattleState(p1, p2, 6060);
    state.currentTurn = 'P1';
    state.fighters.P1.rage = 0;
    state.fighters.P1.shield = 0;
    const enemyHpStart = state.fighters.P2.hp;

    // Force a pure FIRE match-3 at (0,0)-(0,2) via swap (0,2)<->(1,2)
    state.board = makeGrid([
      ['FIRE', 'FIRE', 'HEART', 'SWORD', 'LIGHTNING', 'COIN', 'YINYANG', 'HEART'],
      ['LIGHTNING', 'COIN', 'FIRE', 'YINYANG', 'HEART', 'SWORD', 'LIGHTNING', 'COIN'],
      ['YINYANG', 'HEART', 'SWORD', 'LIGHTNING', 'COIN', 'YINYANG', 'HEART', 'SWORD'],
      ['COIN', 'YINYANG', 'LIGHTNING', 'HEART', 'SWORD', 'LIGHTNING', 'COIN', 'YINYANG'],
      ['HEART', 'SWORD', 'COIN', 'YINYANG', 'LIGHTNING', 'HEART', 'SWORD', 'COIN'],
      ['LIGHTNING', 'COIN', 'YINYANG', 'SWORD', 'HEART', 'COIN', 'YINYANG', 'LIGHTNING'],
      ['SWORD', 'HEART', 'LIGHTNING', 'COIN', 'YINYANG', 'SWORD', 'HEART', 'SWORD'],
      ['YINYANG', 'LIGHTNING', 'HEART', 'SWORD', 'COIN', 'HEART', 'LIGHTNING', 'YINYANG'],
    ]);
    const fireRes = executeSwap(state, 'P1', { row: 0, col: 2 }, { row: 1, col: 2 });
    expect(fireRes.ok).toBe(true);
    const fireDelta = fireRes.events.find((e) => e.type === 'RESOURCE_DELTA' && e.gemType === 'FIRE');
    expect(fireDelta && fireDelta.type === 'RESOURCE_DELTA' && fireDelta.rageGain).toBeGreaterThan(0);
    expect(fireDelta && fireDelta.type === 'RESOURCE_DELTA' ? fireDelta.damage : undefined).toBeUndefined();
    expect(state.fighters.P2.hp).toBe(enemyHpStart);

    // Force a pure Purple Shield (YINYANG) match-3 -> builds Shield on caster, zero enemy HP damage
    state.currentTurn = 'P1';
    state.board = makeGrid([
      ['YINYANG', 'YINYANG', 'HEART', 'SWORD', 'LIGHTNING', 'COIN', 'FIRE', 'HEART'],
      ['LIGHTNING', 'COIN', 'YINYANG', 'FIRE', 'HEART', 'SWORD', 'LIGHTNING', 'COIN'],
      ['FIRE', 'HEART', 'SWORD', 'LIGHTNING', 'COIN', 'FIRE', 'HEART', 'SWORD'],
      ['COIN', 'FIRE', 'LIGHTNING', 'HEART', 'SWORD', 'LIGHTNING', 'COIN', 'FIRE'],
      ['HEART', 'SWORD', 'COIN', 'FIRE', 'LIGHTNING', 'HEART', 'SWORD', 'COIN'],
      ['LIGHTNING', 'COIN', 'FIRE', 'SWORD', 'HEART', 'COIN', 'FIRE', 'LIGHTNING'],
      ['SWORD', 'HEART', 'LIGHTNING', 'COIN', 'FIRE', 'SWORD', 'HEART', 'SWORD'],
      ['FIRE', 'LIGHTNING', 'HEART', 'SWORD', 'COIN', 'HEART', 'LIGHTNING', 'FIRE'],
    ]);
    const shieldRes = executeSwap(state, 'P1', { row: 0, col: 2 }, { row: 1, col: 2 });
    expect(shieldRes.ok).toBe(true);
    const shieldDelta = shieldRes.events.find((e) => e.type === 'RESOURCE_DELTA' && e.gemType === 'YINYANG');
    expect(shieldDelta && shieldDelta.type === 'RESOURCE_DELTA' && shieldDelta.shieldGain).toBeGreaterThan(0);
    expect(state.fighters.P1.shield).toBeGreaterThan(0);
    expect(state.fighters.P2.hp).toBe(enemyHpStart);
  });
});
