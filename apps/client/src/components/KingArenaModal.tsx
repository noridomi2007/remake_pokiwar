import {
  ELEMENT_META,
  getPetById,
  getPetSpritePath,
  GLORY_SHOP_ITEMS,
  SHOP_CHESTS,
  simulateKingArenaBattle,
  STARTER_PETS,
  type ChestDef,
  type GloryShopItemDef,
  type KingArenaResult,
  type KingArenaUnitInput,
} from '@pokiwar/shared';
import { useEffect, useMemo, useState } from 'react';
import type { PlayerProgress } from './MainLobby.js';

interface KingArenaModalProps {
  progress: PlayerProgress;
  initialTab?: 'ARENA' | 'GLORY_SHOP' | 'PASSIVES';
  onClose: () => void;
  onSaveTeam: (teamIds: string[]) => void;
  onFinishKingMatch: (won: boolean, gloryReward: number, goldReward: number, eloDelta: number, opponentLabel: string) => void;
  onBuyGloryItem: (item: GloryShopItemDef, cost: number) => { success: boolean; message: string };
  onOpenChest: (chest: ChestDef) => { success: boolean; message: string };
}

const KING_OPPONENTS = [
  {
    id: 'king-op-1',
    name: 'Tân Binh Bá Vương',
    elo: 1120,
    scaleLv: 8,
    stars: 3,
    gen: 1,
    rewardGlory: 95,
    rewardGold: 900,
    petIds: ['pet-1204', 'pet-583', 'pet-807', 'pet-852', 'pet-1440'],
  },
  {
    id: 'king-op-2',
    name: 'Chiến Thần Ngân Hà',
    elo: 1480,
    scaleLv: 18,
    stars: 4,
    gen: 2,
    rewardGlory: 165,
    rewardGold: 1650,
    petIds: ['pet-mega-elpidios', 'pet-mega-zidarose', 'pet-1503', 'pet-1461', 'pet-2023'],
  },
  {
    id: 'king-op-3',
    name: 'Bá Chủ Ngân Hà 4.0',
    elo: 1920,
    scaleLv: 32,
    stars: 5,
    gen: 4,
    rewardGlory: 280,
    rewardGold: 2900,
    petIds: ['pet-boss-spetra', 'pet-primal-orithyia', 'pet-fantasy-joker', 'pet-galaxy-shadow-sword', 'pet-galaxy-dragon-knight'],
  },
] as const;

