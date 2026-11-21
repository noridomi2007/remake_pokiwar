import {
  applyPetProgression,
  computePetPower,
  ELEMENT_META,
  getFieldElementModifier,
  getPetById,
  getPetSpritePath,
  type ElementType,
  type StageDef,
} from '@pokiwar/shared';
import { useMemo, useState } from 'react';
import type { PlayerProgress } from './MainLobby.js';

export interface ExpeditionBossDef {
  id: string;
  tier: 'NORMAL' | 'ELITE' | 'MYTHIC';
  order: number;
  name: string;
  petId: string;
  enemyScale: number;
  arenaBg: string;
  rewardGold: number;
  rewardGen: number;
  rewardShards: number;
  rewardPetId: string;
}

export const EXPEDITION_BOSSES: readonly ExpeditionBossDef[] = [
  {
    id: 'exp-1-1',
    tier: 'NORMAL',
    order: 1,
    name: 'Viễn Chinh I • Lôi Thần Icarus',
    petId: 'pet-mega-icarus',
    enemyScale: 1.55,
    arenaBg: '/assets/pokiguard/sprites/bg_isle_kim.png',
    rewardGold: 1800,
    rewardGen: 3,
    rewardShards: 12,
    rewardPetId: 'pet-mega-icarus',
  },
  {
    id: 'exp-1-2',
    tier: 'NORMAL',
    order: 2,
    name: 'Viễn Chinh I • Long Vương Worzu',
    petId: 'pet-2349',
    enemyScale: 1.75,
    arenaBg: '/assets/pokiguard/sprites/bg_isle_thuy.png',
    rewardGold: 2200,
    rewardGen: 4,
    rewardShards: 15,
    rewardPetId: 'pet-mega-twinfrost',
  },
  {
    id: 'exp-1-3',
    tier: 'NORMAL',
    order: 3,
    name: 'Viễn Chinh I • BOSS Mega Zidarose',
    petId: 'pet-mega-zidarose',
    enemyScale: 2.0,
    arenaBg: '/assets/pokiguard/sprites/boss_bg.png',
    rewardGold: 3000,
    rewardGen: 5,
    rewardShards: 18,
    rewardPetId: 'pet-mega-zidarose',
  },
  {
    id: 'exp-2-1',
    tier: 'ELITE',
    order: 1,
    name: 'Viễn Chinh II • Thánh Kỵ Elpidios',
    petId: 'pet-mega-elpidios',
    enemyScale: 2.1,
    arenaBg: '/assets/pokiguard/sprites/bg_isle_tho.png',
    rewardGold: 3200,
    rewardGen: 5,
    rewardShards: 18,
    rewardPetId: 'pet-mega-elpidios',
  },
  {
    id: 'exp-2-2',
    tier: 'ELITE',
    order: 2,
    name: 'Viễn Chinh II • Viêm Đế Humex',
    petId: 'pet-boss-humex',
    enemyScale: 2.3,
    arenaBg: '/assets/pokiguard/sprites/bg_isle_hoa.png',
    rewardGold: 3800,
    rewardGen: 6,
    rewardShards: 20,
    rewardPetId: 'pet-galaxy-aquar',
  },
  {
    id: 'exp-2-3',
    tier: 'ELITE',
    order: 3,
    name: 'Viễn Chinh II • BOSS Dragon Knight',
    petId: 'pet-galaxy-dragon-knight',
    enemyScale: 2.55,
    arenaBg: '/assets/pokiguard/sprites/boss_bg.png',
    rewardGold: 4600,
    rewardGen: 8,
    rewardShards: 24,
    rewardPetId: 'pet-galaxy-dragon-knight',
  },
  {
    id: 'exp-3-1',
    tier: 'MYTHIC',
    order: 1,
    name: 'Viễn Chinh III • Shadow Sword',
    petId: 'pet-galaxy-shadow-sword',
    enemyScale: 2.75,
    arenaBg: '/assets/pokiguard/sprites/bg_legend.png',
    rewardGold: 5200,
    rewardGen: 9,
    rewardShards: 24,
    rewardPetId: 'pet-galaxy-shadow-sword',
  },
  {
    id: 'exp-3-2',
    tier: 'MYTHIC',
    order: 2,
    name: 'Viễn Chinh III • Fantasy Joker',
    petId: 'pet-fantasy-joker',
    enemyScale: 2.95,
    arenaBg: '/assets/pokiguard/sprites/bg_legend.png',
    rewardGold: 6200,
    rewardGen: 10,
    rewardShards: 28,
    rewardPetId: 'pet-fantasy-joker',
  },
  {
    id: 'exp-3-3',
    tier: 'MYTHIC',
    order: 3,
    name: 'Viễn Chinh III • SIÊU BOSS Spetra',
    petId: 'pet-boss-spetra',
    enemyScale: 3.25,
    arenaBg: '/assets/pokiguard/sprites/boss_bg.png',
    rewardGold: 8500,
    rewardGen: 14,
    rewardShards: 35,
    rewardPetId: 'pet-primal-orithyia',
  },
];

