import {
  getPetSpritePath,
  STARTER_PETS,
} from '@pokiwar/shared';
import { useMemo, useState } from 'react';
import type { PlayerProgress } from './MainLobby.js';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  badge: string;
  target: number;
  getValue: (p: PlayerProgress) => number;
  rewardGold: number;
  rewardGlory: number;
  rewardGen: number;
}

export const POKI_ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'ach-pet-10', title: 'Nhà Sưu Tầm Tập Sự', description: 'Sở hữu ít nhất 10 Pet độc lập trong Kho Pet', badge: '🐾', target: 10, getValue: (p) => (p.unlockedPets?.length ?? 1), rewardGold: 1200, rewardGlory: 80, rewardGen: 2 },
  { id: 'ach-pet-25', title: 'Bậc Thầy Thu Phục', description: 'Sở hữu ít nhất 25 Pet độc lập trong Kho Pet', badge: '🦊', target: 25, getValue: (p) => (p.unlockedPets?.length ?? 1), rewardGold: 2800, rewardGlory: 180, rewardGen: 4 },
  { id: 'ach-pet-50', title: 'Huyền Thoại Bách Thú', description: 'Sở hữu ít nhất 50 Pet độc lập Pokiwar 4.0', badge: '🐉', target: 50, getValue: (p) => (p.unlockedPets?.length ?? 1), rewardGold: 6000, rewardGlory: 420, rewardGen: 8 },
  { id: 'ach-win-5', title: 'Chiến Binh Khởi Nguyên', description: 'Giành chiến thắng 5 trận PvE/PvP', badge: '⚔️', target: 5, getValue: (p) => p.wins, rewardGold: 1000, rewardGlory: 60, rewardGen: 1 },
  { id: 'ach-win-25', title: 'Đấu Sĩ Bất Bại', description: 'Giành chiến thắng 25 trận PvE/PvP', badge: '🏆', target: 25, getValue: (p) => p.wins, rewardGold: 3000, rewardGlory: 200, rewardGen: 4 },
  { id: 'ach-isle-1', title: 'Chinh Phục Đảo 1 (Gusai)', description: 'Đánh bại Boss Đảo 1: Gusai Hỏa Ngục', badge: '🌋', target: 1, getValue: (p) => (p.clearedStages.includes('stage-1-boss') ? 1 : 0), rewardGold: 1500, rewardGlory: 100, rewardGen: 2 },
  { id: 'ach-isle-4', title: 'Thợ Săn Humex Lv.18', description: 'Đánh bại Boss Đảo 4: Humex Viêm Đế', badge: '🔥', target: 1, getValue: (p) => (p.clearedStages.includes('stage-4-boss') ? 1 : 0), rewardGold: 3500, rewardGlory: 260, rewardGen: 5 },
  { id: 'ach-isle-6', title: 'Kẻ Diệt Ma Vương Spetra', description: 'Đánh bại Siêu Boss Đảo 6: Spetra', badge: '👑', target: 1, getValue: (p) => (p.clearedStages.includes('stage-6-boss') ? 1 : 0), rewardGold: 7500, rewardGlory: 550, rewardGen: 10 },
  { id: 'ach-aura-3', title: 'Chủ Nhân Hào Quang', description: 'Sở hữu ít nhất 3 Vòng Sáng trong Nhà PET', badge: '✨', target: 3, getValue: (p) => (p.ownedAuras?.length ?? 1), rewardGold: 2200, rewardGlory: 150, rewardGen: 3 },
  { id: 'ach-elo-1500', title: 'Bá Vương Đấu Trường', description: 'Đạt 1,500 ELO tại Đấu Trường Bá Vương 5v5', badge: '🎖️', target: 1500, getValue: (p) => (p.kingArenaElo ?? 1000), rewardGold: 4500, rewardGlory: 350, rewardGen: 6 },
];

export interface MysteryShopOffer {
  id: string;
  name: string;
  icon: string;
  kind: 'SHARD' | 'STONE_LV5' | 'GEN_CORE' | 'CHARM';
  petId?: string;
  amount: number;
  baseGold: number;
  discountPct: number;
  finalGold: number;
}