export function KingArenaModal({
  progress,
  initialTab = 'ARENA',
  onClose,
  onSaveTeam,
  onFinishKingMatch,
  onBuyGloryItem,
  onOpenChest,
}: KingArenaModalProps) {
  const [tab, setTab] = useState<'ARENA' | 'GLORY_SHOP' | 'PASSIVES'>(initialTab);
  const unlockedPets = progress.unlockedPets ?? [progress.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'];
  const defaultTeam = useMemo(() => {
    const saved = (progress.kingArenaTeam ?? []).filter((id) => unlockedPets.includes(id));
    const fill = [...saved];
    for (const pid of unlockedPets) {
      if (fill.length >= 5) break;
      if (!fill.includes(pid)) fill.push(pid);
    }
    while (fill.length < 5) {
      fill.push(STARTER_PETS[fill.length % STARTER_PETS.length].id);
    }
    return fill.slice(0, 5);
  }, [progress.kingArenaTeam, unlockedPets]);

  const [team, setTeam] = useState<string[]>(defaultTeam);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [selectedOpIdx, setSelectedOpIdx] = useState(0);
  const [battleResult, setBattleResult] = useState<KingArenaResult | null>(null);
  const [stepIdx, setStepIdx] = useState(-1);
  const [rewarded, setRewarded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [shopDiscountSeed, setShopDiscountSeed] = useState(0);

  const gloryCoins = progress.gloryCoins ?? 0;
  const kingElo = progress.kingArenaElo ?? 1000;
  const selectedOp = KING_OPPONENTS[selectedOpIdx];

  const handlePickPetForSlot = (petId: string) => {
    if (pickingSlot === null) return;
    const next = [...team];
    const existingIdx = next.indexOf(petId);
    if (existingIdx >= 0) {
      const tmp = next[pickingSlot];
      next[pickingSlot] = petId;
      next[existingIdx] = tmp;
    } else {
      next[pickingSlot] = petId;
    }
    setTeam(next);
    onSaveTeam(next);
    setPickingSlot(null);
  };

  const handleStartBattle = () => {
    const playerInputs: KingArenaUnitInput[] = team.map((pid, slot) => ({
      slot,
      pet: getPetById(pid),
      level: progress.petLevels[pid] ?? 1,
      stars: Math.max(1, Math.min(6, progress.petStars?.[pid] ?? 1)),
      genLevel: Math.max(0, Math.min(5, progress.petGenLevels?.[pid] ?? 0)),
    }));
    const enemyInputs: KingArenaUnitInput[] = selectedOp.petIds.map((pid, slot) => ({
      slot,
      pet: getPetById(pid),
      level: selectedOp.scaleLv,
      stars: selectedOp.stars,
      genLevel: selectedOp.gen,
    }));
    const res = simulateKingArenaBattle(playerInputs, enemyInputs, Date.now());
    setBattleResult(res);
    setStepIdx(0);
    setRewarded(false);
  };

  useEffect(() => {
    if (!battleResult || stepIdx < 0) return;
    if (stepIdx < battleResult.actions.length - 1) {
      const t = window.setTimeout(() => setStepIdx((s) => s + 1), 620);
      return () => window.clearTimeout(t);
    }
    if (!rewarded) {
      setRewarded(true);
      const won = battleResult.winner === 'P1';
      onFinishKingMatch(
        won,
        won ? selectedOp.rewardGlory : Math.round(selectedOp.rewardGlory * 0.3),
        won ? selectedOp.rewardGold : Math.round(selectedOp.rewardGold * 0.25),
        won ? 28 : -10,
        selectedOp.name,
      );
    }
  }, [battleResult, stepIdx, rewarded, onFinishKingMatch, selectedOp]);

  const currentAction =
    battleResult && stepIdx >= 0 ? battleResult.actions[Math.min(stepIdx, battleResult.actions.length - 1)] : null;
  const isFinished = Boolean(battleResult && stepIdx >= battleResult.actions.length - 1);

  return (
    <div className="stage-modal-backdrop" onClick={onClose}>
      <div className="pk-modal" style={{ maxWidth: 960, maxHeight: 650 }} onClick={(e) => e.stopPropagation()}>
        <div className="pk-modal-header">
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={tab === 'ARENA' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 11px', fontSize: 11.5 }}
              onClick={() => setTab('ARENA')}
            >
              ⚔️ Bá Vương 5v5
            </button>
            <button
              type="button"
              className={tab === 'GLORY_SHOP' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 11px', fontSize: 11.5 }}
              onClick={() => setTab('GLORY_SHOP')}
            >
              🏆 Shop Vinh Quang
            </button>
            <button
              type="button"
              className={tab === 'PASSIVES' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 11px', fontSize: 11.5 }}
              onClick={() => setTab('PASSIVES')}
            >
              📖 Nội Tại 4.0
            </button>
          </div>
          <div className="pk-ribbon-title" style={{ minWidth: 260, fontSize: 14.5 }}>
            ĐẤU TRƯỜNG BÁ VƯƠNG 5v5
          </div>
          <button type="button" className="pk-close-orb" aria-label="Đóng" onClick={onClose}>
            <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
          </button>
        </div>

        {/* Top Stats Strip */}
        <div
          className="pk-stone-panel"
          style={{
            padding: '7px 14px',
            marginBottom: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
          }}
        >
          <span>
            Mùa Bá Vương 4.0 • <strong style={{ color: '#fde047' }}>Elo: {kingElo}</strong>
          </span>
          <span>
            Xu Vinh Quang: <strong style={{ color: '#4ade80' }}>{gloryCoins.toLocaleString()} Xu</strong> • Vàng:{' '}
            <strong style={{ color: '#fde047' }}>{progress.gold.toLocaleString()}V</strong>
          </span>
        </div>

        {notice && (
          <div
            className="pk-stone-panel"
            style={{ padding: '6px 12px', marginBottom: 8, borderColor: '#4ade80', color: '#fef08a', fontSize: 12, fontWeight: 900 }}
          >
            {notice}
          </div>
        )}

        {/* TAB 1: 5V5 FORMATION & AUTO-BATTLE */}
        {tab === 'ARENA' && !battleResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 5-Pet Player Formation (2 Front + 3 Back) */}
            <div className="pk-stone-panel" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 900, color: '#fde047' }}>
                  🛡️ ĐỘI HÌNH BÁ VƯƠNG CỦA BẠN (2 TIỀN TUYẾN + 3 HẬU TUYẾN — NHẤN ĐỂ ĐỔI PET):
                </span>
                <span style={{ fontSize: 11, color: '#93c5fd' }}>Ưu tiên đánh từ Tiền Tuyến → Hậu Tuyến</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                {team.map((pid, idx) => {
                  const p = getPetById(pid);
                  const lv = progress.petLevels[pid] ?? 1;
                  const stars = Math.max(1, Math.min(6, progress.petStars?.[pid] ?? 1));
                  const isFront = idx <= 1;
                  return (
                    <button
                      key={`${pid}-${idx}`}
                      type="button"
                      onClick={() => setPickingSlot(idx)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: 10,
                        background:
                          pickingSlot === idx
                            ? 'rgba(234, 179, 8, 0.3)'
                            : isFront
                              ? 'rgba(29, 78, 216, 0.35)'
                              : 'rgba(15, 23, 42, 0.85)',
                        border: pickingSlot === idx ? '2px solid #fde047' : isFront ? '1.5px solid #38bdf8' : '1.5px solid #a855f7',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        color: '#fff',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 900,
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: isFront ? '#0284c7' : '#7c3aed',
                        }}
                      >
                        {isFront ? `Tiền Tuyến #${idx + 1}` : `Hậu Tuyến #${idx + 1}`}
                      </span>
                      <img src={getPetSpritePath(p)} alt={p.name} style={{ width: 62, height: 62, objectFit: 'contain' }} />
                      <div style={{ fontSize: 11, fontWeight: 900, color: '#fef08a', textAlign: 'center' }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: '#86efac', fontWeight: 800 }}>
                        Lv.{lv} • {stars}★
                      </div>
                      {p.passiveSkill && (
                        <div style={{ fontSize: 9, color: '#7dd3fc', fontWeight: 700 }}>{p.passiveSkill.name}</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {pickingSlot !== null && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(250,204,21,0.3)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 900, color: '#7dd3fc', marginBottom: 6 }}>
                    Chọn Pet thay vào Ô #{pickingSlot + 1}:
                  </div>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {unlockedPets.map((pid) => {
                      const p = getPetById(pid);
                      return (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => handlePickPetForSlot(pid)}
                          style={{
                            minWidth: 78,
                            padding: '5px 4px',
                            borderRadius: 8,
                            background: 'rgba(6, 18, 46, 0.92)',
                            border: team.includes(pid) ? '1.5px solid #4ade80' : '1px solid #38bdf8',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            cursor: 'pointer',
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          <img src={getPetSpritePath(p)} alt={p.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fef08a', whiteSpace: 'nowrap' }}>
                            {p.name.slice(0, 12)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Opponent Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {KING_OPPONENTS.map((op, idx) => {
                const active = selectedOpIdx === idx;
                return (
                  <div
                    key={op.id}
                    className="pk-stone-panel"
                    onClick={() => setSelectedOpIdx(idx)}
                    style={{
                      padding: 10,
                      cursor: 'pointer',
                      borderColor: active ? '#fde047' : '#38bdf8',
                      background: active ? 'rgba(180, 83, 9, 0.25)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 900, fontSize: 12.5, color: '#fef08a' }}>{op.name}</span>
                      <span style={{ fontSize: 10.5, color: '#93c5fd', fontWeight: 800 }}>Elo {op.elo}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 6 }}>
                      {op.petIds.map((pid) => {
                        const ep = getPetById(pid);
                        return (
                          <img
                            key={pid}
                            src={getPetSpritePath(ep)}
                            alt={ep.name}
                            title={ep.name}
                            style={{ width: 38, height: 38, objectFit: 'contain' }}
                          />
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 800, textAlign: 'center' }}>
                      Thắng: +{op.rewardGlory} Xu Vinh Quang • +{op.rewardGold}V
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="pk-khopet-btn-gold"
              style={{ width: '100%', height: 46, fontSize: 15 }}
              onClick={handleStartBattle}
            >
              ⚔️ KHIÊU CHIẾN BÁ VƯƠNG 5v5 ({selectedOp.name.toUpperCase()})
            </button>
          </div>
        )}

        {/* TAB 1B: LIVE 5V5 AUTO-BATTLE REPLAY ARENA */}
        {tab === 'ARENA' && battleResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              className="pk-stone-panel"
              style={{
                padding: 12,
                backgroundImage:
                  "linear-gradient(180deg, rgba(8, 22, 58, 0.85), rgba(4, 12, 32, 0.94)), url('/assets/pokiguard/sprites/bg_arena.png')",
                backgroundSize: 'cover',
                display: 'grid',
                gridTemplateColumns: '1fr 74px 1fr',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {/* Player 5 units */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                {battleResult.initialUnits
                  .filter((u) => u.side === 'P1')
                  .map((u) => {
                    const snap = currentAction?.snapshot[u.id] ?? u;
                    const isActor = currentAction?.actorId === u.id;
                    const isTarget = currentAction?.targetIds.includes(u.id);
                    const dmgTaken = currentAction?.damages[u.id];
                    const hpPct = Math.max(0, Math.min(100, (snap.hp / snap.maxHp) * 100));
                    return (
                      <div
                        key={u.id}
                        style={{
                          position: 'relative',
                          padding: '6px 4px',
                          borderRadius: 9,
                          background: isActor
                            ? 'rgba(234, 179, 8, 0.35)'
                            : isTarget
                              ? 'rgba(239, 68, 68, 0.35)'
                              : 'rgba(15, 23, 42, 0.82)',
                          border: isActor ? '2px solid #fde047' : '1px solid #38bdf8',
                          opacity: snap.alive ? 1 : 0.32,
                          textAlign: 'center',
                          transition: 'all 0.2s',
                        }}
                      >
                        {dmgTaken ? (
                          <span
                            style={{
                              position: 'absolute',
                              top: -8,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: 10.5,
                              fontWeight: 900,
                              color: '#fca5a5',
                              textShadow: '0 1px 3px #000',
                            }}
                          >
                            -{dmgTaken}
                          </span>
                        ) : null}
                        <img src={`/assets/pokiguard/pets/${u.spriteId}.png`} alt={u.name} style={{ width: 52, height: 52, objectFit: 'contain' }} />
                        <div style={{ fontSize: 9.5, fontWeight: 900, color: '#fef08a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.name}
                        </div>
                        <div style={{ height: 6, background: '#020617', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                          <div style={{ width: `${hpPct}%`, height: '100%', background: '#4ade80', transition: 'width 0.25s' }} />
                        </div>
                        <div style={{ fontSize: 8.5, color: '#cbd5e1', marginTop: 2 }}>
                          {snap.reviveCharges > 0 ? `❤️x${snap.reviveCharges} ` : ''}Nộ {snap.rage}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div style={{ textAlign: 'center' }}>
                <img src="/assets/pokiguard/sprites/vs_emblem.png" alt="VS" style={{ width: 58, objectFit: 'contain' }} />
                <div style={{ fontSize: 10, fontWeight: 900, color: '#fde047' }}>
                  Hiệp {currentAction?.round ?? 1}
                </div>
              </div>

              {/* Enemy 5 units */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                {battleResult.initialUnits
                  .filter((u) => u.side === 'P2')
                  .map((u) => {
                    const snap = currentAction?.snapshot[u.id] ?? u;
                    const isActor = currentAction?.actorId === u.id;
                    const isTarget = currentAction?.targetIds.includes(u.id);
                    const dmgTaken = currentAction?.damages[u.id];
                    const hpPct = Math.max(0, Math.min(100, (snap.hp / snap.maxHp) * 100));
                    return (
                      <div
                        key={u.id}
                        style={{
                          position: 'relative',
                          padding: '6px 4px',
                          borderRadius: 9,
                          background: isActor
                            ? 'rgba(234, 179, 8, 0.35)'
                            : isTarget
                              ? 'rgba(239, 68, 68, 0.35)'
                              : 'rgba(15, 23, 42, 0.82)',
                          border: isActor ? '2px solid #fde047' : '1px solid #f87171',
                          opacity: snap.alive ? 1 : 0.32,
                          textAlign: 'center',
                          transition: 'all 0.2s',
                        }}
                      >
                        {dmgTaken ? (
                          <span
                            style={{
                              position: 'absolute',
                              top: -8,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: 10.5,
                              fontWeight: 900,
                              color: '#fde047',
                              textShadow: '0 1px 3px #000',
                            }}
                          >
                            -{dmgTaken}
                          </span>
                        ) : null}
                        <img src={`/assets/pokiguard/pets/${u.spriteId}.png`} alt={u.name} style={{ width: 52, height: 52, objectFit: 'contain' }} />
                        <div style={{ fontSize: 9.5, fontWeight: 900, color: '#fecdd3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.name}
                        </div>
                        <div style={{ height: 6, background: '#020617', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                          <div style={{ width: `${hpPct}%`, height: '100%', background: '#ef4444', transition: 'width 0.25s' }} />
                        </div>
                        <div style={{ fontSize: 8.5, color: '#cbd5e1', marginTop: 2 }}>
                          {snap.reviveCharges > 0 ? `❤️x${snap.reviveCharges} ` : ''}Nộ {snap.rage}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Live Action Log */}
            <div className="pk-stone-panel" style={{ padding: '10px 14px', minHeight: 74 }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: '#fde047', marginBottom: 4 }}>
                {currentAction ? currentAction.summary : 'Đang khai chiến...'}
              </div>
              {isFinished && (
                <div style={{ fontSize: 13.5, fontWeight: 900, color: battleResult.winner === 'P1' ? '#4ade80' : '#fca5a5' }}>
                  {battleResult.winner === 'P1'
                    ? `🏆 CHIẾN THẮNG BÁ VƯƠNG! Nhận +${selectedOp.rewardGlory} Xu Vinh Quang, +${selectedOp.rewardGold} Vàng & +28 Elo!`
                    : `💥 THẤT BẠI! Nhận thưởng khích lệ +${Math.round(selectedOp.rewardGlory * 0.3)} Xu Vinh Quang.`}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {!isFinished && (
                <button
                  type="button"
                  className="pk-btn-blue"
                  style={{ flex: 1 }}
                  onClick={() => setStepIdx(battleResult.actions.length - 1)}
                >
                  ⏩ Xem Kết Quả Ngay
                </button>
              )}
              <button
                type="button"
                className="pk-btn-gold"
                style={{ flex: 1 }}
                onClick={() => {
                  setBattleResult(null);
                  setStepIdx(-1);
                }}
              >
                Quay Lại Đội Hình 5v5
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SHOP VINH QUANG & SHOP RƯƠNG */}
        {tab === 'GLORY_SHOP' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, fontWeight: 900, color: '#fde047' }}>
                🏆 SHOP VINH QUANG (ĐỔI XU ĐẤU TRƯỜNG — SALE 20%–50%)
              </span>
              <button
                type="button"
                className="pk-btn-blue"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => {
                  setShopDiscountSeed((s) => s + 1);
                  setNotice('🔄 Đã làm mới ưu đãi Shop Vinh Quang!');
                }}
              >
                🔄 Làm Mới Giảm Giá
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {GLORY_SHOP_ITEMS.map((item, idx) => {
                const extraSale = ((idx + shopDiscountSeed) % 3) * 10;
                const effSale = Math.min(50, item.salePercent + extraSale);
                const finalCost = Math.round(item.baseCostGlory * (1 - effSale / 100));
                return (
                  <div
                    key={item.id}
                    className="pk-stone-panel"
                    style={{
                      position: 'relative',
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 5,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        fontSize: 9,
                        fontWeight: 900,
                        padding: '1px 5px',
                        borderRadius: 6,
                        background: '#dc2626',
                        color: '#fff',
                      }}
                    >
                      -{effSale}%
                    </span>
                    <img src={item.icon} alt={item.name} style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#fef08a' }}>{item.name}</div>
                    <div style={{ fontSize: 10.5, color: '#4ade80', fontWeight: 800 }}>{finalCost} Xu Vinh Quang</div>
                    <button
                      type="button"
                      className="pk-btn-gold"
                      style={{ width: '100%', padding: '5px 8px', fontSize: 11 }}
                      disabled={gloryCoins < finalCost}
                      onClick={() => {
                        const res = onBuyGloryItem(item, finalCost);
                        setNotice(res.message);
                      }}
                    >
                      Đổi Ngay
                    </button>
                  </div>
                );
              })}
            </div>

            {/* SHOP RƯƠNG POKIWAR */}
            <div style={{ fontSize: 12.5, fontWeight: 900, color: '#7dd3fc', marginTop: 4 }}>
              📦 SHOP RƯƠNG BÁU VẬT (RƯƠNG TÂN THỦ → RƯƠNG THƯỢNG CỔ):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {SHOP_CHESTS.map((ch) => {
                const canAfford =
                  (ch.costGold ? progress.gold >= ch.costGold : true) &&
                  (ch.costGlory ? gloryCoins >= ch.costGlory : true);
                return (
                  <div
                    key={ch.id}
                    className="pk-stone-panel"
                    style={{ padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center' }}
                  >
                    <img src={ch.icon} alt={ch.name} style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    <div style={{ fontSize: 11.5, fontWeight: 900, color: '#fef08a' }}>{ch.name}</div>
                    <div style={{ fontSize: 9.8, color: '#cbd5e1', lineHeight: 1.25 }}>{ch.description}</div>
                    <button
                      type="button"
                      className="pk-btn-orange"
                      style={{ width: '100%', padding: '5px 8px', fontSize: 10.5, marginTop: 'auto' }}
                      disabled={!canAfford}
                      onClick={() => {
                        const res = onOpenChest(ch);
                        setNotice(res.message);
                      }}
                    >
                      Mở ({ch.costGlory ? `${ch.costGlory} Xu` : `${ch.costGold}V`})
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: PASSIVE SKILLS BROWSER */}
        {tab === 'PASSIVES' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
            {STARTER_PETS.filter((p) => p.passiveSkill).map((p) => (
              <div
                key={p.id}
                className="pk-stone-panel"
                style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <img src={getPetSpritePath(p)} alt={p.name} style={{ width: 48, height: 48, objectFit: 'contain' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={ELEMENT_META[p.element].iconPath} alt={p.element} style={{ width: 15, height: 15 }} />
                    <span style={{ fontWeight: 900, fontSize: 12.5, color: '#fef08a' }}>{p.name}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 900, color: '#38bdf8' }}>[{p.tier}]</span>
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 900, color: '#4ade80' }}>
                    Nội Tại: {p.passiveSkill!.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#cbd5e1' }}>{p.passiveSkill!.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
