import {
  applyPetProgression,
  calcMultiStoneUpgradeRate,
  computePetPower,
  ELEMENT_META,
  GEN_UPGRADE_CORE_COSTS,
  GEN_UPGRADE_GOLD_COSTS,
  getAuraById,
  getPetById,
  getPetSpriteId,
  getPetSpritePath,
  getSingleStoneUpgradeRate,
  MAX_PET_LEVEL,
  MAX_UPGRADE_STONE_SLOTS,
  PET_BREAKTHROUGH_GEN_COSTS,
  PET_BREAKTHROUGH_GOLD_COSTS,
  PET_BREAKTHROUGH_SHARD_COSTS,
  PVE_STAGES,
  STAR_UPGRADE_GOLD_COSTS,
  STAR_UPGRADE_SHARD_COSTS,
  STARTER_PETS,
  type ElementType,
  type EvolutionTier,
} from '@pokiwar/shared';
import { useEffect, useRef, useState } from 'react';
import type { PlayerProgress } from './MainLobby.js';
import { SpineStageCanvas } from './SpineStageCanvas.js';

interface PetUpgradeScreenProps {
  progress: PlayerProgress;
  initialTab?: 'UPGRADE' | 'EVOLVE_TREE';
  onBack: () => void;
  onSelectPet: (petId: string) => void;
  onUpgradePet: (
    petId: string,
    goldCost: number,
    stoneCost: number,
    stoneLv: number,
    stackedStones?: [number, number, number, number, number],
  ) => { success: boolean; message: string };
  onEvolvePet?: (petId: string, goldCost: number, stoneCost: number) => void;
  onUpgradePetStar?: (petId: string) => { success: boolean; message: string };
  onUpgradePetGen?: (petId: string) => { success: boolean; message: string };
  onBreakthroughPet?: (petId: string) => { success: boolean; message: string };
  onSynthesizePet?: (petId: string) => { success: boolean; message: string };
  onCombineStones?: (fromLvIdx: number) => boolean;
  onUnlockPetWithShards?: (petId: string) => boolean;
  onBuyPetUnlock?: (petId: string, goldCost: number) => boolean;
}

const ELEMENT_STONE_KEY: Record<ElementType, string> = {
  KIM: 'm',
  MOC: 'e',
  THUY: 'w',
  HOA: 'f',
  THO: 'g',
};

const TIER_LABELS: Record<EvolutionTier, string> = {
  BASE: 'Pet Thường',
  S: 'Siêu Cấp S',
  LEGEND: 'Huyền Thoại',
  MEGA: 'Thần Thú Mega',
  GALAXY: 'Thiên Hà Galaxy',
  FANTASY: 'Siêu Pet Fantasy',
  ANCIENT: 'Thượng Cổ Ancient',
  TITAN: 'Thần Chiến Titan',
  MECH: 'Thần Giáp Mech',
};

const TIER_RANK_ORDER: Record<EvolutionTier, number> = {
  ANCIENT: 8,
  FANTASY: 7,
  GALAXY: 6,
  MEGA: 5,
  LEGEND: 4,
  MECH: 3,
  TITAN: 3,
  S: 2,
  BASE: 1,
};

const TIER_BADGE_STYLE: Record<EvolutionTier, { tag: string; bg: string; color: string }> = {
  ANCIENT: { tag: 'A', bg: '#b45309', color: '#fef08a' },
  FANTASY: { tag: 'F', bg: '#7e22ce', color: '#fef08a' },
  GALAXY: { tag: 'G', bg: '#1d4ed8', color: '#bae6fd' },
  MEGA: { tag: 'M', bg: '#c2410c', color: '#fef08a' },
  LEGEND: { tag: 'HT', bg: '#b91c1c', color: '#fee2e2' },
  MECH: { tag: 'MC', bg: '#334155', color: '#e2e8f0' },
  TITAN: { tag: 'TT', bg: '#475569', color: '#e2e8f0' },
  S: { tag: 'S', bg: '#0369a1', color: '#e0f2fe' },
  BASE: { tag: 'B', bg: '#1e293b', color: '#cbd5e1' },
};

const TIER_FILTER_TABS: readonly { key: 'ALL' | 'ANCIENT' | 'FANTASY' | 'GALAXY' | 'MEGA' | 'LEGEND' | 'BASIC'; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'ANCIENT', label: 'Ancient' },
  { key: 'FANTASY', label: 'Fantasy' },
  { key: 'GALAXY', label: 'Galaxy' },
  { key: 'MEGA', label: 'Mega' },
  { key: 'LEGEND', label: 'Huyền Thoại' },
  { key: 'BASIC', label: 'Pet Thường' },
];

const ELEMENT_TABS: readonly { key: 'ALL' | ElementType; label: string; icon?: string }[] = [
  { key: 'ALL', label: 'TẤT CẢ' },
  { key: 'HOA', label: 'HỎA', icon: '/assets/pokiguard/sprites/FIRE.png' },
  { key: 'THUY', label: 'THỦY', icon: '/assets/pokiguard/sprites/WATER.png' },
  { key: 'MOC', label: 'MỘC', icon: '/assets/pokiguard/sprites/WOOD.png' },
  { key: 'THO', label: 'THỔ', icon: '/assets/pokiguard/sprites/EARTH.png' },
  { key: 'KIM', label: 'KIM', icon: '/assets/pokiguard/sprites/METAL.png' },
];