interface PokiExtrasModalProps {
  progress: PlayerProgress;
  initialTab?: 'PYRAMID' | 'MYSTERY' | 'LEGEND_WHEEL' | 'ACHIEVE';
  onClose: () => void;
  onClaimPyramidReward: (payload: {
    goldCost: number;
    goldGain?: number;
    gloryGain?: number;
    genGain?: number;
    stoneLv4Gain?: number;
    petId?: string;
    shardGain?: number;
    isJackpot?: boolean;
  }) => { success: boolean; message: string };
  onBuyMysteryOffer: (offer: MysteryShopOffer) => { success: boolean; message: string };
  onRefreshMystery: (goldCost: number) => boolean;
  onSpinLegendWheel: (count: 1 | 5) => { success: boolean; results: { label: string; icon: string; rarity: 'EPIC' | 'LEGENDARY' }[]; message: string };
  onClaimAchievement: (ach: AchievementDef) => { success: boolean; message: string };
}

const PYRAMID_ROWS = [
  { floor: 4, label: 'Đỉnh Kim Tự Tháp (JACKPOT)', slots: 1, cost: 800, color: '#fde047' },
  { floor: 3, label: 'Tầng 3 • Kho Báu Vàng', slots: 2, cost: 550, color: '#fb923c' },
  { floor: 2, label: 'Tầng 2 • Hầm Mộ Bạc', slots: 3, cost: 400, color: '#38bdf8' },
  { floor: 1, label: 'Tầng 1 • Cổng Đồng', slots: 4, cost: 280, color: '#4ade80' },
] as const;

