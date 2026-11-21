import {
  CHARACTER_EQUIPMENT,
  computeAuraTotalBonuses,
  computeEquipmentBonuses,
  EQUIPMENT_SLOT_META,
  getPetById,
  getPetSpritePath,
  PET_AURAS,
  type AuraDef,
  type EquipmentItemDef,
  type EquipmentSlot,
} from '@pokiwar/shared';
import { useState } from 'react';
import type { PlayerProgress } from './MainLobby.js';

interface PetHouseModalProps {
  progress: PlayerProgress;
  initialTab?: 'AURA' | 'GUARD' | 'EQUIP';
  onClose: () => void;
  onBuyOrEquipAura: (aura: AuraDef) => { success: boolean; message: string };
  onSetGuardPet: (petId: string | null) => void;
  onSetFusionPet?: (petId: string | null) => void;
  onBuyOrEquipItem: (item: EquipmentItemDef) => { success: boolean; message: string };
  onBreakthrough: () => { success: boolean; message: string };
  onReforgeSlot?: (slot: EquipmentSlot) => { success: boolean; message: string };
}

const REFORGE_GRADE_META = {
  RARE: { label: 'Hiếm', color: '#38bdf8' },
  EPIC: { label: 'Sử Thi', color: '#c084fc' },
  MYTHIC: { label: 'Thần Thoại ★', color: '#fde047' },
} as const;

const SLOTS: EquipmentSlot[] = ['NON', 'VU_KHI', 'CANH', 'AO', 'GIAY', 'HIEU_UNG'];