export function PetUpgradeScreen({
  progress,
  initialTab = 'UPGRADE',
  onBack,
  onSelectPet,
  onUpgradePet,
  onUpgradePetStar,
  onUpgradePetGen,
  onBreakthroughPet,
  onSynthesizePet,
  onCombineStones,
  onUnlockPetWithShards,
  onBuyPetUnlock,
}: PetUpgradeScreenProps) {
  const [activeTab, setActiveTab] = useState<'UPGRADE' | 'EVOLVE_TREE'>(initialTab);
  const [inspectId, setInspectId] = useState(progress.selectedPetId);
  const [elementFilter, setElementFilter] = useState<'ALL' | ElementType>('ALL');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'FANTASY' | 'ANCIENT' | 'GALAXY' | 'MEGA' | 'LEGEND' | 'BASIC'>('ALL');
  const [selectedStoneLv, setSelectedStoneLv] = useState<number>(3);
  const [sockets, setSockets] = useState<(number | null)[]>(() => {
    const bag = progress.stoneBag ?? [8, 4, 2, 1, 0];
    const firstIdx = [2, 1, 0, 3, 4].find((i) => (bag[i] ?? 0) > 0);
    return [firstIdx !== undefined ? firstIdx + 1 : null, null, null];
  });
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const dockScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const stoneBag = progress.stoneBag ?? [8, 4, 2, 1, 0];
  const unlockedPets = progress.unlockedPets ?? [progress.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'];
  const petShards = progress.petShards ?? {};
  const petStars = progress.petStars ?? {};
  const petGenLevels = progress.petGenLevels ?? {};
  const petUpgradeLuck = progress.petUpgradeLuck ?? {};
  const genCores = progress.genCores ?? 0;
  const activeAura = getAuraById(progress.equippedAuraId);

  const basePet = getPetById(inspectId);
  const isPetUnlocked = unlockedPets.includes(basePet.id);
  const shardCount = petShards[basePet.id] ?? 0;
  const SHARD_UNLOCK_COST = 30;
  const GOLD_UNLOCK_COST = 1200;
  const dropStages = PVE_STAGES.filter((st) => st.enemyPetId === basePet.id);
  const currentLv = Math.max(1, Math.min(MAX_PET_LEVEL, progress.petLevels[basePet.id] ?? 1));
  const isMaxLevel = currentLv >= MAX_PET_LEVEL;
  const currentTier = basePet.tier;
  const starCount = Math.max(1, Math.min(6, petStars[basePet.id] ?? 1));
  const genLevel = Math.max(0, Math.min(5, petGenLevels[basePet.id] ?? 0));
  const petBtLevel = Math.max(0, Math.min(5, progress.petBreakthroughs?.[basePet.id] ?? 0));
  const accLuck = petUpgradeLuck[basePet.id] ?? 0;

  const currentPet = applyPetProgression(basePet, currentLv, currentTier, starCount, genLevel, petBtLevel);
  const nextLvPet = applyPetProgression(
    basePet,
    Math.min(MAX_PET_LEVEL, currentLv + 1),
    currentTier,
    starCount,
    genLevel,
    petBtLevel,
  );
  const nextStarPet =
    starCount < 6 ? applyPetProgression(basePet, currentLv, currentTier, starCount + 1, genLevel, petBtLevel) : null;

  const nextStarShardCost = starCount < 6 ? STAR_UPGRADE_SHARD_COSTS[starCount] : 0;
  const nextStarGoldCost = starCount < 6 ? STAR_UPGRADE_GOLD_COSTS[starCount] : 0;
  const nextGenCoreCost = genLevel < 5 ? GEN_UPGRADE_CORE_COSTS[genLevel] : 0;
  const nextGenGoldCost = genLevel < 5 ? GEN_UPGRADE_GOLD_COSTS[genLevel] : 0;
  const nextBtGoldCost = petBtLevel < 5 ? PET_BREAKTHROUGH_GOLD_COSTS[petBtLevel + 1] : 0;
  const nextBtGenCost = petBtLevel < 5 ? PET_BREAKTHROUGH_GEN_COSTS[petBtLevel + 1] : 0;
  const nextBtShardCost = petBtLevel < 5 ? PET_BREAKTHROUGH_SHARD_COSTS[petBtLevel + 1] : 0;

  const upGold = 180 + currentLv * 90;
  const upStones = 3 + Math.floor(currentLv * 1.5);

  const isEquipped = progress.selectedPetId === basePet.id;
  const currentSpriteId = getPetSpriteId(basePet);
  const stoneKey = ELEMENT_STONE_KEY[basePet.element];
  const currentPower = computePetPower(currentPet);
  const nextLvPower = computePetPower(nextLvPet);

  // Clamp 3 stone sockets against player's stoneBag so consumed stones clear automatically
  const remainingBag = [...stoneBag] as [number, number, number, number, number];
  const effectiveSockets: (number | null)[] = Array.from({ length: MAX_UPGRADE_STONE_SLOTS }, (_, idx) => {
    const lv = sockets[idx] ?? null;
    if (lv === null) return null;
    const bagIdx = lv - 1;
    if ((remainingBag[bagIdx] ?? 0) > 0) {
      remainingBag[bagIdx] -= 1;
      return lv;
    }
    return null;
  });
  const effectiveStack: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const lv of effectiveSockets) {
    if (lv !== null) effectiveStack[lv - 1] += 1;
  }
  const totalStackedCount = effectiveSockets.filter((lv) => lv !== null).length;

  // Pokiwar Zing Me (4.0) Synthesis Recipe & Child Pets
  const recipe = basePet.synthesisRecipe;
  const requiredMaterialPet = recipe ? getPetById(recipe.requiredPetId) : null;
  const hasMaterialPet = requiredMaterialPet ? unlockedPets.includes(requiredMaterialPet.id) : false;
  const materialPetLv = requiredMaterialPet ? (progress.petLevels[requiredMaterialPet.id] ?? 1) : 0;
  const recipeStoneHave = recipe ? (stoneBag[recipe.stoneLevel - 1] ?? 0) : 0;
  const canSynthesizeNow =
    !isPetUnlocked &&
    !!recipe &&
    hasMaterialPet &&
    materialPetLv >= recipe.requiredPetLevel &&
    recipeStoneHave >= recipe.stoneCount &&
    progress.gold >= recipe.goldCost;

  const derivedPets = STARTER_PETS.filter((p) => p.synthesisRecipe?.requiredPetId === basePet.id);

  const upgradeRate = calcMultiStoneUpgradeRate(currentLv, effectiveStack, accLuck);

  const selectedStoneCount = stoneBag[selectedStoneLv - 1] ?? 0;
  const canAffordUpgrade =
    !isMaxLevel &&
    isPetUnlocked &&
    progress.gold >= upGold &&
    totalStackedCount > 0;
  const canAffordStarUpgrade =
    isPetUnlocked && starCount < 6 && shardCount >= nextStarShardCost && progress.gold >= nextStarGoldCost;
  const canAffordGenUpgrade =
    isPetUnlocked && genLevel < 5 && genCores >= nextGenCoreCost && progress.gold >= nextGenGoldCost;
  const canAffordPetBreakthrough =
    isPetUnlocked &&
    petBtLevel < 5 &&
    progress.gold >= nextBtGoldCost &&
    genCores >= nextBtGenCost &&
    shardCount >= nextBtShardCost;

  const handleInsertStone = (lv: number) => {
    setSelectedStoneLv(lv);
    const qty = stoneBag[lv - 1] ?? 0;
    const used = effectiveStack[lv - 1] ?? 0;
    if (qty <= used) {
      setFeedback({
        ok: false,
        text: qty === 0 ? `Bạn chưa có Đá C${lv} trong túi!` : `Đã lắp hết ${qty} viên Đá C${lv}!`,
      });
      setTimeout(() => setFeedback(null), 1800);
      return;
    }
    const next = [...effectiveSockets];
    const emptyIdx = next.findIndex((s) => s === null);
    if (emptyIdx === -1) {
      setFeedback({
        ok: false,
        text: `Đã lắp đủ ${MAX_UPGRADE_STONE_SLOTS}/${MAX_UPGRADE_STONE_SLOTS} ô đá! Nhấn vào ô đá bên dưới để tháo bớt.`,
      });
      setTimeout(() => setFeedback(null), 1900);
      return;
    }
    next[emptyIdx] = lv;
    setSockets(next);
  };

  const handleRemoveSocket = (slotIdx: number) => {
    const next = [...effectiveSockets];
    next[slotIdx] = null;
    setSockets(next);
  };

  const handleQuickStackStones = () => {
    if (isMaxLevel) return;
    const avail = [...stoneBag] as [number, number, number, number, number];
    const chosen: (number | null)[] = [null, null, null];
    const stack: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    let added = 0;
    for (let i = 4; i >= 0 && added < MAX_UPGRADE_STONE_SLOTS; i--) {
      while (
        avail[i] > 0 &&
        added < MAX_UPGRADE_STONE_SLOTS &&
        calcMultiStoneUpgradeRate(currentLv, stack, accLuck) < 100
      ) {
        avail[i] -= 1;
        stack[i] += 1;
        chosen[added] = i + 1;
        added += 1;
      }
    }
    setSockets(chosen);
    const nextRate = calcMultiStoneUpgradeRate(currentLv, stack, accLuck);
    setFeedback({
      ok: added > 0,
      text:
        added > 0
          ? `⚡ Lắp nhanh ${added}/${MAX_UPGRADE_STONE_SLOTS} viên đá — Tổng tỉ lệ: ${nextRate}%!`
          : 'Túi không còn Đá C1–C5! Hãy mua thêm ở Shop hoặc đi vượt ải.',
    });
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleTriggerGenUpgrade = () => {
    if (!onUpgradePetGen) return;
    const res = onUpgradePetGen(basePet.id);
    setFeedback({ ok: res.success, text: res.message });
    setTimeout(() => setFeedback(null), 2600);
  };

  const handleTriggerPetBreakthrough = () => {
    if (!onBreakthroughPet) return;
    const res = onBreakthroughPet(basePet.id);
    setFeedback({ ok: res.success, text: res.message });
    setTimeout(() => setFeedback(null), 2800);
  };

  const handleTriggerStarUpgrade = () => {
    if (!onUpgradePetStar) return;
    const res = onUpgradePetStar(basePet.id);
    setFeedback({ ok: res.success, text: res.message });
    setTimeout(() => setFeedback(null), 2600);
  };

  const handleTriggerSynthesize = () => {
    if (!onSynthesizePet) return;
    const res = onSynthesizePet(basePet.id);
    setFeedback({ ok: res.success, text: res.message });
    setTimeout(() => setFeedback(null), 2800);
  };

  const handleShardUnlock = () => {
    if (!onUnlockPetWithShards) return;
    const ok = onUnlockPetWithShards(basePet.id);
    setFeedback({
      ok,
      text: ok
        ? `Ghép thành công 30 Mảnh — Mở khóa ${basePet.name}!`
        : `Cần đủ 30 Mảnh ${basePet.name} để ghép!`,
    });
    setTimeout(() => setFeedback(null), 2400);
  };

  const handleGoldUnlock = () => {
    if (!onBuyPetUnlock) return;
    const ok = onBuyPetUnlock(basePet.id, GOLD_UNLOCK_COST);
    setFeedback({
      ok,
      text: ok
        ? `Chiêu mộ thành công ${basePet.name}!`
        : `Cần ${GOLD_UNLOCK_COST.toLocaleString()} Vàng để chiêu mộ ${basePet.name}!`,
    });
    setTimeout(() => setFeedback(null), 2400);
  };

  const visiblePets = STARTER_PETS.filter((p) => {
    if (elementFilter !== 'ALL' && p.element !== elementFilter) return false;
    if (tierFilter === 'ALL') return true;
    if (tierFilter === 'BASIC') return p.tier === 'BASE' || p.tier === 'S';
    return p.tier === tierFilter;
  }).sort((a, b) => {
    // Authentic Pokiwar Zing Me Kho Pet sorting:
    // 1. Equipped Pet first -> 2. Owned before Locked -> 3. Rarity Tier (Fantasy > Ancient > Galaxy > Mega > Legend > S > Base) -> 4. Level & Power desc
    if (a.id === progress.selectedPetId) return -1;
    if (b.id === progress.selectedPetId) return 1;
    const aOwned = unlockedPets.includes(a.id) ? 1 : 0;
    const bOwned = unlockedPets.includes(b.id) ? 1 : 0;
    if (aOwned !== bOwned) return bOwned - aOwned;
    const tierDiff = (TIER_RANK_ORDER[b.tier] ?? 0) - (TIER_RANK_ORDER[a.tier] ?? 0);
    if (tierDiff !== 0) return tierDiff;
    const lvDiff = (progress.petLevels[b.id] ?? 1) - (progress.petLevels[a.id] ?? 1);
    if (lvDiff !== 0) return lvDiff;
    return computePetPower(b) - computePetPower(a);
  });

  const handleTriggerUpgrade = () => {
    const res = onUpgradePet(
      basePet.id,
      upGold,
      upStones,
      selectedStoneLv,
      totalStackedCount > 0 ? effectiveStack : undefined,
    );
    setFeedback({ ok: res.success, text: res.message });
    setTimeout(() => setFeedback(null), 2600);
  };

  const scrollDock = (dx: number) => {
    dockScrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  };

  return (
    <div
      className="pk-upgrade-root"
      style={{ backgroundImage: "url('/assets/pokiguard/sprites/513_207.png')", overflow: 'hidden' }}
    >
      <div className="pk-upgrade-scrim" />

      <div className="pk-upgrade-body" style={{ overflow: 'hidden' }}>
        {/* TOP HEADER (1:1 POKIGUARD KHO PET BANNER) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 54,
            flexShrink: 0,
          }}
        >
          <button type="button" className="pk-btn-blue" onClick={onBack}>
            <img
              src="/assets/pokiguard/sprites/btn_back_blue.png"
              alt=""
              style={{ width: 20, height: 20, objectFit: 'contain' }}
            />
            Về Đảo Chính
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="pk-khopet-banner" style={{ minWidth: 235, padding: '8px 26px 0', fontSize: 15 }}>
              {activeTab === 'EVOLVE_TREE' ? 'TẾ ĐÀN HỢP PET & MẢNH' : 'KHO PET 4.0'}
            </div>
            <button
              type="button"
              className={activeTab === 'UPGRADE' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '6px 12px', fontSize: 11.5 }}
              onClick={() => setActiveTab('UPGRADE')}
            >
              ⚒️ Kho Pet &amp; Đập Level
            </button>
            <button
              type="button"
              className={activeTab === 'EVOLVE_TREE' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '6px 12px', fontSize: 11.5 }}
              onClick={() => setActiveTab('EVOLVE_TREE')}
            >
              🌳 Tế Đàn Hợp Pet &amp; Mảnh
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="pk-hud-capsule">
              <img src="/assets/pokiguard/sprites/gold.png" alt="Vàng" style={{ width: 20, height: 20 }} />
              <span className="pk-num-font" style={{ color: '#fde047' }}>
                {progress.gold.toLocaleString()}
              </span>
            </div>
            <div className="pk-hud-capsule">
              <img src="/assets/pokiguard/sprites/crystal.png" alt="Đá" style={{ width: 20, height: 20 }} />
              <span className="pk-num-font" style={{ color: '#7dd3fc' }}>
                {progress.stones} Đá
              </span>
            </div>
            <button
              type="button"
              className="pk-close-orb"
              aria-label="Đóng"
              title="Về Đảo Chính"
              onClick={onBack}
            >
              <img src="/assets/pokiguard/sprites/Button_Pack-Button_Pack_1_0.png" alt="Đóng" />
            </button>
          </div>
        </div>

        {/* 3-COLUMN KHO PET WORKSPACE OR DEDICATED EVOLUTION TREE */}
        {activeTab === 'UPGRADE' ? (
        <div className="pk-upgrade-grid">
          {/* LEFT PANEL (panels-02): NameBar + 5 Gold Stars + 3 PokiGuard Stat Bars + Skills + Ra Trận / Nâng Cấp */}
          <div className="pk-khopet-left">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* NameBar */}
              <div className="pk-khopet-stat-bar">
                <img
                  src={ELEMENT_META[currentPet.element].iconPath}
                  alt={currentPet.element}
                  style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
                />
                <span
                  style={{
                    fontWeight: 900,
                    fontSize: 15,
                    color: '#ffe08a',
                    textShadow: '0 1px 2px #000',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: '0 6px',
                  }}
                >
                  {currentPet.name}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 900,
                    color: !isPetUnlocked ? '#fca5a5' : isEquipped ? '#4ade80' : '#93c5fd',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {!isPetUnlocked ? `🔒 ${shardCount}/30 Mảnh` : isEquipped ? 'ĐANG RA TRẬN' : currentTier}
                </span>
              </div>

              {/* 6 Gold/Purple Stars + Combat Power */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <img
                      key={idx}
                      src="/assets/pokiguard/sprites/gold_star.png"
                      alt="*"
                      style={{
                        width: 17,
                        height: 17,
                        objectFit: 'contain',
                        opacity: idx < starCount ? 1 : 0.22,
                        filter: idx === 5 && starCount >= 6 ? 'hue-rotate(250deg) saturate(1.8)' : undefined,
                      }}
                    />
                  ))}
                </div>
                <span className="pk-num-font" style={{ fontSize: 13.5, color: '#4ade80' }}>
                  LC {currentPower}
                </span>
              </div>

              {/* 3 Authentic PokiGuard bars-01 Stat Bars */}
              {[
                {
                  label: 'TẤN CÔNG',
                  icon: '/assets/pokiguard/sprites/icons-01_0.png',
                  cur: currentPet.attack,
                  delta: nextLvPet.attack - currentPet.attack,
                  color: '#fb923c',
                },
                {
                  label: 'MÁU',
                  icon: '/assets/pokiguard/sprites/icons-03_0.png',
                  cur: currentPet.maxHp,
                  delta: nextLvPet.maxHp - currentPet.maxHp,
                  color: '#4ade80',
                },
                {
                  label: 'PHÉP / MANA',
                  icon: '/assets/pokiguard/sprites/cards-02_0.png',
                  cur: currentPet.magic,
                  delta: nextLvPet.magic - currentPet.magic,
                  color: '#38bdf8',
                },
              ].map((st) => (
                <div key={st.label} className="pk-khopet-stat-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={st.icon} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1' }}>{st.label}</span>
                  </div>
                  <div className="pk-num-font" style={{ fontSize: 13.5 }}>
                    <span style={{ color: st.color }}>{st.cur}</span>{' '}
                    <span style={{ color: '#4ade80', fontSize: 11 }}>+{st.delta}</span>
                  </div>
                </div>
              ))}

              {/* Compact Defense & Speed (High-Contrast Dark Pill) */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  padding: '3px 8px',
                  borderRadius: 7,
                  background: 'rgba(2, 6, 23, 0.72)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  fontSize: 11,
                  color: '#f8fafc',
                  fontWeight: 900,
                }}
              >
                <span>Thủ: {currentPet.defense} <span style={{ color: '#4ade80' }}>(+{nextLvPet.defense - currentPet.defense})</span></span>
                <span style={{ color: '#64748b' }}>•</span>
                <span>Tốc: {currentPet.speed} <span style={{ color: '#4ade80' }}>(+{nextLvPet.speed - currentPet.speed})</span></span>
              </div>
            </div>

            {/* Special Skill Card ONLY for Special Pets (Mega / Galaxy / Fantasy / Cổ Đại / Huyền Thoại) */}
            <div style={{ borderTop: '1px solid rgba(250, 204, 21, 0.25)', paddingTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#fde047', marginBottom: 5 }}>
                {currentPet.skills.length > 0
                  ? '★ THẺ KỸ NĂNG ĐẶC BIỆT (ZING ME 4.0):'
                  : '🐾 PHONG CÁCH CHIẾN ĐẤU:'}
              </div>
              {currentPet.skills.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {currentPet.skills.map((sk) => (
                    <div
                      key={sk.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 8px',
                        borderRadius: 9,
                        background: 'linear-gradient(90deg, rgba(120, 53, 15, 0.78), rgba(15, 23, 42, 0.94))',
                        border: '1.5px solid #fde047',
                        boxShadow: '0 0 12px rgba(250, 204, 21, 0.38)',
                      }}
                    >
                      <img
                        src={sk.cardImage}
                        alt={sk.name}
                        style={{
                          width: 44,
                          height: 56,
                          borderRadius: 6,
                          objectFit: 'cover',
                          border: '1.5px solid #fef08a',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 900 }}>
                          <span style={{ color: '#fef08a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            ★ {sk.name}
                          </span>
                          <span style={{ color: '#fb923c', flexShrink: 0, fontSize: 10 }}>
                            {sk.rageCost}N/{sk.manaCost ?? 0}M
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 9.8,
                            lineHeight: 1.24,
                            color: '#e2e8f0',
                            marginTop: 2,
                          }}
                          title={`${sk.description}${sk.specialPassiveNote ? `\n• Bị động: ${sk.specialPassiveNote}` : ''}`}
                        >
                          {sk.description}
                        </div>
                        {sk.specialPassiveNote && (
                          <div style={{ fontSize: 9, color: '#86efac', fontWeight: 800, marginTop: 3, lineHeight: 1.2 }}>
                            ✦ {sk.specialPassiveNote}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: '9px 10px',
                    borderRadius: 9,
                    background: 'rgba(6, 18, 46, 0.84)',
                    border: '1px solid rgba(56, 189, 248, 0.38)',
                    fontSize: 10.5,
                    lineHeight: 1.38,
                    color: '#cbd5e1',
                  }}
                >
                  <strong style={{ color: '#93c5fd' }}>Pet Thường ({TIER_LABELS[currentTier]})</strong> không có Thẻ Kỹ Năng Đặc Biệt. Chiến đấu thuần bằng <strong>6 Ngọc Match-3</strong>, <strong>Thẻ Chưởng (160 Mana)</strong>, <strong>Hóa Thần</strong> &amp; <strong>Thẻ Hỗ Trợ</strong>!
                </div>
              )}
            </div>

            {/* Left Action Buttons: Ra trận / Ghép Mảnh & Nâng Cấp */}
            {isPetUnlocked ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 8 }}>
                <button
                  type="button"
                  className="pk-khopet-btn-gold"
                  disabled={isEquipped}
                  onClick={() => onSelectPet(basePet.id)}
                >
                  {isEquipped ? 'Đang Ra Trận' : 'Ra Trận'}
                </button>
                <button
                  type="button"
                  className="pk-khopet-btn-bars2"
                  disabled={!canAffordUpgrade}
                  onClick={handleTriggerUpgrade}
                >
                  {isMaxLevel ? `👑 MAX Lv.${MAX_PET_LEVEL}` : `NÂNG Lv.${currentLv + 1} (${upGold}V)`}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className="pk-khopet-btn-gold"
                  style={{ fontSize: 11.5 }}
                  disabled={shardCount < SHARD_UNLOCK_COST}
                  onClick={handleShardUnlock}
                >
                  🧩 Ghép ({shardCount}/{SHARD_UNLOCK_COST})
                </button>
                <button
                  type="button"
                  className="pk-khopet-btn-bars2"
                  style={{ fontSize: 11.5 }}
                  disabled={progress.gold < GOLD_UNLOCK_COST}
                  onClick={handleGoldUnlock}
                >
                  Chiêu Mộ ({GOLD_UNLOCK_COST}V)
                </button>
              </div>
            )}
          </div>

          {/* CENTER SHOWCASE: POKIWAR 4.0 LINEAGE HEADER + PEDESTAL STAGE + ELEMENT TABS */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: 0,
            }}
          >
            {/* Pokiwar 4.0 Standalone Pet Quality & Synthesis Lineage Bar */}
            <div
              className="pk-stone-panel"
              style={{
                width: '100%',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #b45309, #eab308)',
                    border: '1px solid #fef08a',
                    fontSize: 10.5,
                    fontWeight: 900,
                    color: '#fff',
                  }}
                >
                  {TIER_LABELS[basePet.tier]}
                </span>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#fde047' }}>
                  ⭐ {starCount}/6 Sao (+{(starCount - 1) * 8}% Chỉ số)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {requiredMaterialPet && recipe && (
                  <button
                    type="button"
                    onClick={() => setInspectId(requiredMaterialPet.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 7px',
                      borderRadius: 7,
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid #38bdf8',
                      color: '#bae6fd',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                    title="Xem Pet phôi nguyên liệu"
                  >
                    <img
                      src={getPetSpritePath(requiredMaterialPet)}
                      alt={requiredMaterialPet.name}
                      style={{ width: 22, height: 22, objectFit: 'contain' }}
                    />
                    <span>
                      Phôi: {requiredMaterialPet.name} Lv.{recipe.requiredPetLevel}
                    </span>
                  </button>
                )}
                {derivedPets.slice(0, 2).map((dp) => (
                  <button
                    key={dp.id}
                    type="button"
                    onClick={() => {
                      setInspectId(dp.id);
                      setActiveTab('EVOLVE_TREE');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 7px',
                      borderRadius: 7,
                      background: 'rgba(234, 179, 8, 0.18)',
                      border: '1px solid #fde047',
                      color: '#fef08a',
                      fontSize: 10,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                    title={`Hợp lên Pet độc lập: ${dp.name}`}
                  >
                    <img
                      src={getPetSpritePath(dp)}
                      alt={dp.name}
                      style={{ width: 22, height: 22, objectFit: 'contain' }}
                    />
                    <span>Hợp → {dp.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pet Pedestal Stage */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src="/assets/pokiguard/sprites/glow_soft_0.png"
                alt=""
                style={{
                  position: 'absolute',
                  width: 310,
                  height: 310,
                  objectFit: 'contain',
                  opacity: 0.45,
                  pointerEvents: 'none',
                }}
              />

              <SpineStageCanvas
                width={540}
                height={286}
                mode="SINGLE"
                mySpriteId={currentSpriteId}
                myElement={currentPet.element}
                myAuraColorHex={activeAura?.colorHex}
                scaleMultiplier={1.06}
              />

              {/* Next Lv Rate Pill + Tích Lũy May Mắn 4.0 */}
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  padding: '5px 9px',
                  borderRadius: 9,
                  background: 'rgba(7, 25, 72, 0.88)',
                  border: '1.5px solid #48c9ff',
                  fontSize: 10.5,
                }}
              >
                <div style={{ color: '#cbd5e1' }}>
                  {isMaxLevel ? (
                    <strong style={{ color: '#fde047' }}>👑 Đã đạt cấp tối đa Lv.{MAX_PET_LEVEL}/{MAX_PET_LEVEL}!</strong>
                  ) : (
                    <>
                      Lv.{currentLv + 1}: <strong style={{ color: '#4ade80' }}>LC {nextLvPower}</strong>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 9.5, color: '#fde047', fontWeight: 800 }}>
                  Tích lũy xịt: +{accLuck}% • Gen T2: Lv.{genLevel}/5 • Đột Phá: +{petBtLevel}/5
                </div>
                <div style={{ fontSize: 9.5, color: isMaxLevel ? '#fde047' : '#86efac', fontWeight: 700 }}>
                  {isMaxLevel
                    ? 'Nâng Sao, Gen T2 & Đột Phá để tăng lực chiến!'
                    : upgradeRate >= 100
                      ? 'An toàn 100% — Chắc chắn lên cấp!'
                      : '🛡️ Thất bại KHÔNG tụt cấp (+10% tích lũy)'}
                </div>
              </div>

              {nextStarPet && (
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    padding: '5px 9px',
                    borderRadius: 9,
                    background: 'rgba(7, 25, 72, 0.88)',
                    border: '1.5px solid #fde047',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 900, color: '#fef08a' }}>
                    ⭐ SIÊU TIẾN HÓA {starCount + 1}★
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 900, color: '#4ade80', marginTop: 2 }}>
                    LC {computePetPower(nextStarPet)}
                  </div>
                  <div style={{ fontSize: 9, color: '#93c5fd' }}>
                    Cần {nextStarShardCost} Mảnh
                  </div>
                </div>
              )}

              {/* LevelChip (bars-01) */}
              <div
                className="pk-khopet-stat-bar"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: 220,
                  height: 28,
                  justifyContent: 'center',
                  gap: 7,
                }}
              >
                <span className="pk-num-font" style={{ fontSize: 13, color: '#ffe08a' }}>
                  Lv {currentLv}/{MAX_PET_LEVEL}
                </span>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span className="pk-num-font" style={{ fontSize: 13, color: isMaxLevel ? '#fde047' : '#4ade80' }}>
                  {isMaxLevel ? 'MAX' : `${upgradeRate}%`}
                </span>
                {(genLevel >= 3 || basePet.passiveSkill?.kind === 'HOI_SINH') && (
                  <span style={{ fontSize: 11, color: '#fb7185', fontWeight: 900 }}>❤️ Hồi Sinh</span>
                )}
              </div>

              {feedback && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 44,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '7px 16px',
                    borderRadius: 999,
                    background: feedback.ok ? 'rgba(20, 83, 45, 0.94)' : 'rgba(127, 29, 29, 0.94)',
                    border: `2px solid ${feedback.ok ? '#4ade80' : '#f87171'}`,
                    fontWeight: 900,
                    fontSize: 12.5,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.75)',
                    zIndex: 10,
                  }}
                >
                  {feedback.text}
                </div>
              )}
            </div>

            {/* Tier Filter + Element Filter Tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                {TIER_FILTER_TABS.map((tf) => {
                  const active = tierFilter === tf.key;
                  return (
                    <button
                      key={tf.key}
                      type="button"
                      className={active ? 'pk-btn-gold' : 'pk-btn-blue'}
                      style={{ padding: '2px 7px', fontSize: 9.5 }}
                      onClick={() => setTierFilter(tf.key)}
                    >
                      {tf.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {ELEMENT_TABS.map((t) => {
                  const active = elementFilter === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setElementFilter(t.key)}
                      style={{
                        position: 'relative',
                        height: 32,
                        minWidth: 60,
                        padding: '0 8px',
                        backgroundImage: `url('/assets/pokiguard/sprites/${active ? 'tab_active.png' : 'buttons-02_0.png'}')`,
                        backgroundSize: '100% 100%',
                        backgroundColor: 'transparent',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        color: active ? '#fef08a' : '#e2e8f0',
                        fontSize: 10,
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      {t.icon && <img src={t.icon} alt={t.label} style={{ width: 16, height: 16 }} />}
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL (panel_stone): SIÊU TIẾN HÓA 6★ + NÂNG GEN T2 + XẾP NHANH ĐÁ ĐẬP LEVEL */}
          <div className="pk-khopet-stone-panel">
            {/* Top BtnUpStar (1★ -> 6★) & Gen T2 Upgrade */}
            {!isPetUnlocked ? (
              recipe && requiredMaterialPet ? (
                <button
                  type="button"
                  className="pk-khopet-btn-gold"
                  style={{ width: '100%', height: 38, fontSize: 11 }}
                  onClick={() => setActiveTab('EVOLVE_TREE')}
                >
                  ⚗️ HỢP PET TỪ {requiredMaterialPet.name.toUpperCase()} Lv.{recipe.requiredPetLevel}
                </button>
              ) : (
                <div className="pk-khopet-stat-bar" style={{ justifyContent: 'center', borderColor: '#f87171' }}>
                  <span style={{ fontWeight: 900, fontSize: 11, color: '#fca5a5' }}>
                    🔒 PET CHƯA MỞ KHÓA ({shardCount}/30 MẢNH)
                  </span>
                </div>
              )
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  type="button"
                  className="pk-khopet-btn-gold"
                  style={{ height: 36, fontSize: 10 }}
                  disabled={!canAffordStarUpgrade}
                  onClick={handleTriggerStarUpgrade}
                  title="Siêu Tiến Hóa Nâng Sao 1★→6★ (+8% toàn chỉ số mỗi sao)"
                >
                  {starCount < 6
                    ? `⭐ ${starCount + 1}★ (${shardCount}/${nextStarShardCost}M)`
                    : '🌟 MAX 6★'}
                </button>
                <button
                  type="button"
                  className="pk-btn-blue"
                  style={{ height: 36, fontSize: 10, padding: '0 6px' }}
                  disabled={!canAffordGenUpgrade}
                  onClick={handleTriggerGenUpgrade}
                  title="Nâng Cấp Gen T2 (Gen Lv.3+ mở Tim Hồi Sinh trong trận!)"
                >
                  {genLevel < 5
                    ? `🧬 Gen ${genLevel + 1} (${genCores}/${nextGenCoreCost}G)`
                    : '🧬 MAX GEN 5'}
                </button>
                <button
                  type="button"
                  className="pk-btn-gold"
                  style={{
                    gridColumn: '1 / -1',
                    height: 30,
                    fontSize: 10,
                    padding: '0 8px',
                    background: 'linear-gradient(90deg, #7e22ce, #db2777)',
                    borderColor: '#fde047',
                    color: '#fef08a',
                  }}
                  disabled={!canAffordPetBreakthrough}
                  onClick={handleTriggerPetBreakthrough}
                  title="Đột Phá Pet Pokiwar 4.0 (+8% Toàn Chỉ Số & +3 Tốc mỗi cấp!)"
                >
                  {petBtLevel < 5
                    ? `⚡ ĐỘT PHÁ PET +${petBtLevel + 1} (${nextBtShardCost}M • ${nextBtGenCost}Gen • ${nextBtGoldCost}V)`
                    : '👑 ĐỘT PHÁ TỐI ĐA (+5 • +40% CHỈ SỐ)'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#ffe08a' }}>
                ĐÁ ĐẬP LEVEL ({totalStackedCount}/{MAX_UPGRADE_STONE_SLOTS} ô)
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="pk-btn-gold"
                  style={{ padding: '2px 7px', fontSize: 9.5 }}
                  onClick={handleQuickStackStones}
                  title="Tự động lắp tối đa 3 viên đá để tối ưu tỉ lệ lên cấp!"
                >
                  ⚡ Xếp Nhanh
                </button>
                {selectedStoneLv < 5 && (
                  <button
                    type="button"
                    className="pk-btn-blue"
                    style={{ padding: '2px 6px', fontSize: 9.5 }}
                    disabled={selectedStoneCount < 3}
                    onClick={() => {
                      const ok = onCombineStones?.(selectedStoneLv - 1);
                      if (ok) {
                        setFeedback({
                          ok: true,
                          text: `Ghép 3 Đá C${selectedStoneLv} → 1 Đá C${selectedStoneLv + 1}!`,
                        });
                        setTimeout(() => setFeedback(null), 2000);
                      }
                    }}
                  >
                    Ghép C{selectedStoneLv + 1}
                  </button>
                )}
              </div>
            </div>

            {/* StoneStrip 2x3 Grid (Click to socket stone into 3 slots; live per-stone rate decays by Pet Lv) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((lv) => {
                const qty = stoneBag[lv - 1] ?? 0;
                const usedCnt = effectiveStack[lv - 1] ?? 0;
                const singleRate = getSingleStoneUpgradeRate(currentLv, lv);
                return (
                  <button
                    key={lv}
                    type="button"
                    className={`pk-stone-card ${usedCnt > 0 || selectedStoneLv === lv ? 'selected' : ''}`}
                    style={{ position: 'relative', padding: '4px 3px' }}
                    onClick={() => handleInsertStone(lv)}
                    title={`Nhấn để lắp Đá C${lv} (+${singleRate}% ở Lv.${currentLv}) vào 1 trong 3 ô đá`}
                  >
                    {usedCnt > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 3,
                          fontSize: 9,
                          fontWeight: 900,
                          padding: '0 4px',
                          borderRadius: 999,
                          background: '#16a34a',
                          color: '#fff',
                        }}
                      >
                        ×{usedCnt}
                      </span>
                    )}
                    <img
                      src={`/assets/pokiguard/sprites/stone_${stoneKey}_${lv}.png`}
                      alt={`Đá Lv${lv}`}
                      style={{ width: 28, height: 28, objectFit: 'contain' }}
                    />
                    <span className="pk-num-font" style={{ fontSize: 10, color: '#ffe08a', lineHeight: 1.1 }}>
                      C{lv} • x{qty}
                    </span>
                    <span style={{ fontSize: 9.2, fontWeight: 900, color: isMaxLevel ? '#94a3b8' : '#4ade80', lineHeight: 1 }}>
                      {isMaxLevel ? 'MAX' : `+${singleRate}%`}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className="pk-stone-card"
                style={{ padding: '4px 3px' }}
                onClick={() => setSockets([null, null, null])}
                title="Tháo toàn bộ đá khỏi 3 ô lắp"
              >
                <span style={{ fontSize: 16 }}>🧹</span>
                <span style={{ fontSize: 9.5, fontWeight: 900, color: '#93c5fd' }}>Tháo Hết</span>
              </button>
            </div>

            {/* 3-Stone Socket Bar (Lắp tối đa 3 viên đá — nhấn vào ô để tháo) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
              {effectiveSockets.map((slottedLv, slotIdx) => {
                const slotRate = slottedLv !== null ? getSingleStoneUpgradeRate(currentLv, slottedLv) : 0;
                return (
                  <button
                    key={slotIdx}
                    type="button"
                    onClick={() => slottedLv !== null && handleRemoveSocket(slotIdx)}
                    style={{
                      position: 'relative',
                      height: 54,
                      borderRadius: 9,
                      border: slottedLv !== null ? '2px solid #4ade80' : '1.5px dashed rgba(56, 189, 248, 0.55)',
                      background: slottedLv !== null ? 'rgba(20, 83, 45, 0.52)' : 'rgba(6, 18, 46, 0.78)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      padding: '3px 4px',
                      cursor: slottedLv !== null ? 'pointer' : 'default',
                      color: '#fff',
                    }}
                    title={
                      slottedLv !== null
                        ? `Ô Đá ${slotIdx + 1}: Đá C${slottedLv} (+${slotRate}%) — Nhấn để tháo`
                        : `Ô Đá ${slotIdx + 1} trống — Chọn đá ở trên để lắp`
                    }
                  >
                    {slottedLv !== null ? (
                      <>
                        <span
                          style={{
                            position: 'absolute',
                            top: 1,
                            right: 4,
                            fontSize: 9,
                            fontWeight: 900,
                            color: '#fca5a5',
                          }}
                        >
                          ×
                        </span>
                        <img
                          src={`/assets/pokiguard/sprites/stone_${stoneKey}_${slottedLv}.png`}
                          alt={`Đá C${slottedLv}`}
                          style={{ width: 24, height: 24, objectFit: 'contain' }}
                        />
                        <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fef08a', lineHeight: 1.05 }}>
                          C{slottedLv}{' '}
                          <span style={{ color: '#4ade80' }}>+{slotRate}%</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 14, color: '#38bdf8', fontWeight: 900, lineHeight: 1 }}>+</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8' }}>Ô Đá {slotIdx + 1}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom BtnStone: 3-Stone Socket Level Up (No downgrade on fail) */}
            <button
              type="button"
              className="pk-khopet-btn-bars2"
              style={{ width: '100%', height: 42 }}
              disabled={!canAffordUpgrade}
              onClick={handleTriggerUpgrade}
            >
              {isMaxLevel
                ? `👑 ĐÃ ĐẠT LEVEL TỐI ĐA (Lv.${MAX_PET_LEVEL}/${MAX_PET_LEVEL})`
                : totalStackedCount > 0
                  ? `ĐẬP LEVEL Lv.${currentLv + 1} (${totalStackedCount}/3 Đá • ${upgradeRate}% • ${upGold}V)`
                  : `LẮP 1–3 VIÊN ĐÁ ĐỂ ĐẬP Lv.${currentLv + 1} (${upGold}V)`}
            </button>
          </div>
        </div>
        ) : (
          /* TAB 2: TẾ ĐÀN HỢP PET ĐỘC LẬP & GHÉP MẢNH / NÂNG SAO (CHUẨN POKIWAR ZING ME 4.0) */
          <div
            className="pk-stone-panel"
            style={{
              flex: 1,
              minHeight: 0,
              padding: '12px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            {/* Header Bar of Synthesis Altar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={ELEMENT_META[basePet.element].iconPath} alt={basePet.element} style={{ width: 28, height: 28 }} />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#fef08a' }}>
                    {basePet.name} — {basePet.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#93c5fd', fontWeight: 700 }}>
                    Phẩm chất:{' '}
                    <strong style={{ color: '#fde047' }}>{TIER_LABELS[basePet.tier]}</strong> • Trạng thái:{' '}
                    <strong style={{ color: isPetUnlocked ? '#4ade80' : '#fca5a5' }}>
                      {isPetUnlocked
                        ? `Đã sở hữu (Lv.${currentLv} • ${starCount}★ Siêu Tiến Hóa)`
                        : `Chưa mở khóa (${shardCount}/${SHARD_UNLOCK_COST} Mảnh)`}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isPetUnlocked && (
                  <button
                    type="button"
                    className="pk-btn-gold"
                    style={{ padding: '7px 14px', fontSize: 12 }}
                    disabled={isEquipped}
                    onClick={() => onSelectPet(basePet.id)}
                  >
                    {isEquipped ? 'Đang Ra Trận' : 'Chọn Ra Trận'}
                  </button>
                )}
              </div>
            </div>

            {/* Pokiwar 4.0 Independent Pet Synthesis Lineage Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.2fr 1.4fr',
                gap: 12,
                alignItems: 'stretch',
              }}
            >
              {/* Card 1: Required Material Pet (Phôi Nguyên Liệu) */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(5, 16, 48, 0.88)',
                  border: '1.5px solid rgba(56, 189, 248, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 900,
                    padding: '2px 10px',
                    borderRadius: 999,
                    background: '#0284c7',
                    color: '#fff',
                  }}
                >
                  1. PHÔI HỢP PET YÊU CẦU
                </span>

                {requiredMaterialPet && recipe ? (
                  <>
                    <img
                      src={getPetSpritePath(requiredMaterialPet)}
                      alt={requiredMaterialPet.name}
                      style={{ width: 78, height: 78, objectFit: 'contain', cursor: 'pointer' }}
                      onClick={() => setInspectId(requiredMaterialPet.id)}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#fef08a' }}>
                        {requiredMaterialPet.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: hasMaterialPet && materialPetLv >= recipe.requiredPetLevel ? '#4ade80' : '#fca5a5',
                        }}
                      >
                        {hasMaterialPet
                          ? `Đang có: Lv.${materialPetLv}/${recipe.requiredPetLevel}`
                          : `Chưa sở hữu (Cần Lv.${recipe.requiredPetLevel})`}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="pk-btn-blue"
                      style={{ padding: '4px 10px', fontSize: 10.5 }}
                      onClick={() => setInspectId(requiredMaterialPet.id)}
                    >
                      🔍 Xem Pet Phôi
                    </button>
                  </>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      color: '#93c5fd',
                      fontSize: 11.5,
                      padding: '8px',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>🥚</div>
                    <strong>Pet Khởi Nguyên Độc Lập</strong>
                    <span style={{ fontSize: 10.5, color: '#cbd5e1', marginTop: 2 }}>
                      Nhận từ Tân Thủ, Ghép 30 Mảnh hoặc Đập Trứng Thần Thú
                    </span>
                  </div>
                )}
              </div>

              {/* Card 2: Current Standalone Pet */}
              <div
                style={{
                  position: 'relative',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.25), rgba(15, 23, 42, 0.94))',
                  border: '2px solid #fde047',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 900,
                    padding: '2px 10px',
                    borderRadius: 999,
                    background: '#ca8a04',
                    color: '#fff',
                  }}
                >
                  2. PET ĐỘC LẬP: {basePet.name.toUpperCase()}
                </span>

                <div style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src="/assets/pokiguard/sprites/haoquang.png"
                    alt=""
                    style={{ position: 'absolute', width: 96, height: 96, opacity: 0.65, animation: 'spinSlow 12s linear infinite' }}
                  />
                  <img
                    src={getPetSpritePath(basePet)}
                    alt={basePet.name}
                    style={{ position: 'relative', width: 84, height: 84, objectFit: 'contain' }}
                  />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 2 }}>
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <img
                        key={idx}
                        src="/assets/pokiguard/sprites/gold_star.png"
                        alt="*"
                        style={{ width: 15, height: 15, opacity: idx < starCount ? 1 : 0.25 }}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 900, color: '#4ade80' }}>
                    LC {currentPower.toLocaleString()} • HP {currentPet.maxHp} • Công {currentPet.attack}
                  </div>
                  <div style={{ fontSize: 10, color: '#fde047', fontWeight: 700 }}>
                    Ngoại hình cố định chuẩn Pokiwar 4.0 (ID #{basePet.spriteId})
                  </div>
                </div>
              </div>

              {/* Card 3: Higher-tier Standalone Pets Synthesized From This Pet */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(5, 16, 48, 0.88)',
                  border: '1.5px solid rgba(250, 204, 21, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 900,
                      padding: '2px 10px',
                      borderRadius: 999,
                      background: '#7c3aed',
                      color: '#fff',
                    }}
                  >
                    3. HỢP LÊN PET ĐỜI CAO HƠN ({derivedPets.length})
                  </span>
                </div>

                {derivedPets.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, derivedPets.length)}, minmax(0, 1fr))`, gap: 8, flex: 1, alignItems: 'center' }}>
                    {derivedPets.slice(0, 3).map((dp) => {
                      const dpUnlocked = unlockedPets.includes(dp.id);
                      return (
                        <button
                          key={dp.id}
                          type="button"
                          onClick={() => setInspectId(dp.id)}
                          style={{
                            padding: '6px 4px',
                            borderRadius: 9,
                            background: dpUnlocked ? 'rgba(20, 83, 45, 0.45)' : 'rgba(15, 23, 42, 0.85)',
                            border: dpUnlocked ? '1.5px solid #4ade80' : '1.5px dashed #38bdf8',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 3,
                            cursor: 'pointer',
                            color: '#fff',
                          }}
                        >
                          <img src={getPetSpritePath(dp)} alt={dp.name} style={{ width: 52, height: 52, objectFit: 'contain' }} />
                          <span style={{ fontSize: 10, fontWeight: 900, color: '#fef08a', textAlign: 'center', lineHeight: 1.15 }}>
                            {dp.name}
                          </span>
                          <span style={{ fontSize: 9, color: '#7dd3fc', fontWeight: 800 }}>
                            Cần Lv.{dp.synthesisRecipe?.requiredPetLevel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      color: '#fde047',
                      fontSize: 11.5,
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 4 }}>👑</div>
                    <strong>Thần Thú Đỉnh Cao Pokiwar 4.0</strong>
                    <span style={{ fontSize: 10.5, color: '#cbd5e1', marginTop: 2 }}>
                      Tập trung Đập Level bằng Đá &amp; Siêu Tiến Hóa lên 5★!
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Split: Tế Đàn Hợp Pet Triệu Hồi + Ghép Mảnh / Siêu Tiến Hóa Nâng Sao */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr', gap: 14, alignItems: 'stretch' }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(6, 20, 56, 0.88)',
                  border: '1.5px solid #38bdf8',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 900, color: '#fde047' }}>
                  ⚗️ TẾ ĐÀN HỢP PET TRIỆU HỒI ({basePet.name.toUpperCase()})
                </div>
                {recipe && requiredMaterialPet ? (
                  <>
                    <div style={{ fontSize: 11.5, color: '#e2e8f0', lineHeight: 1.45 }}>
                      Công thức Hợp Pet chuẩn Zing Me:{' '}
                      <strong style={{ color: hasMaterialPet && materialPetLv >= recipe.requiredPetLevel ? '#4ade80' : '#fca5a5' }}>
                        {requiredMaterialPet.name} đạt Lv.{recipe.requiredPetLevel} (Đang Lv.{materialPetLv})
                      </strong>{' '}
                      +{' '}
                      <strong style={{ color: recipeStoneHave >= recipe.stoneCount ? '#7dd3fc' : '#fca5a5' }}>
                        {recipe.stoneCount} Đá Cấp {recipe.stoneLevel} (Có {recipeStoneHave})
                      </strong>{' '}
                      +{' '}
                      <strong style={{ color: progress.gold >= recipe.goldCost ? '#fde047' : '#fca5a5' }}>
                        {recipe.goldCost.toLocaleString()} Vàng
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="pk-khopet-btn-bars2"
                      style={{ width: '100%', height: 42 }}
                      disabled={isPetUnlocked || !canSynthesizeNow}
                      onClick={handleTriggerSynthesize}
                    >
                      {isPetUnlocked
                        ? `✅ ĐÃ TRIỆU HỒI ${basePet.name.toUpperCase()}`
                        : `⚗️ HỢP PET TRIỆU HỒI ${basePet.name.toUpperCase()}`}
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.45 }}>
                    <strong style={{ color: '#4ade80' }}>{basePet.name}</strong> là Pet Khởi Nguyên độc lập (không cần Pet phôi).
                    Hãy dùng Đá Ngũ Hành để nâng Level cho {basePet.name} làm phôi hợp lên các Thần Thú Mega!
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(6, 20, 56, 0.88)',
                  border: '1.5px solid #fbbf24',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 900, color: '#fde047' }}>
                    {isPetUnlocked
                      ? `⭐ SIÊU TIẾN HÓA NÂNG SAO (${starCount}★ → ${Math.min(6, starCount + 1)}★)`
                      : `🧩 SĂN PET & GHÉP MẢNH (${basePet.name})`}
                  </span>
                  <span className="pk-num-font" style={{ fontSize: 13, color: '#4ade80' }}>
                    {shardCount} Mảnh • {
                      dropStages.length > 0 ? dropStages[0].islandName : 'Đập Trứng / Lật Thẻ'
                    }
                  </span>
                </div>

                {feedback && (
                  <div style={{ fontSize: 11.5, fontWeight: 900, color: feedback.ok ? '#4ade80' : '#fda4af' }}>
                    {feedback.text}
                  </div>
                )}

                {!isPetUnlocked ? (
                  <>
                    <div style={{ width: '100%', height: 10, borderRadius: 999, background: '#020617', border: '1px solid rgba(250, 204, 21, 0.45)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.round((shardCount / SHARD_UNLOCK_COST) * 100))}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #38bdf8, #fde047)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="pk-btn-gold"
                        style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                        disabled={shardCount < SHARD_UNLOCK_COST}
                        onClick={handleShardUnlock}
                      >
                        🧩 Ghép 30 Mảnh → Mở Khóa
                      </button>
                      <button
                        type="button"
                        className="pk-btn-blue"
                        style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                        disabled={progress.gold < GOLD_UNLOCK_COST}
                        onClick={handleGoldUnlock}
                      >
                        💰 Chiêu Mộ Nhanh ({GOLD_UNLOCK_COST.toLocaleString()}V)
                      </button>
                    </div>
                  </>
                ) : starCount < 6 && nextStarPet ? (
                  <>
                    <div style={{ fontSize: 11.5, color: '#e2e8f0' }}>
                      Nâng lên <strong style={{ color: '#fde047' }}>{starCount + 1}★</strong> (+8% toàn chỉ số, giữ nguyên ngoại hình):{' '}
                      HP <strong style={{ color: '#4ade80' }}>{currentPet.maxHp} → {nextStarPet.maxHp}</strong> • Công{' '}
                      <strong style={{ color: '#fb923c' }}>{currentPet.attack} → {nextStarPet.attack}</strong>
                    </div>
                    <button
                      type="button"
                      className="pk-btn-gold"
                      style={{ width: '100%', padding: '8px 12px', fontSize: 12 }}
                      disabled={!canAffordStarUpgrade}
                      onClick={handleTriggerStarUpgrade}
                    >
                      ⭐ Siêu Tiến Hóa {starCount + 1}★ ({shardCount}/{nextStarShardCost} Mảnh • {nextStarGoldCost.toLocaleString()}V)
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#4ade80' }}>
                    🌟 {basePet.name} đã đạt 6★ Siêu Tiến Hóa tối đa!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM FULL-WIDTH POKIGUARD PET DOCK (list_bg + ArrowLeft/Right) */}
        <div className="pk-khopet-dock">
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2 }}
            onClick={() => scrollDock(-340)}
            title="Cuộn trái"
          >
            <img src="/assets/pokiguard/sprites/icons-21_0.png" alt="Trái" style={{ width: 32, height: 48, objectFit: 'contain' }} />
          </button>

          <div
            ref={dockScrollRef}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              padding: '2px 2px',
            }}
          >
            {visiblePets.map((p) => {
              const lv = progress.petLevels[p.id] ?? 1;
              const pStars = Math.max(1, Math.min(6, petStars[p.id] ?? 1));
              const unlocked = unlockedPets.includes(p.id);
              const shards = petShards[p.id] ?? 0;
              const equipped = progress.selectedPetId === p.id;
              const selected = inspectId === p.id;
              const tBadge = TIER_BADGE_STYLE[p.tier] ?? TIER_BADGE_STYLE.BASE;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setInspectId(p.id)}
                  style={{
                    position: 'relative',
                    minWidth: 112,
                    height: 92,
                    padding: '4px 6px',
                    borderRadius: 10,
                    border: selected ? '2.5px solid #fde047' : unlocked ? '1.5px solid #38bdf8' : '1.5px solid #475569',
                    background: selected
                      ? 'linear-gradient(180deg, rgba(37, 99, 235, 0.82), rgba(10, 26, 70, 0.96))'
                      : 'linear-gradient(180deg, rgba(8, 28, 72, 0.9), rgba(4, 14, 38, 0.96))',
                    boxShadow: selected ? '0 0 14px rgba(250, 204, 21, 0.65)' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={ELEMENT_META[p.element].iconPath}
                    alt={p.element}
                    style={{ position: 'absolute', top: 3, left: 4, width: 15, height: 15 }}
                  />
                  {equipped ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        right: 4,
                        fontSize: 8,
                        fontWeight: 900,
                        padding: '1px 4px',
                        borderRadius: 4,
                        background: '#16a34a',
                        color: '#fff',
                      }}
                    >
                      XUẤT
                    </span>
                  ) : !unlocked ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        right: 4,
                        fontSize: 8,
                        fontWeight: 900,
                        padding: '1px 4px',
                        borderRadius: 4,
                        background: 'rgba(127, 29, 29, 0.92)',
                        border: '1px solid #f87171',
                        color: '#fecdd3',
                      }}
                    >
                      🔒 {shards}/30
                    </span>
                  ) : (
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        right: 4,
                        fontSize: 8,
                        fontWeight: 900,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: tBadge.bg,
                        color: tBadge.color,
                        border: '1px solid rgba(255,255,255,0.28)',
                      }}
                    >
                      {tBadge.tag}
                    </span>
                  )}
                  <img
                    src={getPetSpritePath(p)}
                    alt={p.name}
                    style={{
                      width: 56,
                      height: 52,
                      objectFit: 'contain',
                      marginTop: 3,
                      filter: unlocked ? undefined : 'grayscale(0.75) brightness(0.68)',
                    }}
                  />
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 900,
                        color: selected ? '#fef08a' : unlocked ? '#f8fafc' : '#94a3b8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: 9.2, color: unlocked ? '#93c5fd' : '#fca5a5', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {unlocked ? `Lv.${lv} • ${pStars}★` : `Mảnh ${shards}/30`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 2 }}
            onClick={() => scrollDock(340)}
            title="Cuộn phải"
          >
            <img src="/assets/pokiguard/sprites/icons-22_0.png" alt="Phải" style={{ width: 32, height: 48, objectFit: 'contain' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