export function PokiExtrasModal({
  progress,
  initialTab = 'PYRAMID',
  onClose,
  onClaimPyramidReward,
  onBuyMysteryOffer,
  onRefreshMystery,
  onSpinLegendWheel,
  onClaimAchievement,
}: PokiExtrasModalProps) {
  const [tab, setTab] = useState<'PYRAMID' | 'MYSTERY' | 'LEGEND_WHEEL' | 'ACHIEVE'>(initialTab);
  const [notice, setNotice] = useState<string | null>(null);

  // Pyramid state (resets on apex completion)
  const [pyramidFloor, setPyramidFloor] = useState(1);
  const [openedCells, setOpenedCells] = useState<Record<string, string>>({});

  // Mystery Shop state
  const [mysterySeed, setMysterySeed] = useState(1);
  const [boughtOffers, setBoughtOffers] = useState<Record<string, boolean>>({});

  // Legend Wheel state
  const [legendSpinResults, setLegendSpinResults] = useState<{ label: string; icon: string; rarity: 'EPIC' | 'LEGENDARY' }[]>([]);

  const claimedAch = progress.claimedAchievements ?? [];
  const legendPity = (progress.legendSpinCount ?? 0) % 10;

  const mysteryOffers = useMemo<MysteryShopOffer[]>(() => {
    const rarePets = STARTER_PETS.filter(
      (p) => p.tier === 'GALAXY' || p.tier === 'MEGA' || p.tier === 'FANTASY' || p.tier === 'ANCIENT',
    );
    const pick = (offset: number) => rarePets[(mysterySeed * 7 + offset * 5) % rarePets.length] ?? STARTER_PETS[0];
    const p1 = pick(1);
    const p2 = pick(2);
    const p3 = pick(3);
    const raw: Omit<MysteryShopOffer, 'finalGold'>[] = [
      { id: `ms-${mysterySeed}-1`, name: `+15 Mảnh ${p1.name}`, icon: getPetSpritePath(p1), kind: 'SHARD', petId: p1.id, amount: 15, baseGold: 2600, discountPct: 50 },
      { id: `ms-${mysterySeed}-2`, name: `+15 Mảnh ${p2.name}`, icon: getPetSpritePath(p2), kind: 'SHARD', petId: p2.id, amount: 15, baseGold: 2800, discountPct: 40 },
      { id: `ms-${mysterySeed}-3`, name: `+12 Mảnh ${p3.name}`, icon: getPetSpritePath(p3), kind: 'SHARD', petId: p3.id, amount: 12, baseGold: 2200, discountPct: 60 },
      { id: `ms-${mysterySeed}-4`, name: '+3 Bùa Bình An & May Mắn', icon: '/assets/pokiguard/sprites/charm_may_man.png', kind: 'CHARM', amount: 3, baseGold: 1400, discountPct: 45 },
      { id: `ms-${mysterySeed}-5`, name: '+4 Tinh Thể Gen T2', icon: '/assets/pokiguard/sprites/crystal.png', kind: 'GEN_CORE', amount: 4, baseGold: 2400, discountPct: 50 },
      { id: `ms-${mysterySeed}-6`, name: '+3 Đá Cấp 5 & +2 Bùa', icon: '/assets/pokiguard/sprites/stone_m_5.png', kind: 'STONE_LV5', amount: 3, baseGold: 2600, discountPct: 55 },
    ];
    return raw.map((o) => ({
      ...o,
      finalGold: Math.round(o.baseGold * (1 - o.discountPct / 100)),
    }));
  }, [mysterySeed]);

  const handleDigPyramid = (floor: number, slotIdx: number, cost: number) => {
    const key = `${floor}-${slotIdx}`;
    if (floor !== pyramidFloor || openedCells[key]) return;
    if (progress.gold < cost) {
      setNotice(`Không đủ ${cost} Vàng để khai quật tầng ${floor}!`);
      return;
    }

    const elitePool = STARTER_PETS.filter((p) => p.tier === 'GALAXY' || p.tier === 'FANTASY' || p.tier === 'MEGA');
    const pickedPet = elitePool[Math.floor(Math.random() * elitePool.length)] ?? STARTER_PETS[0];

    if (floor === 4) {
      const res = onClaimPyramidReward({
        goldCost: cost,
        goldGain: 3200,
        gloryGain: 260,
        genGain: 8,
        petId: pickedPet.id,
        shardGain: 22,
        isJackpot: true,
      });
      setNotice(res.message);
      if (res.success) {
        setOpenedCells({});
        setPyramidFloor(1);
      }
      return;
    }

    // Count how many already opened on this floor — guarantee Key to climb by last tile!
    const totalSlots = PYRAMID_ROWS.find((r) => r.floor === floor)?.slots ?? 3;
    const openedOnFloor = Object.keys(openedCells).filter((k) => k.startsWith(`${floor}-`)).length;
    const foundKey = openedOnFloor >= totalSlots - 1 || Math.random() < 0.55;

    const res = onClaimPyramidReward({
      goldCost: cost,
      goldGain: foundKey ? 400 * floor : 250 * floor,
      gloryGain: 45 * floor,
      genGain: floor >= 2 ? floor : 1,
      stoneLv4Gain: floor >= 2 ? 2 : 1,
      petId: pickedPet.id,
      shardGain: 6 + floor * 3,
    });

    if (res.success) {
      setOpenedCells((prev) => ({
        ...prev,
        [key]: foundKey ? '🔑 LÊN TẦNG!' : `💎 +${6 + floor * 3} Mảnh`,
      }));
      if (foundKey) {
        setPyramidFloor((f) => Math.min(4, f + 1));
        setNotice(`🔑 ĐÀO TRÚNG CHÌA KHÓA LÊN TẦNG ${floor + 1}! ${res.message}`);
      } else {
        setNotice(res.message);
      }
    } else {
      setNotice(res.message);
    }
  };

  return (
    <div className="stage-modal-backdrop" onClick={onClose}>
      <div className="pk-modal" style={{ maxWidth: 940, maxHeight: 650 }} onClick={(e) => e.stopPropagation()}>
        <div className="pk-modal-header" style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
            {(
              [
                ['PYRAMID', '🔺 Kim Tự Tháp'],
                ['MYSTERY', '🏪 Shop Thần Bí'],
                ['LEGEND_WHEEL', '🎡 Quay Huyền Thoại'],
                ['ACHIEVE', '🏅 Thành Tựu'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={tab === k ? 'pk-btn-gold' : 'pk-btn-blue'}
                style={{ padding: '4px 9px', fontSize: 10.5, whiteSpace: 'nowrap' }}
                onClick={() => {
                  setTab(k);
                  setNotice(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pk-ribbon-title" style={{ minWidth: 205, fontSize: 13.5 }}>
            HOẠT ĐỘNG POKIWAR 4.0
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

        {/* ==================== TAB 1: KHO BÁU KIM TỰ THÁP (ĐẢO CHÂU BÁU) ==================== */}
        {tab === 'PYRAMID' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div className="pk-stone-panel" style={{ width: '100%', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>
                🔺 Khai quật từng tầng tìm <strong style={{ color: '#fde047' }}>🔑 Chìa Khóa Lên Tầng</strong> để chạm Đỉnh Kim Tự Tháp nhận Jackpot!
              </span>
              <strong style={{ color: '#4ade80' }}>Tầng hiện tại: {pyramidFloor}/4 • Vàng: {progress.gold.toLocaleString()}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: 'center', padding: '6px 0' }}>
              {PYRAMID_ROWS.map((row) => {
                const isActive = row.floor === pyramidFloor;
                const isPassed = row.floor < pyramidFloor;
                return (
                  <div key={row.floor} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 900, color: isActive ? '#fde047' : row.color }}>
                      {row.label} ({row.cost} Vàng/ô) {isActive ? '◀ ĐANG ĐÀO' : isPassed ? '✅ ĐÃ QUA' : '🔒'}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {Array.from({ length: row.slots }, (_, idx) => {
                        const key = `${row.floor}-${idx}`;
                        const openedText = openedCells[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={!isActive || Boolean(openedText)}
                            onClick={() => handleDigPyramid(row.floor, idx, row.cost)}
                            style={{
                              width: row.floor === 4 ? 190 : 138,
                              height: 64,
                              borderRadius: 12,
                              border: `2px solid ${isActive ? '#fde047' : row.color}`,
                              background: openedText
                                ? 'rgba(22, 101, 52, 0.85)'
                                : isActive
                                  ? 'linear-gradient(180deg, rgba(161, 98, 7, 0.92), rgba(69, 26, 3, 0.95))'
                                  : 'rgba(15, 23, 42, 0.82)',
                              boxShadow: isActive && !openedText ? '0 0 16px rgba(250, 204, 21, 0.65)' : 'none',
                              color: '#fef08a',
                              fontWeight: 900,
                              fontSize: 11.5,
                              cursor: isActive && !openedText ? 'pointer' : 'not-allowed',
                              opacity: !isActive && !openedText ? 0.55 : 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 2,
                            }}
                          >
                            <span>{openedText ?? (row.floor === 4 ? '👑 MỞ JACKPOT ĐỈNH!' : '📦 Đào Kho Báu')}</span>
                            {!openedText && <span style={{ fontSize: 9.5, color: '#cbd5e1' }}>{row.cost} Vàng</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: SHOP THẦN BÍ (SALE TỚI 60%) ==================== */}
        {tab === 'MYSTERY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pk-stone-panel" style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12 }}>
                🏪 <strong>Shop Thần Bí</strong> giảm giá cực sốc tới <strong style={{ color: '#f43f5e' }}>60%</strong> — bán Mảnh Pet hiếm &amp; Bóng Pokéball!
              </span>
              <button
                type="button"
                className="pk-btn-gold"
                style={{ padding: '5px 12px', fontSize: 11 }}
                onClick={() => {
                  if (onRefreshMystery(150)) {
                    setMysterySeed((s) => s + 1);
                    setBoughtOffers({});
                    setNotice('🔄 Đã làm mới 6 vật phẩm giảm giá trong Shop Thần Bí (-150 Vàng)!');
                  } else {
                    setNotice('Cần 150 Vàng để làm mới Shop Thần Bí!');
                  }
                }}
              >
                🔄 Làm Mới (150V)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {mysteryOffers.map((offer) => {
                const bought = Boolean(boughtOffers[offer.id]);
                return (
                  <div
                    key={offer.id}
                    className="pk-stone-panel"
                    style={{
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      textAlign: 'center',
                      position: 'relative',
                      borderColor: bought ? '#475569' : '#fde047',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: '#dc2626',
                        color: '#fef08a',
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      -{offer.discountPct}%
                    </span>
                    <img src={offer.icon} alt={offer.name} style={{ width: 62, height: 62, objectFit: 'contain' }} />
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#fef08a' }}>{offer.name}</div>
                    <div style={{ fontSize: 11 }}>
                      <span style={{ textDecoration: 'line-through', color: '#94a3b8', marginRight: 6 }}>
                        {offer.baseGold.toLocaleString()}V
                      </span>
                      <strong style={{ color: '#4ade80' }}>{offer.finalGold.toLocaleString()} Vàng</strong>
                    </div>
                    <button
                      type="button"
                      className="pk-btn-gold"
                      style={{ width: '100%', padding: '6px 10px', fontSize: 11, marginTop: 'auto' }}
                      disabled={bought || progress.gold < offer.finalGold}
                      onClick={() => {
                        const res = onBuyMysteryOffer(offer);
                        setNotice(res.message);
                        if (res.success) setBoughtOffers((p) => ({ ...p, [offer.id]: true }));
                      }}
                    >
                      {bought ? '✅ Đã Mua' : `Mua (${offer.finalGold.toLocaleString()}V)`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: VÒNG QUAY HUYỀN THOẠI (BẢO HIỂM 10 LẦN) ==================== */}
        {tab === 'LEGEND_WHEEL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div className="pk-stone-panel" style={{ width: '100%', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#fde047' }}>
                  🎡 VÒNG QUAY HUYỀN THOẠI — SĂN GALAXY • FANTASY • PRIMAL!
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                  Tích đủ <strong>10 lượt quay</strong> chắc chắn nổ <strong>BẢO HIỂM JACKPOT</strong> (Full Pet / +25 Mảnh Pet cực hiếm)!
                </div>
              </div>
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: 10,
                  background: 'rgba(126, 34, 206, 0.85)',
                  border: '1.5px solid #e879f9',
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#fef08a',
                }}
              >
                Bảo hiểm: {legendPity}/10
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="pk-btn-blue"
                style={{ padding: '10px 22px', fontSize: 13 }}
                disabled={progress.gold < 600}
                onClick={() => {
                  const res = onSpinLegendWheel(1);
                  setNotice(res.message);
                  if (res.success) setLegendSpinResults(res.results);
                }}
              >
                🎡 Quay x1 (600 Vàng)
              </button>
              <button
                type="button"
                className="pk-btn-gold"
                style={{ padding: '10px 24px', fontSize: 13 }}
                disabled={progress.gold < 2700}
                onClick={() => {
                  const res = onSpinLegendWheel(5);
                  setNotice(res.message);
                  if (res.success) setLegendSpinResults(res.results);
                }}
              >
                🌟 Quay x5 SIÊU TỐC (2,700 Vàng)
              </button>
            </div>

            {legendSpinResults.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
                {legendSpinResults.map((r, idx) => (
                  <div
                    key={idx}
                    className="pk-stone-panel"
                    style={{
                      width: 146,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 5,
                      textAlign: 'center',
                      borderColor: r.rarity === 'LEGENDARY' ? '#fde047' : '#c084fc',
                      boxShadow: r.rarity === 'LEGENDARY' ? '0 0 18px rgba(250, 204, 21, 0.7)' : 'none',
                    }}
                  >
                    <img src={r.icon} alt={r.label} style={{ width: 64, height: 64, objectFit: 'contain' }} />
                    <div style={{ fontSize: 11, fontWeight: 900, color: r.rarity === 'LEGENDARY' ? '#fde047' : '#e9d5ff' }}>
                      {r.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: THÀNH TỰU (10 MỐC DANH HIỆU POKIWAR 4.0) ==================== */}
        {tab === 'ACHIEVE' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9, maxHeight: 485, overflowY: 'auto' }}>
            {POKI_ACHIEVEMENTS.map((ach) => {
              const val = Math.min(ach.target, ach.getValue(progress));
              const done = val >= ach.target;
              const claimed = claimedAch.includes(ach.id);
              const pct = Math.min(100, Math.round((val / ach.target) * 100));
              return (
                <div
                  key={ach.id}
                  className="pk-stone-panel"
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderColor: claimed ? '#475569' : done ? '#4ade80' : '#38bdf8',
                  }}
                >
                  <div style={{ fontSize: 26, width: 38, textAlign: 'center' }}>{ach.badge}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#fef08a' }}>{ach.title}</div>
                    <div style={{ fontSize: 10, color: '#cbd5e1' }}>{ach.description}</div>
                    <div style={{ height: 6, borderRadius: 999, background: '#0f172a', margin: '5px 0', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: done ? '#4ade80' : '#38bdf8' }} />
                    </div>
                    <div style={{ fontSize: 9.5, color: '#86efac', fontWeight: 800 }}>
                      Tiến độ: {val}/{ach.target} • Quà: +{ach.rewardGold}V, +{ach.rewardGlory} Xu, +{ach.rewardGen} Gen
                    </div>
                  </div>
                  <button
                    type="button"
                    className={claimed ? 'pk-btn-blue' : 'pk-btn-gold'}
                    style={{ padding: '6px 10px', fontSize: 10.5 }}
                    disabled={claimed || !done}
                    onClick={() => {
                      const res = onClaimAchievement(ach);
                      setNotice(res.message);
                    }}
                  >
                    {claimed ? '✅ Đã Nhận' : done ? 'Nhận Quà' : `${pct}%`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