export function PetHouseModal({
  progress,
  initialTab = 'AURA',
  onClose,
  onBuyOrEquipAura,
  onSetGuardPet,
  onSetFusionPet,
  onBuyOrEquipItem,
  onBreakthrough,
  onReforgeSlot,
}: PetHouseModalProps) {
  const [tab, setTab] = useState<'AURA' | 'GUARD' | 'EQUIP'>(initialTab);
  const [slotFilter, setSlotFilter] = useState<'ALL' | EquipmentSlot>('ALL');
  const [notice, setNotice] = useState<string | null>(null);

  const ownedAuras = progress.ownedAuras ?? ['aura-gold'];
  const activeAuraId = progress.equippedAuraId ?? 'aura-gold';
  const auraTotals = computeAuraTotalBonuses(ownedAuras);
  const gloryCoins = progress.gloryCoins ?? 0;

  const unlockedPets = progress.unlockedPets ?? [progress.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'];
  const guardPetId = progress.guardPetId ?? null;
  const guardPet = guardPetId ? getPetById(guardPetId) : null;
  const fusionPetId = progress.fusionPetId ?? null;
  const fusionPet = fusionPetId ? getPetById(fusionPetId) : null;

  const ownedEquip = progress.ownedEquipment ?? ['eq-non-1', 'eq-vk-1', 'eq-ao-1'];
  const equippedSlots = progress.equippedEquipment ?? { NON: 'eq-non-1', VU_KHI: 'eq-vk-1', AO: 'eq-ao-1' };
  const reforges = progress.equipmentReforges ?? {};
  const reforgeTotals = SLOTS.reduce(
    (acc, s) => {
      const r = reforges[s];
      if (r) {
        acc.hp += r.hp;
        acc.atk += r.atk;
        acc.def += r.def;
        acc.spd += r.spd;
      }
      return acc;
    },
    { hp: 0, atk: 0, def: 0, spd: 0 },
  );
  const breakthroughLv = progress.breakthroughLv ?? 0;
  const equipTotals = computeEquipmentBonuses(equippedSlots, breakthroughLv);
  const btGoldCost = 900 + breakthroughLv * 550;
  const btStoneCost = 10 + breakthroughLv * 6;

  return (
    <div className="stage-modal-backdrop" onClick={onClose}>
      <div className="pk-modal" style={{ maxWidth: 920, maxHeight: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="pk-modal-header">
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={tab === 'AURA' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 11px', fontSize: 11.5 }}
              onClick={() => setTab('AURA')}
            >
              ✨ Vòng Sáng (Aura)
            </button>
            <button
              type="button"
              className={tab === 'GUARD' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 11px', fontSize: 11.5 }}
              onClick={() => setTab('GUARD')}
            >
              🛡️ Hộ Vệ &amp; Hợp Thể
            </button>
            <button
              type="button"
              className={tab === 'EQUIP' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 11px', fontSize: 11.5 }}
              onClick={() => setTab('EQUIP')}
            >
              ⚔️ Trang Bị 6 Ô &amp; Xung Phá
            </button>
          </div>
          <div className="pk-ribbon-title" style={{ minWidth: 220, fontSize: 14.5 }}>
            NHÀ PET &amp; TRANG BỊ 4.0
          </div>
          <button type="button" className="pk-close-orb" aria-label="Đóng" onClick={onClose}>
            <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
          </button>
        </div>

        {notice && (
          <div
            className="pk-stone-panel"
            style={{ padding: '6px 12px', marginBottom: 8, borderColor: '#4ade80', color: '#fef08a', fontSize: 12, fontWeight: 900 }}
          >
            {notice}
          </div>
        )}

        {/* TAB 1: VÒNG SÁNG (AURA) */}
        {tab === 'AURA' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              className="pk-stone-panel"
              style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}
            >
              <span>
                ✨ Sở hữu Vòng Sáng được <strong style={{ color: '#4ade80' }}>CỘNG DỒN VĨNH VIỄN</strong> chỉ số (kể cả khi không đeo):
              </span>
              <strong style={{ color: '#fde047' }}>
                +{auraTotals.hpBonus} HP • +{auraTotals.atkBonus} Công • +{auraTotals.defenseBonus} Thủ
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, maxHeight: 440, overflowY: 'auto' }}>
              {PET_AURAS.map((aura) => {
                const owned = ownedAuras.includes(aura.id);
                const equipped = activeAuraId === aura.id;
                const canBuy =
                  (aura.costGold ? progress.gold >= aura.costGold : true) &&
                  (aura.costGlory ? gloryCoins >= aura.costGlory : true);
                return (
                  <div
                    key={aura.id}
                    className="pk-stone-panel"
                    style={{
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      borderColor: equipped ? '#fde047' : owned ? '#4ade80' : '#38bdf8',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        border: `3px solid ${aura.colorHex}`,
                        boxShadow: `0 0 20px ${aura.colorHex}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(2, 6, 23, 0.8)',
                      }}
                    >
                      <img src={aura.icon} alt={aura.name} style={{ width: 54, height: 54, objectFit: 'contain' }} />
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 13, color: aura.colorHex }}>{aura.name}</div>
                    <div style={{ fontSize: 10.5, color: '#cbd5e1', lineHeight: 1.25 }}>{aura.description}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#4ade80' }}>
                      +{aura.hpBonus} HP • +{aura.atkBonus} Công • +{aura.defenseBonus} Thủ
                    </div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8' }}>Nguồn: {aura.sourceLabel}</div>
                    <button
                      type="button"
                      className={equipped ? 'pk-btn-blue' : 'pk-btn-gold'}
                      style={{ width: '100%', padding: '6px 10px', fontSize: 11.5, marginTop: 'auto' }}
                      disabled={equipped || (!owned && !canBuy)}
                      onClick={() => {
                        const res = onBuyOrEquipAura(aura);
                        setNotice(res.message);
                      }}
                    >
                      {equipped
                        ? '✅ Đang Kích Hoạt'
                        : owned
                          ? 'Trang Bị Hiển Thị'
                          : aura.costGlory
                            ? `Mở Khóa (${aura.costGlory} Xu)`
                            : `Mở Khóa (${aura.costGold}V)`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: PET HỘ VỆ & PET HỢP THỂ (CHUẨN POKIWAR 4.0) */}
        {tab === 'GUARD' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Slot 1: Pet Hộ Vệ */}
              <div className="pk-stone-panel" style={{ padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {guardPet ? (
                    <img src={getPetSpritePath(guardPet)} alt={guardPet.name} style={{ width: 54, height: 54, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: 54, height: 54, borderRadius: 10, border: '2px dashed #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      🛡️
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 12.5, color: '#fde047' }}>
                      Hộ Vệ: {guardPet ? guardPet.name : 'Trống'}
                    </div>
                    <div style={{ fontSize: 10, color: '#cbd5e1' }}>
                      Cộng thẳng <strong style={{ color: '#4ade80' }}>+16% HP, Công &amp; Phép</strong> cho Pet chính.
                    </div>
                  </div>
                </div>
                {guardPet && (
                  <button type="button" className="pk-btn-red" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => onSetGuardPet(null)}>
                    Tháo
                  </button>
                )}
              </div>

              {/* Slot 2: Pet Hợp Thể */}
              <div className="pk-stone-panel" style={{ padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderColor: '#c084fc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {fusionPet ? (
                    <img src={getPetSpritePath(fusionPet)} alt={fusionPet.name} style={{ width: 54, height: 54, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: 54, height: 54, borderRadius: 10, border: '2px dashed #c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      🤝
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 12.5, color: '#e9d5ff' }}>
                      Hợp Thể: {fusionPet ? fusionPet.name : 'Trống'}
                    </div>
                    <div style={{ fontSize: 10, color: '#cbd5e1' }}>
                      <strong style={{ color: '#c084fc' }}>+12% chỉ số</strong> &amp; mở <strong style={{ color: '#fde047' }}>Thẻ Bài Hợp Thể</strong> trong trận!
                    </div>
                  </div>
                </div>
                {fusionPet && onSetFusionPet && (
                  <button type="button" className="pk-btn-red" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => onSetFusionPet(null)}>
                    Tháo
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, maxHeight: 350, overflowY: 'auto' }}>
              {unlockedPets
                .filter((id) => id !== progress.selectedPetId)
                .map((pid) => {
                  const p = getPetById(pid);
                  const isGuard = guardPetId === pid;
                  const isFusion = fusionPetId === pid;
                  return (
                    <div
                      key={pid}
                      className="pk-stone-panel"
                      style={{
                        padding: 7,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        borderColor: isGuard ? '#fde047' : isFusion ? '#c084fc' : '#38bdf8',
                        color: '#fff',
                      }}
                    >
                      <img src={getPetSpritePath(p)} alt={p.name} style={{ width: 50, height: 50, objectFit: 'contain' }} />
                      <div style={{ fontSize: 10, fontWeight: 900, color: '#fef08a', textAlign: 'center' }}>{p.name}</div>
                      <div style={{ display: 'flex', gap: 4, width: '100%', marginTop: 'auto' }}>
                        <button
                          type="button"
                          className={isGuard ? 'pk-btn-gold' : 'pk-btn-blue'}
                          style={{ flex: 1, padding: '3px 4px', fontSize: 9 }}
                          disabled={isGuard || isFusion}
                          onClick={() => {
                            onSetGuardPet(pid);
                            setNotice(`🛡️ Đã đặt ${p.name} làm Pet Hộ Vệ (+16% HP/Công/Phép)!`);
                          }}
                        >
                          {isGuard ? '✅ Hộ Vệ' : '🛡️ Hộ Vệ'}
                        </button>
                        {onSetFusionPet && (
                          <button
                            type="button"
                            className={isFusion ? 'pk-btn-gold' : 'pk-btn-blue'}
                            style={{ flex: 1, padding: '3px 4px', fontSize: 9 }}
                            disabled={isFusion || isGuard}
                            onClick={() => {
                              onSetFusionPet(pid);
                              setNotice(`🤝 Đã đặt ${p.name} làm Pet Hợp Thể (+12% chỉ số & mở Thẻ Bài Hợp Thể)!`);
                            }}
                          >
                            {isFusion ? '✅ Hợp Thể' : '🤝 Hợp Thể'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 3: TRANG BỊ NHÂN VẬT 6 Ô & XUNG PHÁ CỰC HẠN */}
        {tab === 'EQUIP' && (
          <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.45fr', gap: 12 }}>
            {/* Left: 6 Equipped Slots + Breakthrough */}
            <div className="pk-stone-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 900, color: '#fde047', marginBottom: 6 }}>
                  👤 TRANG BỊ ĐANG MẶC (6 Ô CHUẨN 4.0)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {SLOTS.map((slot) => {
                    const meta = EQUIPMENT_SLOT_META[slot];
                    const eqId = equippedSlots[slot];
                    const item = CHARACTER_EQUIPMENT.find((e) => e.id === eqId);
                    const rf = reforges[slot];
                    const rfMeta = rf ? REFORGE_GRADE_META[rf.grade] : null;
                    return (
                      <div
                        key={slot}
                        onClick={() => setSlotFilter(slot)}
                        style={{
                          padding: '6px 7px',
                          borderRadius: 9,
                          background: 'rgba(6, 18, 46, 0.9)',
                          border: slotFilter === slot ? '1.5px solid #fde047' : `1px solid ${rfMeta?.color ?? '#38bdf8'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 5,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <img src={item?.icon ?? meta.icon} alt={meta.label} style={{ width: 26, height: 26, objectFit: 'contain' }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span style={{ fontSize: 9.5, color: '#93c5fd', fontWeight: 800 }}>{meta.label}</span>
                              {rfMeta && (
                                <span style={{ fontSize: 8.5, fontWeight: 900, color: rfMeta.color }}>{rfMeta.label}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 900, color: '#fef08a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item ? `${item.name} (${item.stars}★)` : 'Trống'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span style={{ fontSize: 8.5, color: rf ? '#86efac' : '#94a3b8' }}>
                            {rf ? `+${rf.hp}HP +${rf.atk}C +${rf.def}Th +${rf.spd}T` : 'Chưa tẩy luyện'}
                          </span>
                          {onReforgeSlot && (
                            <button
                              type="button"
                              className="pk-btn-blue"
                              style={{ padding: '2px 6px', fontSize: 8.5, whiteSpace: 'nowrap' }}
                              disabled={progress.gold < 450 || progress.stones < 4}
                              title="Tẩy Luyện Trang Bị (450 Vàng • 4 Đá): Quay dòng thuộc tính Hiếm / Sử Thi / Thần Thoại"
                              onClick={(e) => {
                                e.stopPropagation();
                                const res = onReforgeSlot(slot);
                                setNotice(res.message);
                              }}
                            >
                              🔮 Tẩy (450V)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(250,204,21,0.3)', paddingTop: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: '#4ade80', marginBottom: 4 }}>
                  Tổng Cộng Trang Bị + Xung Phá + Tẩy Luyện:
                </div>
                <div style={{ fontSize: 11, color: '#e2e8f0', marginBottom: 8 }}>
                  +{equipTotals.hpBonus + reforgeTotals.hp} HP • +{equipTotals.atkBonus + reforgeTotals.atk} Công • +{equipTotals.magicBonus} Phép • +{equipTotals.defenseBonus + reforgeTotals.def} Thủ • +{equipTotals.speedBonus + reforgeTotals.spd} Tốc
                </div>
                <button
                  type="button"
                  className="pk-khopet-btn-gold"
                  style={{ width: '100%', height: 40, fontSize: 11.5 }}
                  disabled={breakthroughLv >= 15 || progress.gold < btGoldCost || progress.stones < btStoneCost}
                  onClick={() => {
                    const res = onBreakthrough();
                    setNotice(res.message);
                  }}
                >
                  {breakthroughLv >= 15
                    ? '🌟 XUNG PHÁ CỰC HẠN MAX (Lv.15)'
                    : `⚡ XUNG PHÁ CỰC HẠN Lv.${breakthroughLv + 1} (${btGoldCost}V • ${btStoneCost} Đá)`}
                </button>
              </div>
            </div>

            {/* Right: Wardrobe Drawer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={slotFilter === 'ALL' ? 'pk-btn-gold' : 'pk-btn-blue'}
                  style={{ padding: '4px 9px', fontSize: 10.5 }}
                  onClick={() => setSlotFilter('ALL')}
                >
                  Tất cả
                </button>
                {SLOTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={slotFilter === s ? 'pk-btn-gold' : 'pk-btn-blue'}
                    style={{ padding: '4px 9px', fontSize: 10.5 }}
                    onClick={() => setSlotFilter(s)}
                  >
                    {EQUIPMENT_SLOT_META[s].label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, maxHeight: 410, overflowY: 'auto', paddingRight: 4 }}>
                {CHARACTER_EQUIPMENT.filter((e) => slotFilter === 'ALL' || e.slot === slotFilter).map((item) => {
                  const owned = ownedEquip.includes(item.id) || (item.costGold === 0 && !item.costGlory);
                  const equipped = equippedSlots[item.slot] === item.id;
                  const canAfford =
                    (item.costGold ? progress.gold >= item.costGold : true) &&
                    (item.costGlory ? gloryCoins >= item.costGlory : true);
                  return (
                    <div
                      key={item.id}
                      className="pk-stone-panel"
                      style={{
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        textAlign: 'center',
                        borderColor: equipped ? '#fde047' : owned ? '#4ade80' : '#38bdf8',
                      }}
                    >
                      <img src={item.icon} alt={item.name} style={{ width: 42, height: 42, objectFit: 'contain' }} />
                      <div style={{ fontSize: 10.5, fontWeight: 900, color: '#fef08a' }}>{item.name}</div>
                      <div style={{ fontSize: 9.5, color: '#fde047' }}>
                        {EQUIPMENT_SLOT_META[item.slot].label} • {'★'.repeat(item.stars)}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#86efac' }}>
                        +{item.hpBonus}HP +{item.atkBonus}C +{item.speedBonus}T
                      </div>
                      <button
                        type="button"
                        className={equipped ? 'pk-btn-blue' : 'pk-btn-gold'}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 10, marginTop: 'auto' }}
                        disabled={equipped || (!owned && !canAfford)}
                        onClick={() => {
                          const res = onBuyOrEquipItem(item);
                          setNotice(res.message);
                        }}
                      >
                        {equipped
                          ? 'Đang mặc'
                          : owned
                            ? 'Trang bị'
                            : item.costGlory
                              ? `Mua (${item.costGlory} Xu)`
                              : `Mua (${item.costGold}V)`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