const ELEMENTS_ROTATION: readonly ElementType[] = ['HOA', 'THUY', 'MOC', 'KIM', 'THO'];
const ROW_LABELS = ['Tiền Tuyến (+20% Thủ)', 'Trung Tuyến (+10% Toàn Diện)', 'Hậu Tuyến (+18% Công/Phép)'] as const;

export interface Poki40CampaignModalProps {
  progress: PlayerProgress;
  initialTab?: 'EXPEDITION' | 'TREASURE' | 'ANCIENT_ARENA';
  onClose: () => void;
  onStartExpeditionBoss: (boss: ExpeditionBossDef, stage: StageDef) => void;
  onClaimExpeditionChest: (boss: ExpeditionBossDef) => { success: boolean; message: string };
  onResetExpeditionSeason: () => { success: boolean; message: string };
  onStartTreasureGuard: (kind: 'ARCHON' | 'STORM', stage: StageDef) => void;
  onClaimTreasureChest: (chest: 'SILVER' | 'GOLD') => { success: boolean; message: string };
  onSaveAncientPreset: (presetIdx: number, grid: (string | null)[]) => void;
  onFinishAncientMatch: (won: boolean, glory: number, gold: number, eloDelta: number, opponentName: string) => void;
}

export function Poki40CampaignModal({
  progress,
  initialTab = 'EXPEDITION',
  onClose,
  onStartExpeditionBoss,
  onClaimExpeditionChest,
  onResetExpeditionSeason,
  onStartTreasureGuard,
  onClaimTreasureChest,
  onSaveAncientPreset,
  onFinishAncientMatch,
}: Poki40CampaignModalProps) {
  const [tab, setTab] = useState<'EXPEDITION' | 'TREASURE' | 'ANCIENT_ARENA'>(initialTab);
  const [expTier, setExpTier] = useState<'NORMAL' | 'ELITE' | 'MYTHIC'>('NORMAL');
  const [notice, setNotice] = useState<string | null>(null);

  // Ancient 3x3 Arena State
  const [presetIdx, setPresetIdx] = useState(0);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [ancientLog, setAncientLog] = useState<string[]>([]);
  const [ancientResult, setAncientResult] = useState<{ won: boolean; summary: string } | null>(null);

  const todayIdx = new Date().getDate() % ELEMENTS_ROTATION.length;
  const fieldElement: ElementType = ELEMENTS_ROTATION[todayIdx] ?? 'HOA';

  const unlockedPets = progress.unlockedPets ?? [progress.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'];
  const expCleared = progress.expeditionCleared ?? [];
  const expClaimed = progress.expeditionClaimedChests ?? [];
  const expLockedPets = progress.expeditionLockedPets ?? [];
  const activePet = getPetById(progress.selectedPetId);
  const fusionPet = progress.fusionPetId ? getPetById(progress.fusionPetId) : null;

  const isMainLocked = expLockedPets.includes(progress.selectedPetId);
  const isFusionLocked = Boolean(progress.fusionPetId && expLockedPets.includes(progress.fusionPetId));

  const treasureAttempts = progress.treasureIslandAttempts ?? 0;
  const archonKills = progress.treasureArchonKills ?? 0;
  const stormKills = progress.treasureStormKills ?? 0;
  const claimedTreasureChests = progress.treasureClaimedChests ?? [];

  const ancientElo = progress.ancientArenaElo ?? 1100;
  const ancientTurnsUsed = progress.ancientArenaTurns ?? 0;
  const presets = progress.ancientPresets ?? [
    [unlockedPets[0] ?? null, unlockedPets[1] ?? null, null, unlockedPets[2] ?? null, null, null, unlockedPets[3] ?? null, unlockedPets[4] ?? null, null],
    [unlockedPets[0] ?? null, null, unlockedPets[1] ?? null, null, unlockedPets[2] ?? null, null, unlockedPets[3] ?? null, null, unlockedPets[4] ?? null],
    [unlockedPets[0] ?? null, unlockedPets[1] ?? null, unlockedPets[2] ?? null, null, unlockedPets[3] ?? null, null, null, unlockedPets[4] ?? null, null],
  ];
  const currentGrid: (string | null)[] = useMemo(() => {
    const g = presets[presetIdx];
    if (g && g.length === 9) return [...g];
    return Array.from({ length: 9 }, (_, idx) => (idx < 5 ? unlockedPets[idx] ?? null : null));
  }, [presets, presetIdx, unlockedPets]);

  const placedCount = currentGrid.filter(Boolean).length;

  const computeGridPower = (grid: (string | null)[]) => {
    let total = 0;
    grid.forEach((pid, idx) => {
      if (!pid) return;
      const base = getPetById(pid);
      const lv = progress.petLevels[pid] ?? 1;
      const st = progress.petStars?.[pid] ?? 1;
      const gen = progress.petGenLevels?.[pid] ?? 0;
      const bt = progress.petBreakthroughs?.[pid] ?? 0;
      const unit = applyPetProgression(base, lv, base.tier, st, gen, bt);
      const row = Math.floor(idx / 3);
      const rowBonus = row === 0 ? 1.08 : row === 1 ? 1.1 : 1.15;
      const fieldMod = getFieldElementModifier(unit.element, fieldElement);
      total += Math.round(computePetPower(unit) * rowBonus * ((fieldMod.dmgMult + fieldMod.hpMult) / 2));
    });
    return total;
  };

  const handleAssignCell = (petId: string | null) => {
    if (selectedCell === null) return;
    const next = [...currentGrid];
    if (petId) {
      // Remove duplicate placement first
      const prevIdx = next.indexOf(petId);
      if (prevIdx !== -1 && prevIdx !== selectedCell) {
        next[prevIdx] = null;
      }
      if (!next[selectedCell] && next.filter(Boolean).length >= 5) {
        setNotice('⚠️ Tối đa 5 Pet trên bàn cờ 3×3! Hãy gỡ 1 ô trước khi thêm.');
        return;
      }
    }
    next[selectedCell] = petId;
    onSaveAncientPreset(presetIdx, next);
    setSelectedCell(null);
    setNotice(`🏛️ Đã cập nhật Đội Hình Cổ Đại #${presetIdx + 1}!`);
  };

  const handleFightAncientArena = () => {
    if (ancientTurnsUsed >= 10) {
      setNotice('⚠️ Bạn đã dùng hết 10/10 lượt Đấu Trường Cổ Đại hôm nay!');
      return;
    }
    if (placedCount < 3) {
      setNotice('⚠️ Cần xếp ít nhất 3 Pet lên sơ đồ 3×3 trước khi xuất chiến!');
      return;
    }
    const opponents = [
      { name: 'Thánh Sư Long Tộc', powerScale: 0.92, elo: ancientElo - 40 },
      { name: 'Chiến Thần Cổ Đại', powerScale: 1.02, elo: ancientElo + 25 },
      { name: 'Bá Chủ Ngũ Hành', powerScale: 1.12, elo: ancientElo + 80 },
    ];
    const pickedOpp = opponents[ancientTurnsUsed % opponents.length] ?? opponents[0];
    const myPower = computeGridPower(currentGrid);
    const enemyPower = Math.max(1800, Math.round(myPower * pickedOpp.powerScale * (0.9 + Math.random() * 0.22)));

    const logs: string[] = [];
    logs.push(`🌍 Hiệu Ứng Ngũ Hành Hôm Nay: Hệ ${ELEMENT_META[fieldElement].label} (+50% ST / +20% HP)!`);
    const frontCount = currentGrid.slice(0, 3).filter(Boolean).length;
    const midCount = currentGrid.slice(3, 6).filter(Boolean).length;
    const backCount = currentGrid.slice(6, 9).filter(Boolean).length;
    logs.push(`📐 Sơ đồ 3×3 của bạn: Tiền Tuyến (${frontCount}) • Trung Tuyến (${midCount}) • Hậu Tuyến (${backCount})`);

    const boostedUnits = currentGrid
      .filter((id): id is string => Boolean(id))
      .map((id) => getPetById(id))
      .filter((p) => p.element === fieldElement);
    if (boostedUnits.length > 0) {
      logs.push(`🔥 ${boostedUnits.map((u) => u.name).join(', ')} hưởng Buff Ngũ Hành +50% Sát Thương!`);
    }

    const tacticalBonus = frontCount >= 1 && backCount >= 1 ? 1.1 : 0.96;
    const finalMyScore = Math.round(myPower * tacticalBonus * (0.95 + Math.random() * 0.14));
    const won = finalMyScore >= enemyPower;
    const glory = won ? 180 : 65;
    const gold = won ? 1650 : 550;
    const eloDelta = won ? 28 : -14;

    logs.push(
      won
        ? `🏆 CHIẾN THẮNG ${pickedOpp.name}! (Điểm chiến thuật ${finalMyScore.toLocaleString()} vs ${enemyPower.toLocaleString()}) → +${glory} Xu Vinh Quang, +${gold}V, +${eloDelta} ELO!`
        : `💥 THẤT BẠI trước ${pickedOpp.name} (${finalMyScore.toLocaleString()} vs ${enemyPower.toLocaleString()}) → +${glory} Xu, +${gold}V, ${eloDelta} ELO.`,
    );
    setAncientLog(logs);
    setAncientResult({
      won,
      summary: won
        ? `🏆 THẮNG ${pickedOpp.name} (+${eloDelta} ELO • +${glory} Xu)`
        : `💥 THUA ${pickedOpp.name} (${eloDelta} ELO • +${glory} Xu)`,
    });
    onFinishAncientMatch(won, glory, gold, eloDelta, pickedOpp.name);
  };

  return (
    <div className="stage-modal-backdrop" onClick={onClose}>
      <div className="pk-modal" style={{ maxWidth: 960, maxHeight: 655 }} onClick={(e) => e.stopPropagation()}>
        <div className="pk-modal-header" style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {(
              [
                ['EXPEDITION', '🧭 Ải Viễn Chinh'],
                ['TREASURE', '🏝️ Đảo Châu Báu'],
                ['ANCIENT_ARENA', '🏛️ Đấu Trường Cổ Đại 3×3'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={tab === k ? 'pk-btn-gold' : 'pk-btn-blue'}
                style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }}
                onClick={() => {
                  setTab(k);
                  setNotice(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pk-ribbon-title" style={{ minWidth: 210, fontSize: 13.5 }}>
            CHIẾN DỊCH POKIWAR 4.0
          </div>
          <button type="button" className="pk-close-orb" aria-label="Đóng" onClick={onClose}>
            <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
          </button>
        </div>

        {notice && (
          <div
            className="pk-stone-panel"
            style={{ padding: '6px 12px', marginBottom: 8, borderColor: '#4ade80', color: '#fef08a', fontSize: 11.5, fontWeight: 900 }}
          >
            {notice}
          </div>
        )}

        {/* ==================== TAB 1: ẢI VIỄN CHINH (3 BOSS + KHÓA PET 1 LẦN/MÙA) ==================== */}
        {tab === 'EXPEDITION' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              className="pk-stone-panel"
              style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
            >
              <div style={{ fontSize: 11.5, color: '#e2e8f0' }}>
                🧭 <strong style={{ color: '#fde047' }}>Luật Khóa Pet 1 Lần/Mùa chuẩn 4.0:</strong> Pet Chiến (<strong>{activePet.name}</strong>)
                {fusionPet ? ` & Pet Hợp Thể (${fusionPet.name})` : ''} sau khi thắng Boss sẽ bị <strong style={{ color: '#fb7185' }}>🔒 Khóa</strong> tới hết mùa!
                <span style={{ color: '#93c5fd', marginLeft: 8 }}>Đã khóa: {expLockedPets.length} Pet</span>
              </div>
              <button
                type="button"
                className="pk-btn-blue"
                style={{ padding: '5px 10px', fontSize: 10.5, whiteSpace: 'nowrap' }}
                onClick={() => {
                  const res = onResetExpeditionSeason();
                  setNotice(res.message);
                }}
              >
                🔄 Reset Mùa Viễn Chinh
              </button>
            </div>

            {(isMainLocked || isFusionLocked) && (
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'rgba(127, 29, 29, 0.72)',
                  border: '1px solid #f43f5e',
                  color: '#fecdd3',
                  fontSize: 11.5,
                  fontWeight: 800,
                }}
              >
                🔒 {isMainLocked ? `Pet Chiến ${activePet.name}` : `Pet Hợp Thể ${fusionPet?.name}`} đã xuất chiến mùa này! Hãy đổi Pet khác trong Kho Thú (hoặc nhấn Reset Mùa) để đánh Boss tiếp theo.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {(
                [
                  ['NORMAL', '⭐ Độ Khó Sơ Cấp (3 Boss)'],
                  ['ELITE', '🔥 Độ Khó Tinh Anh (3 Boss)'],
                  ['MYTHIC', '👑 Độ Khó Thần Thoại (3 Boss)'],
                ] as const
              ).map(([t, lb]) => (
                <button
                  key={t}
                  type="button"
                  className={expTier === t ? 'pk-btn-gold' : 'pk-btn-blue'}
                  style={{ flex: 1, padding: '6px 10px', fontSize: 11.5 }}
                  onClick={() => setExpTier(t)}
                >
                  {lb}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {EXPEDITION_BOSSES.filter((b) => b.tier === expTier).map((boss) => {
                const enemyPet = getPetById(boss.petId);
                const rewardPet = getPetById(boss.rewardPetId);
                const cleared = expCleared.includes(boss.id);
                const chestClaimed = expClaimed.includes(boss.id);
                const prevBoss = EXPEDITION_BOSSES.find((b) => b.tier === boss.tier && b.order === boss.order - 1);
                const unlocked = !prevBoss || expCleared.includes(prevBoss.id);

                return (
                  <div
                    key={boss.id}
                    className="pk-stone-panel"
                    style={{
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 7,
                      textAlign: 'center',
                      borderColor: cleared ? '#4ade80' : unlocked ? '#fde047' : '#475569',
                      opacity: unlocked ? 1 : 0.65,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 900, color: boss.order === 3 ? '#fde047' : '#7dd3fc' }}>
                      {boss.order === 3 ? '👑 BOSS CUỐI ẢI' : `⚔️ CỬA BOSS ${boss.order}/3`}
                    </div>
                    <img
                      src={getPetSpritePath(enemyPet)}
                      alt={enemyPet.name}
                      style={{ width: 92, height: 92, objectFit: 'contain', filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.85))' }}
                    />
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#fef08a' }}>{boss.name}</div>
                    <div style={{ fontSize: 10.5, color: '#cbd5e1' }}>
                      Hệ {ELEMENT_META[enemyPet.element].label} • Hệ số sức mạnh ×{boss.enemyScale}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: 'rgba(2, 6, 23, 0.72)',
                        border: '1px solid rgba(250,204,21,0.35)',
                        fontSize: 10.5,
                        color: '#86efac',
                      }}
                    >
                      🎁 Rương Chiến Thắng: +{boss.rewardGold.toLocaleString()}V • +{boss.rewardGen} Gen T2 • +{boss.rewardShards} Mảnh {rewardPet.name}
                    </div>

                    {cleared ? (
                      <button
                        type="button"
                        className={chestClaimed ? 'pk-btn-blue' : 'pk-btn-gold'}
                        style={{ width: '100%', padding: '7px 10px', fontSize: 11.5 }}
                        disabled={chestClaimed}
                        onClick={() => {
                          const res = onClaimExpeditionChest(boss);
                          setNotice(res.message);
                        }}
                      >
                        {chestClaimed ? '✅ Đã Mở Rương Chiến Thắng' : '🎁 Mở Rương Chiến Thắng'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="pk-btn-gold"
                        style={{ width: '100%', padding: '7px 10px', fontSize: 11.5 }}
                        disabled={!unlocked || isMainLocked || isFusionLocked}
                        onClick={() => {
                          const stage: StageDef = {
                            id: `stage-${boss.id}`,
                            name: boss.name,
                            subtitle: 'Ải Viễn Chinh • Khóa Pet sau khi thắng',
                            islandName: 'Ải Viễn Chinh',
                            islandSprite: '/assets/pokiguard/sprites/Buildings-campaign.png',
                            isBoss: true,
                            captureOnFirstClear: false,
                            mode: 'BOSS',
                            difficulty: 'HARD',
                            enemyPetId: boss.petId,
                            enemyScale: boss.enemyScale,
                            arenaBg: boss.arenaBg,
                            recommendedPower: Math.round(boss.enemyScale * 2600),
                            rewards: { gold: boss.rewardGold, exp: 1400, stones: 35 },
                          };
                          onStartExpeditionBoss(boss, stage);
                        }}
                      >
                        {!unlocked ? '🔒 Hạ Boss trước' : isMainLocked || isFusionLocked ? '🔒 Đổi Pet chưa khóa' : '⚔️ Xuất Chiến Viễn Chinh'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: ĐẢO CHÂU BÁU (10 LƯỢT/NGÀY • LUẬT CÔNG BẰNG) ==================== */}
        {tab === 'TREASURE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pk-stone-panel" style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11.5, color: '#e2e8f0', lineHeight: 1.4 }}>
                <div>
                  🏝️ <strong style={{ color: '#fde047' }}>Sự Kiện Đảo Châu Báu (Luật Công Bằng Pokiwar 4.0):</strong>
                </div>
                <div style={{ fontSize: 10.5, color: '#fda4af' }}>
                  🚫 Cấm kỹ năng đặc biệt Mega / Galaxy / Fantasy, cấm Pet Hộ Vệ &amp; Thẻ Bài Hợp Thể (không bắt được Lính Canh).
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#4ade80' }}>Lượt hôm nay: {treasureAttempts}/10</div>
                <div style={{ fontSize: 10, color: '#93c5fd' }}>Archon@: {archonKills} • Storm Soul@: {stormKills}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Guard 1: Archon@ */}
              <div className="pk-stone-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderColor: '#38bdf8' }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#7dd3fc' }}>🛡️ LÍNH CANH ĐẢO • RƯƠNG BẠC</div>
                <img
                  src={getPetSpritePath(getPetById('pet-boss-axcel'))}
                  alt="Lính Canh Archon@"
                  style={{ width: 96, height: 96, objectFit: 'contain' }}
                />
                <div style={{ fontSize: 14, fontWeight: 900, color: '#fef08a' }}>Lính Canh Archon@</div>
                <div style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>
                  Rơi Đá C4, Tinh Thể Gen T2 &amp; Mảnh Mega. Hạ 3 lần mở khóa <strong style={{ color: '#e2e8f0' }}>🥈 Rương Bạc</strong>!
                </div>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <button
                    type="button"
                    className="pk-btn-gold"
                    style={{ flex: 1, padding: '7px 10px', fontSize: 11.5 }}
                    disabled={treasureAttempts >= 10}
                    onClick={() => {
                      const stage: StageDef = {
                        id: 'stage-treasure-archon',
                        name: 'Đảo Châu Báu: Lính Canh Archon@',
                        subtitle: 'Luật Công Bằng • Không kỹ năng đặc biệt',
                        islandName: 'Đảo Châu Báu',
                        islandSprite: '/assets/pokiguard/sprites/chest_big.png',
                        isBoss: false,
                        captureOnFirstClear: false,
                        mode: 'BOSS',
                        difficulty: 'NORMAL',
                        enemyPetId: 'pet-boss-axcel',
                        enemyScale: 1.45,
                        arenaBg: '/assets/pokiguard/sprites/bg_isle_kim.png',
                        recommendedPower: 2800,
                        rewards: { gold: 1400, exp: 900, stones: 30 },
                      };
                      onStartTreasureGuard('ARCHON', stage);
                    }}
                  >
                    ⚔️ Đánh Archon@ ({treasureAttempts}/10)
                  </button>
                  <button
                    type="button"
                    className={claimedTreasureChests.includes('SILVER') ? 'pk-btn-blue' : 'pk-btn-gold'}
                    style={{ padding: '7px 10px', fontSize: 11 }}
                    disabled={archonKills < 3 || claimedTreasureChests.includes('SILVER')}
                    onClick={() => {
                      const res = onClaimTreasureChest('SILVER');
                      setNotice(res.message);
                    }}
                  >
                    {claimedTreasureChests.includes('SILVER') ? '✅ Đã mở' : `🥈 Rương Bạc (${Math.min(3, archonKills)}/3)`}
                  </button>
                </div>
              </div>

              {/* Guard 2: Storm Soul@ */}
              <div className="pk-stone-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderColor: '#fde047' }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#fde047' }}>⚡ LÍNH CANH TINH ANH • RƯƠNG VÀNG</div>
                <img
                  src={getPetSpritePath(getPetById('pet-mega-twinfrost'))}
                  alt="Lính Canh Storm Soul@"
                  style={{ width: 96, height: 96, objectFit: 'contain' }}
                />
                <div style={{ fontSize: 14, fontWeight: 900, color: '#fef08a' }}>Lính Canh Storm Soul@</div>
                <div style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>
                  Rơi Đá C5, Gen T2 &amp; Mảnh Galaxy. Hạ 5 lần mở khóa <strong style={{ color: '#fde047' }}>🥇 Rương Vàng</strong>!
                </div>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <button
                    type="button"
                    className="pk-btn-gold"
                    style={{ flex: 1, padding: '7px 10px', fontSize: 11.5 }}
                    disabled={treasureAttempts >= 10}
                    onClick={() => {
                      const stage: StageDef = {
                        id: 'stage-treasure-storm',
                        name: 'Đảo Châu Báu: Lính Canh Storm Soul@',
                        subtitle: 'Luật Công Bằng • Không kỹ năng đặc biệt',
                        islandName: 'Đảo Châu Báu',
                        islandSprite: '/assets/pokiguard/sprites/chest_big.png',
                        isBoss: true,
                        captureOnFirstClear: false,
                        mode: 'BOSS',
                        difficulty: 'HARD',
                        enemyPetId: 'pet-mega-twinfrost',
                        enemyScale: 1.85,
                        arenaBg: '/assets/pokiguard/sprites/bg_isle_thuy.png',
                        recommendedPower: 4200,
                        rewards: { gold: 2200, exp: 1400, stones: 45 },
                      };
                      onStartTreasureGuard('STORM', stage);
                    }}
                  >
                    ⚔️ Đánh Storm Soul@ ({treasureAttempts}/10)
                  </button>
                  <button
                    type="button"
                    className={claimedTreasureChests.includes('GOLD') ? 'pk-btn-blue' : 'pk-btn-gold'}
                    style={{ padding: '7px 10px', fontSize: 11 }}
                    disabled={stormKills < 5 || claimedTreasureChests.includes('GOLD')}
                    onClick={() => {
                      const res = onClaimTreasureChest('GOLD');
                      setNotice(res.message);
                    }}
                  >
                    {claimedTreasureChests.includes('GOLD') ? '✅ Đã mở' : `🥇 Rương Vàng (${Math.min(5, stormKills)}/5)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: ĐẤU TRƯỜNG CỔ ĐẠI (5V5 SƠ ĐỒ 3×3 + 3 PRESETS + NGŨ HÀNH) ==================== */}
        {tab === 'ANCIENT_ARENA' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 12 }}>
            {/* Left: 3x3 Tactical Grid + 3 Saved Presets */}
            <div className="pk-stone-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={presetIdx === idx ? 'pk-btn-gold' : 'pk-btn-blue'}
                      style={{ padding: '3px 9px', fontSize: 10.5 }}
                      onClick={() => {
                        setPresetIdx(idx);
                        setSelectedCell(null);
                      }}
                    >
                      Đội {idx + 1}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#fde047' }}>
                  LC Sơ Đồ: {computeGridPower(currentGrid).toLocaleString()} ({placedCount}/5 Pet)
                </div>
              </div>

              {/* Field Element Banner */}
              <div
                style={{
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: 'rgba(2, 6, 23, 0.82)',
                  border: `1px solid ${ELEMENT_META[fieldElement].color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 10.5,
                }}
              >
                <span style={{ color: ELEMENT_META[fieldElement].color, fontWeight: 900 }}>
                  🌍 Ngũ Hành Đấu Trường: Hệ {ELEMENT_META[fieldElement].label} (+50% ST • +20% HP)
                </span>
                <span style={{ color: '#94a3b8' }}>ELO Cổ Đại: <strong style={{ color: '#fde047' }}>{ancientElo}</strong></span>
              </div>

              {/* 3x3 Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[0, 1, 2].map((row) => (
                  <div key={row} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: '#93c5fd' }}>{ROW_LABELS[row]}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {[0, 1, 2].map((col) => {
                        const cellIdx = row * 3 + col;
                        const pid = currentGrid[cellIdx];
                        const pet = pid ? getPetById(pid) : null;
                        const fieldRel = pet ? getFieldElementModifier(pet.element, fieldElement).relation : 'NEUTRAL';
                        const isSel = selectedCell === cellIdx;
                        return (
                          <button
                            key={cellIdx}
                            type="button"
                            onClick={() => setSelectedCell(isSel ? null : cellIdx)}
                            style={{
                              height: 76,
                              borderRadius: 10,
                              border: `2px solid ${isSel ? '#fde047' : fieldRel === 'BOOST' ? '#4ade80' : fieldRel === 'WEAK' ? '#f43f5e' : '#38bdf8'}`,
                              background: pet ? 'rgba(15, 23, 42, 0.92)' : 'rgba(2, 6, 23, 0.55)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 2,
                              cursor: 'pointer',
                              color: '#fff',
                              position: 'relative',
                            }}
                          >
                            {pet ? (
                              <>
                                <img src={getPetSpritePath(pet)} alt={pet.name} style={{ width: 42, height: 42, objectFit: 'contain' }} />
                                <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fef08a', maxWidth: '92%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {pet.name}
                                </span>
                                {fieldRel !== 'NEUTRAL' && (
                                  <span style={{ position: 'absolute', top: 2, right: 4, fontSize: 8.5, fontWeight: 900, color: fieldRel === 'BOOST' ? '#4ade80' : '#fb7185' }}>
                                    {fieldRel === 'BOOST' ? '+50%' : '-50%'}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>+ Ô {cellIdx + 1}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Pet Picker (if cell selected) OR Battle Controls & Log */}
            <div className="pk-stone-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedCell !== null ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 900, color: '#fde047' }}>
                      Chọn Pet cho Ô #{selectedCell + 1}:
                    </span>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button type="button" className="pk-btn-red" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => handleAssignCell(null)}>
                        Gỡ ô này
                      </button>
                      <button type="button" className="pk-btn-blue" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => setSelectedCell(null)}>
                        Hủy
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, maxHeight: 330, overflowY: 'auto' }}>
                    {unlockedPets.map((pid) => {
                      const p = getPetById(pid);
                      const mod = getFieldElementModifier(p.element, fieldElement);
                      return (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => handleAssignCell(pid)}
                          style={{
                            padding: 6,
                            borderRadius: 8,
                            border: `1px solid ${mod.relation === 'BOOST' ? '#4ade80' : '#38bdf8'}`,
                            background: 'rgba(6, 18, 46, 0.9)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            cursor: 'pointer',
                            color: '#fff',
                          }}
                        >
                          <img src={getPetSpritePath(p)} alt={p.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                          <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fef08a', textAlign: 'center' }}>{p.name}</span>
                          <span style={{ fontSize: 8.5, color: mod.relation === 'BOOST' ? '#4ade80' : mod.relation === 'WEAK' ? '#fb7185' : '#94a3b8' }}>
                            {ELEMENT_META[p.element].label} {mod.relation === 'BOOST' ? '(+50%)' : mod.relation === 'WEAK' ? '(-50%)' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: '#fde047' }}>
                    ⚔️ KHIÊU CHIẾN CỔ ĐẠI 5v5 (Lượt: {ancientTurnsUsed}/10)
                  </div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>
                    Nhấn vào bất kỳ ô nào trên bàn cờ 3×3 bên trái để xếp Pet. Ưu tiên xếp Pet hệ{' '}
                    <strong style={{ color: ELEMENT_META[fieldElement].color }}>{ELEMENT_META[fieldElement].label}</strong> để hưởng +50% Sát Thương &amp; +20% HP!
                  </div>

                  <button
                    type="button"
                    className="pk-khopet-btn-gold"
                    style={{ width: '100%', height: 42, fontSize: 12, whiteSpace: 'nowrap' }}
                    disabled={ancientTurnsUsed >= 10 || placedCount < 3}
                    onClick={handleFightAncientArena}
                  >
                    ⚔️ XUẤT CHIẾN CỔ ĐẠI ({10 - ancientTurnsUsed}/10 lượt)
                  </button>

                  {ancientResult && (
                    <div
                      style={{
                        padding: '7px 10px',
                        borderRadius: 8,
                        background: ancientResult.won ? 'rgba(20, 83, 45, 0.72)' : 'rgba(127, 29, 29, 0.72)',
                        border: `1.5px solid ${ancientResult.won ? '#4ade80' : '#f43f5e'}`,
                        fontSize: 12,
                        fontWeight: 900,
                        color: '#fef08a',
                        textAlign: 'center',
                      }}
                    >
                      {ancientResult.summary}
                    </div>
                  )}

                  <div
                    style={{
                      flex: 1,
                      minHeight: 150,
                      maxHeight: 220,
                      overflowY: 'auto',
                      background: 'rgba(2, 6, 23, 0.78)',
                      borderRadius: 8,
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      fontSize: 11,
                      color: '#e2e8f0',
                    }}
                  >
                    {ancientLog.length === 0 ? (
                      <div style={{ color: '#64748b', textAlign: 'center', marginTop: 40 }}>
                        Diễn biến trận đấu Cổ Đại 3×3 sẽ hiển thị tại đây...
                      </div>
                    ) : (
                      ancientLog.map((line, i) => <div key={i}>{line}</div>)
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
