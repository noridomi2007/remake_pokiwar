import {
  DUNGEON_ISLANDS,
  ELEMENT_META,
  getPetById,
  getPetSpritePath,
  PVE_STAGES,
  type DungeonIslandId,
  type StageDef,
} from '@pokiwar/shared';
import { useState } from 'react';
import type { PlayerProgress } from './MainLobby.js';

interface DungeonWorldMapModalProps {
  progress: PlayerProgress;
  initialTab?: 'ISLANDS' | 'TOWER' | 'HUNT' | 'SPECIAL';
  onClose: () => void;
  onStartPve: (stage: StageDef, mercenaryCount?: number) => void;
  onSweepStage?: (stage: StageDef) => string;
}

const ISLAND_STAGE_COORDS: readonly { x: number; y: number }[] = [
  { x: 11, y: 68 },
  { x: 30, y: 31 },
  { x: 50, y: 68 },
  { x: 69, y: 31 },
  { x: 88, y: 52 },
];

const TOWER_FLOOR_COORDS: readonly { x: number; y: number }[] = [
  { x: 11, y: 76 },
  { x: 30, y: 76 },
  { x: 50, y: 76 },
  { x: 70, y: 76 },
  { x: 89, y: 74 },
  { x: 89, y: 27 },
  { x: 70, y: 27 },
  { x: 50, y: 27 },
  { x: 30, y: 27 },
  { x: 11, y: 27 },
];

export function DungeonWorldMapModal({
  progress,
  initialTab = 'ISLANDS',
  onClose,
  onStartPve,
  onSweepStage,
}: DungeonWorldMapModalProps) {
  const [tab, setTab] = useState<'ISLANDS' | 'TOWER' | 'HUNT' | 'SPECIAL'>(initialTab);
  const [selectedIslandId, setSelectedIslandId] = useState<DungeonIslandId | null>(null);
  const [selectedStage, setSelectedStage] = useState<StageDef | null>(null);
  const [mercCount, setMercCount] = useState(0);
  const [sweepNotice, setSweepNotice] = useState<string | null>(null);

  const clearedSet = new Set(progress.clearedStages ?? []);
  const unlockedSet = new Set(progress.unlockedPets ?? []);

  const selectedIsland = selectedIslandId
    ? DUNGEON_ISLANDS.find((isl) => isl.id === selectedIslandId) ?? null
    : null;

  const islandStages = selectedIsland
    ? PVE_STAGES.filter((s) => s.islandId === selectedIsland.id).sort(
        (a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0),
      )
    : [];

  const towerStages = PVE_STAGES.filter((s) => s.mode === 'ENDLESS_TOWER').sort(
    (a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0),
  );
  const huntStages = PVE_STAGES.filter((s) => s.mode === 'BOSS');
  const specialStages = PVE_STAGES.filter((s) => s.mode === 'MEGA_ARENA' || s.mode === 'ZODIAC_TOMB');

  const isIslandUnlocked = (order: number): boolean => {
    if (order <= 1) return true;
    return clearedSet.has(`stage-${order - 1}-boss`);
  };

  const isStageUnlockedInChain = (stages: StageDef[], idx: number): boolean => {
    if (idx <= 0) return true;
    return clearedSet.has(stages[idx - 1].id);
  };

  const huntQuests = [
    { id: 'stage-1-boss', label: 'Săn Boss Gusai (Đảo 1)' },
    { id: 'stage-2-boss', label: 'Săn Boss Worzu (Đảo 2)' },
    { id: 'stage-3-boss', label: 'Săn Boss Rattan (Đảo 3)' },
    { id: 'stage-4-boss', label: 'Săn Boss Humex Lv.18 (Đảo 4)' },
    { id: 'stage-6-boss', label: 'Săn Siêu Boss Spetra (Đảo 6)' },
  ];

  const renderCaptureBadge = (st: StageDef) => {
    const cleared = clearedSet.has(st.id);
    const owned = unlockedSet.has(st.enemyPetId);
    const pet = getPetById(st.enemyPetId);
    if (!cleared && !owned) {
      return (
        <span
          style={{
            display: 'inline-block',
            padding: '2px 7px',
            borderRadius: 999,
            background: 'rgba(22, 101, 52, 0.92)',
            border: '1px solid #4ade80',
            color: '#bbf7d0',
            fontSize: 9.5,
            fontWeight: 900,
          }}
        >
          🎁 Thắng lần đầu: Nhận {pet.name}!
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 7px',
          borderRadius: 999,
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid #38bdf8',
          color: '#7dd3fc',
          fontSize: 9.5,
          fontWeight: 800,
        }}
      >
        ✅ Đã thu phục (Đánh lại nhận Vàng/Đá)
      </span>
    );
  };

  const renderStageDetailPrep = (st: StageDef) => {
    const enemy = getPetById(st.enemyPetId);
    const cleared = clearedSet.has(st.id);
    const isBoss = Boolean(st.isBoss || st.mode === 'BOSS');
    const bossHpPreview = Math.round(enemy.maxHp * st.enemyScale * (isBoss ? 1.65 : 1));
    const bossAtkPreview = Math.round(enemy.attack * st.enemyScale * (isBoss ? 1.22 : 1));
    const bossDefPreview = Math.round(enemy.defense * st.enemyScale * (isBoss ? 1.18 : 1));
    const sigSkill = enemy.skills[enemy.skills.length - 1];

    return (
      <div
        className="pk-stone-panel"
        style={{
          padding: 14,
          display: 'grid',
          gridTemplateColumns: '1.15fr 1.25fr',
          gap: 14,
          background: `linear-gradient(135deg, rgba(6, 18, 48, 0.92), rgba(20, 12, 46, 0.94)), url('${st.arenaBg}') center/cover`,
          borderColor: isBoss ? '#f43f5e' : '#facc15',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={ELEMENT_META[enemy.element].iconPath} alt={enemy.element} style={{ width: 22, height: 22 }} />
            <span style={{ fontSize: 15, fontWeight: 900, color: isBoss ? '#fda4af' : '#fef08a' }}>
              {isBoss ? '👑 ' : ''}
              {enemy.name}
            </span>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 999,
                background: isBoss ? '#be123c' : '#1d4ed8',
                color: '#fff',
                fontSize: 9.5,
                fontWeight: 900,
              }}
            >
              {enemy.tier}
            </span>
          </div>
          <div style={{ position: 'relative', width: 175, height: 175, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                position: 'absolute',
                inset: 12,
                borderRadius: '50%',
                background: isBoss
                  ? 'radial-gradient(circle, rgba(244,63,94,0.35), transparent 72%)'
                  : 'radial-gradient(circle, rgba(56,189,248,0.32), transparent 72%)',
              }}
            />
            <img
              src={getPetSpritePath(enemy)}
              alt={enemy.name}
              style={{ width: 164, height: 164, objectFit: 'contain', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.85))' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11.5, fontWeight: 900 }}>
            <span style={{ color: '#4ade80' }}>HP: {bossHpPreview.toLocaleString()}</span>
            <span style={{ color: '#fb923c' }}>ATK: {bossAtkPreview.toLocaleString()}</span>
            <span style={{ color: '#7dd3fc' }}>DEF: {bossDefPreview.toLocaleString()}</span>
          </div>
          {isBoss && (
            <div style={{ fontSize: 10.5, fontWeight: 900, color: '#fda4af' }}>
              🔥 SIÊU BOSS POKIWAR: ×1.65 Máu • Khiên Boss 22% HP • Ra chiêu liên tục!
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fde047' }}>{st.name}</div>
            <div style={{ fontSize: 11.5, color: '#cbd5e1', marginTop: 2 }}>{st.subtitle}</div>
            <div style={{ marginTop: 7 }}>{renderCaptureBadge(st)}</div>
          </div>

          {sigSkill && (
            <div
              style={{
                padding: '7px 9px',
                borderRadius: 10,
                background: 'rgba(2, 6, 23, 0.78)',
                border: '1px solid rgba(250, 204, 21, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <img
                src={sigSkill.cardImage}
                alt={sigSkill.name}
                style={{ width: 34, height: 42, borderRadius: 5, objectFit: 'cover', border: '1px solid #fde047' }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#fef08a' }}>
                  Tuyệt kỹ: {sigSkill.name}
                </div>
                <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.2 }}>{sigSkill.description}</div>
              </div>
            </div>
          )}

          <div
            style={{
              padding: '7px 10px',
              borderRadius: 10,
              background: 'rgba(2, 6, 23, 0.72)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              fontSize: 11,
              color: '#e2e8f0',
            }}
          >
            <div style={{ fontWeight: 900, color: '#fde047', marginBottom: 4 }}>
              Phần thưởng: +{st.rewards.gold.toLocaleString()} Vàng • +{st.rewards.exp} EXP • +{st.rewards.stones} Đá
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: '#93c5fd', fontWeight: 800 }}>Thuê trợ chiến:</span>
              {[
                { n: 0, label: 'Solo (0V)' },
                { n: 1, label: '+1 Đồng đội (150V)' },
                { n: 2, label: '+2 Đồng đội (350V)' },
              ].map((opt) => (
                <button
                  key={opt.n}
                  type="button"
                  className={mercCount === opt.n ? 'pk-btn-gold' : 'pk-btn-blue'}
                  style={{ padding: '3px 8px', fontSize: 10 }}
                  onClick={() => setMercCount(opt.n)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="pk-btn-gold"
              style={{ flex: 1.5, padding: '9px 14px', fontSize: 13 }}
              onClick={() => onStartPve(st, mercCount)}
            >
              ⚔️ {isBoss ? 'ĐI SĂN BOSS NGAY!' : 'KHIÊU CHIẾN PHÓ BẢN'}
            </button>
            {cleared && onSweepStage && (
              <button
                type="button"
                className="pk-btn-blue"
                style={{ flex: 0.9, padding: '9px 10px', fontSize: 11.5 }}
                onClick={() => setSweepNotice(onSweepStage(st))}
              >
                ⚡ Càn Quét
              </button>
            )}
            <button
              type="button"
              className="pk-btn-red"
              style={{ padding: '9px 12px', fontSize: 11.5 }}
              onClick={() => setSelectedStage(null)}
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="stage-modal-backdrop" onClick={onClose}>
      <div
        className="pk-modal"
        style={{
          maxWidth: 980,
          maxHeight: 655,
          background:
            "linear-gradient(180deg, rgba(6, 18, 52, 0.86), rgba(4, 10, 32, 0.95)), url('/assets/pokiguard/sprites/bg_islands.png') center/cover",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER TABS */}
        <div className="pk-modal-header" style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
            {(
              [
                ['ISLANDS', '🗺️ 6 Đảo'],
                ['TOWER', '🗼 Tháp 10T'],
                ['HUNT', '🐉 Săn Boss'],
                ['SPECIAL', '🏛️ Mega & Lăng Mộ'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={tab === k ? 'pk-btn-gold' : 'pk-btn-blue'}
                style={{ padding: '4px 9px', fontSize: 10.5, whiteSpace: 'nowrap' }}
                onClick={() => {
                  setTab(k);
                  setSelectedStage(null);
                  if (k !== 'ISLANDS') setSelectedIslandId(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pk-ribbon-title" style={{ minWidth: 205, fontSize: 13.5 }}>
            PHÓ BẢN ẢI VIỄN CHINH
          </div>
          <button type="button" className="pk-close-orb" aria-label="Đóng" onClick={onClose}>
            <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
          </button>
        </div>

        {sweepNotice && (
          <div
            className="pk-stone-panel"
            style={{ padding: '6px 12px', marginBottom: 8, borderColor: '#4ade80', color: '#fef08a', fontSize: 11.5, fontWeight: 900 }}
          >
            {sweepNotice}
          </div>
        )}

        {selectedStage ? (
          renderStageDetailPrep(selectedStage)
        ) : (
          <>
            {/* ==================== TAB 1: BẢN ĐỒ 6 ĐẢO NỔI NỐI LIỀN NHAU ==================== */}
            {tab === 'ISLANDS' && !selectedIsland && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    position: 'relative',
                    height: 392,
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: '2px solid rgba(250, 204, 21, 0.55)',
                    background:
                      "radial-gradient(circle at 50% 48%, rgba(168, 85, 247, 0.34), rgba(15, 23, 42, 0.88) 68%), url('/assets/pokiguard/sprites/bg_islands.png') center/cover",
                  }}
                >
                  {/* Segmented Glowing Flight Trail linking Đảo 1 -> Đảo 6 */}
                  <svg
                    viewBox="0 0 1000 400"
                    preserveAspectRatio="none"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  >
                    <circle cx="500" cy="200" r="158" fill="none" stroke="rgba(216,180,254,0.28)" strokeWidth="3" strokeDasharray="10 8" />
                    <circle cx="500" cy="200" r="120" fill="none" stroke="rgba(56,189,248,0.24)" strokeWidth="2" />
                    {DUNGEON_ISLANDS.slice(0, -1).map((fromIsl, i) => {
                      const toIsl = DUNGEON_ISLANDS[i + 1];
                      const unlockedNext = isIslandUnlocked(toIsl.order);
                      return (
                        <line
                          key={fromIsl.id}
                          x1={fromIsl.xPercent * 10}
                          y1={fromIsl.yPercent * 4}
                          x2={toIsl.xPercent * 10}
                          y2={toIsl.yPercent * 4}
                          stroke={unlockedNext ? '#4ade80' : '#fde047'}
                          strokeWidth={unlockedNext ? 5 : 3.5}
                          strokeDasharray={unlockedNext ? undefined : '10 8'}
                          strokeOpacity={unlockedNext ? 0.92 : 0.55}
                        />
                      );
                    })}
                  </svg>

                  {DUNGEON_ISLANDS.map((isl) => {
                    const stList = PVE_STAGES.filter((s) => s.islandId === isl.id);
                    const doneCount = stList.filter((s) => clearedSet.has(s.id)).length;
                    const bossPet = getPetById(isl.bossPetId);
                    const unlocked = isIslandUnlocked(isl.order);
                    const allDone = doneCount === stList.length && stList.length > 0;
                    return (
                      <button
                        key={isl.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => unlocked && setSelectedIslandId(isl.id)}
                        style={{
                          position: 'absolute',
                          left: `${isl.xPercent}%`,
                          top: `${isl.yPercent}%`,
                          transform: 'translate(-50%, -50%)',
                          width: 138,
                          padding: '7px 8px',
                          borderRadius: 14,
                          background: unlocked
                            ? 'linear-gradient(180deg, rgba(12, 28, 68, 0.94), rgba(5, 12, 34, 0.96))'
                            : 'rgba(15, 23, 42, 0.86)',
                          border: `2px solid ${!unlocked ? '#475569' : allDone ? '#4ade80' : isl.colorHex}`,
                          boxShadow: unlocked
                            ? `0 6px 20px rgba(0,0,0,0.85), 0 0 16px ${isl.colorHex}66`
                            : '0 4px 12px rgba(0,0,0,0.65)',
                          cursor: unlocked ? 'pointer' : 'not-allowed',
                          filter: unlocked ? 'none' : 'grayscale(0.75) brightness(0.75)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 3,
                          color: '#fff',
                        }}
                      >
                        <img
                          src={getPetSpritePath(bossPet)}
                          alt={bossPet.name}
                          style={{ width: 52, height: 52, objectFit: 'contain', filter: 'drop-shadow(0 3px 6px #000)' }}
                        />
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#fef08a', textAlign: 'center', lineHeight: 1.12 }}>
                          {isl.name}
                        </div>
                        <div style={{ fontSize: 9, color: '#cbd5e1', textAlign: 'center', lineHeight: 1.15 }}>
                          Boss: {bossPet.name}
                        </div>
                        <span
                          style={{
                            marginTop: 2,
                            padding: '1px 7px',
                            borderRadius: 999,
                            background: !unlocked ? '#334155' : allDone ? '#15803d' : '#1e3a8a',
                            border: `1px solid ${!unlocked ? '#64748b' : allDone ? '#4ade80' : '#38bdf8'}`,
                            fontSize: 9.2,
                            fontWeight: 900,
                            color: !unlocked ? '#cbd5e1' : allDone ? '#bbf7d0' : '#fde047',
                          }}
                        >
                          {!unlocked
                            ? `🔒 Hạ Boss Đảo ${isl.order - 1}`
                            : allDone
                              ? `✅ HOÀN THÀNH (${doneCount}/${stList.length})`
                              : `⚔️ ${doneCount}/${stList.length} Ải`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom NHIỆM VỤ SĂN BOSS bar */}
                <div
                  className="pk-stone-panel"
                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: 900, color: '#fde047' }}>
                    📜 NHIỆM VỤ SĂN BOSS &amp; THU PHỤC (Vượt từng ải nối liền — Thắng lần đầu nhận Pet!):
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {huntQuests.map((q) => {
                      const done = clearedSet.has(q.id);
                      const targetSt = PVE_STAGES.find((s) => s.id === q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => targetSt && setSelectedStage(targetSt)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: done ? 'rgba(22, 101, 52, 0.85)' : 'rgba(127, 29, 29, 0.85)',
                            border: `1px solid ${done ? '#4ade80' : '#fb7185'}`,
                            color: done ? '#bbf7d0' : '#fecdd3',
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {done ? '✅' : '🎯'} {q.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== ISLAND DETAIL: BẢN ĐỒ TỪNG ẢI NỐI LIỀN NHAU (Ải 1 -> 2 -> 3 -> 4 -> BOSS) ==================== */}
            {tab === 'ISLANDS' && selectedIsland && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  className="pk-stone-panel"
                  style={{
                    padding: '8px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderColor: selectedIsland.colorHex,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#fde047' }}>{selectedIsland.name}</div>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                      {selectedIsland.subtitle} • Vượt lần lượt từng ải nối liền để mở Boss Đảo &amp; thu phục Pet!
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pk-btn-blue"
                    style={{ padding: '6px 12px', fontSize: 11.5 }}
                    onClick={() => setSelectedIslandId(null)}
                  >
                    ⬅ Bản Đồ 6 Đảo
                  </button>
                </div>

                {/* Scenic Connected Stage-Path Canvas */}
                <div
                  style={{
                    position: 'relative',
                    height: 404,
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: `2px solid ${selectedIsland.colorHex}`,
                    background: `linear-gradient(180deg, rgba(6, 18, 48, 0.56), rgba(4, 12, 32, 0.82)), url('${selectedIsland.bgSprite}') center/cover`,
                  }}
                >
                  {/* Winding SVG Path linking Stage 1 -> 2 -> 3 -> 4 -> BOSS */}
                  <svg
                    viewBox="0 0 1000 400"
                    preserveAspectRatio="none"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  >
                    {islandStages.slice(0, -1).map((st, idx) => {
                      const c1 = ISLAND_STAGE_COORDS[idx] ?? { x: 15 + idx * 20, y: 50 };
                      const c2 = ISLAND_STAGE_COORDS[idx + 1] ?? { x: 35 + idx * 20, y: 50 };
                      const segCleared = clearedSet.has(st.id);
                      const mx = (c1.x * 10 + c2.x * 10) / 2;
                      const my = (c1.y * 4 + c2.y * 4) / 2 + (idx % 2 === 0 ? -36 : 36);
                      const d = `M ${c1.x * 10} ${c1.y * 4} Q ${mx} ${my} ${c2.x * 10} ${c2.y * 4}`;
                      return (
                        <g key={st.id}>
                          <path
                            d={d}
                            fill="none"
                            stroke={segCleared ? '#4ade80' : '#facc15'}
                            strokeWidth={segCleared ? 9 : 6}
                            strokeOpacity={segCleared ? 0.35 : 0.2}
                          />
                          <path
                            d={d}
                            fill="none"
                            stroke={segCleared ? '#4ade80' : '#fde047'}
                            strokeWidth={segCleared ? 4.5 : 3.5}
                            strokeDasharray={segCleared ? undefined : '11 8'}
                            strokeOpacity={segCleared ? 0.96 : 0.72}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* 5 Connected Stage Nodes along the trail */}
                  {islandStages.map((st, idx) => {
                    const coord = ISLAND_STAGE_COORDS[idx] ?? { x: 12 + idx * 19, y: 50 };
                    const pet = getPetById(st.enemyPetId);
                    const cleared = clearedSet.has(st.id);
                    const unlocked = isStageUnlockedInChain(islandStages, idx);
                    const isFrontier = unlocked && !cleared;
                    const isBoss = Boolean(st.isBoss);

                    return (
                      <div
                        key={st.id}
                        style={{
                          position: 'absolute',
                          left: `${coord.x}%`,
                          top: `${coord.y}%`,
                          transform: 'translate(-50%, -50%)',
                          width: isBoss ? 156 : 144,
                          padding: isBoss ? '9px 9px' : '7px 8px',
                          borderRadius: 15,
                          background: !unlocked
                            ? 'rgba(15, 23, 42, 0.88)'
                            : isBoss
                              ? 'linear-gradient(180deg, rgba(136, 19, 55, 0.94), rgba(15, 23, 42, 0.96))'
                              : 'linear-gradient(180deg, rgba(12, 32, 74, 0.94), rgba(6, 16, 40, 0.96))',
                          border: `2.5px solid ${
                            !unlocked ? '#475569' : isBoss ? '#fb7185' : isFrontier ? '#fde047' : '#4ade80'
                          }`,
                          boxShadow: isFrontier
                            ? '0 0 22px rgba(250, 204, 21, 0.85), 0 8px 20px rgba(0,0,0,0.85)'
                            : isBoss && unlocked
                              ? '0 0 20px rgba(244, 63, 94, 0.75), 0 8px 20px rgba(0,0,0,0.85)'
                              : '0 6px 18px rgba(0,0,0,0.8)',
                          filter: unlocked ? 'none' : 'grayscale(0.8) brightness(0.75)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 3,
                          textAlign: 'center',
                        }}
                      >
                        {/* Stage Step Pill */}
                        <div
                          style={{
                            fontSize: 9.5,
                            fontWeight: 900,
                            padding: '1px 8px',
                            borderRadius: 999,
                            background: isBoss ? '#be123c' : isFrontier ? '#ca8a04' : cleared ? '#15803d' : '#334155',
                            color: '#fff',
                          }}
                        >
                          {isBoss
                            ? `👑 BOSS ĐẢO ${selectedIsland.order}`
                            : isFrontier
                              ? `⚔️ ẢI ${selectedIsland.order}-${st.stageOrder} (MỞ)`
                              : `ẢI ${selectedIsland.order}-${st.stageOrder}`}
                        </div>

                        <img
                          src={getPetSpritePath(pet)}
                          alt={pet.name}
                          style={{
                            width: isBoss ? 72 : 62,
                            height: isBoss ? 72 : 62,
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 4px 8px #000)',
                          }}
                        />

                        <div style={{ fontSize: 11.5, fontWeight: 900, color: '#fef08a', lineHeight: 1.1 }}>
                          {pet.name}
                        </div>
                        <div style={{ fontSize: 9, color: '#cbd5e1' }}>
                          LC: {st.recommendedPower.toLocaleString()}
                        </div>

                        <div style={{ fontSize: 8.8, fontWeight: 900, color: cleared ? '#7dd3fc' : '#86efac' }}>
                          {!unlocked
                            ? '🔒 Vượt ải trước'
                            : cleared
                              ? '✅ Đã Thu Phục'
                              : '🎁 Thắng: Nhận Pet!'}
                        </div>

                        <div style={{ display: 'flex', gap: 4, width: '100%', marginTop: 2 }}>
                          <button
                            type="button"
                            className={unlocked ? 'pk-btn-gold' : 'pk-btn-blue'}
                            disabled={!unlocked}
                            style={{ flex: 1, padding: '4px 6px', fontSize: 10 }}
                            onClick={() => unlocked && setSelectedStage(st)}
                          >
                            {!unlocked ? '🔒 Khóa' : '⚔️ Chiến'}
                          </button>
                          {cleared && onSweepStage && (
                            <button
                              type="button"
                              className="pk-btn-blue"
                              style={{ padding: '4px 7px', fontSize: 10 }}
                              title="Càn quét nhận Vàng & Đá"
                              onClick={() => setSweepNotice(onSweepStage(st))}
                            >
                              ⚡
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==================== TAB 2: VƯỢT ẢI — THÁP PHA LÊ 10 TẦNG NỐI LIỀN NHAU ==================== */}
            {tab === 'TOWER' && (
              <div
                style={{
                  position: 'relative',
                  height: 472,
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '2px solid rgba(56, 189, 248, 0.65)',
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.25), rgba(6, 15, 38, 0.94) 72%), url('/assets/pokiguard/sprites/bg_legend.png') center/cover",
                }}
              >
                {/* S-Curve Connected Ascent Trail: Tầng 1 -> 5 (bottom row) -> up to 6 -> 10 (top row) */}
                <svg
                  viewBox="0 0 1000 470"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                >
                  {towerStages.slice(0, -1).map((st, idx) => {
                    const c1 = TOWER_FLOOR_COORDS[idx];
                    const c2 = TOWER_FLOOR_COORDS[idx + 1];
                    const cleared = clearedSet.has(st.id);
                    return (
                      <line
                        key={st.id}
                        x1={c1.x * 10}
                        y1={c1.y * 4.7}
                        x2={c2.x * 10}
                        y2={c2.y * 4.7}
                        stroke={cleared ? '#4ade80' : '#38bdf8'}
                        strokeWidth={cleared ? 5 : 3.5}
                        strokeDasharray={cleared ? undefined : '10 7'}
                        strokeOpacity={cleared ? 0.95 : 0.6}
                      />
                    );
                  })}
                </svg>

                {towerStages.map((st, idx) => {
                  const coord = TOWER_FLOOR_COORDS[idx];
                  const pet = getPetById(st.enemyPetId);
                  const cleared = clearedSet.has(st.id);
                  const unlocked = isStageUnlockedInChain(towerStages, idx);
                  const isFrontier = unlocked && !cleared;
                  const isBoss = Boolean(st.isBoss);
                  return (
                    <div
                      key={st.id}
                      style={{
                        position: 'absolute',
                        left: `${coord.x}%`,
                        top: `${coord.y}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 158,
                        padding: '7px 8px',
                        borderRadius: 13,
                        background: !unlocked
                          ? 'rgba(15, 23, 42, 0.9)'
                          : isBoss
                            ? 'linear-gradient(180deg, rgba(136, 19, 55, 0.94), rgba(15, 23, 42, 0.96))'
                            : 'linear-gradient(180deg, rgba(12, 32, 74, 0.94), rgba(6, 16, 40, 0.96))',
                        border: `2px solid ${!unlocked ? '#475569' : isBoss ? '#fb7185' : isFrontier ? '#fde047' : '#4ade80'}`,
                        boxShadow: isFrontier ? '0 0 18px rgba(250, 204, 21, 0.8)' : '0 6px 14px rgba(0,0,0,0.8)',
                        filter: unlocked ? 'none' : 'grayscale(0.8) brightness(0.75)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 9.5, fontWeight: 900, color: isBoss ? '#fda4af' : '#7dd3fc' }}>
                        🗼 Tầng {st.stageOrder} {isBoss ? '• BOSS' : ''}
                      </div>
                      <img src={getPetSpritePath(pet)} alt={pet.name} style={{ width: 54, height: 54, objectFit: 'contain' }} />
                      <div style={{ fontSize: 11, fontWeight: 900, color: '#fef08a', lineHeight: 1.1 }}>{pet.name}</div>
                      <div style={{ fontSize: 8.8, color: cleared ? '#7dd3fc' : '#86efac', fontWeight: 800 }}>
                        {!unlocked ? '🔒 Chưa mở' : cleared ? '✅ Đã Thu Phục' : '🎁 Thắng: Nhận Pet!'}
                      </div>
                      <button
                        type="button"
                        className={unlocked ? 'pk-btn-gold' : 'pk-btn-blue'}
                        disabled={!unlocked}
                        style={{ width: '100%', padding: '3.5px 6px', fontSize: 10, marginTop: 2 }}
                        onClick={() => unlocked && setSelectedStage(st)}
                      >
                        {!unlocked ? '🔒 Khóa' : '⚔️ Leo Tầng'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ==================== TAB 3: ĐI SĂN SIÊU BOSS ==================== */}
            {tab === 'HUNT' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, maxHeight: 485, overflowY: 'auto' }}>
                {huntStages.map((st) => {
                  const pet = getPetById(st.enemyPetId);
                  const hp = Math.round(pet.maxHp * st.enemyScale * 1.65);
                  const atk = Math.round(pet.attack * st.enemyScale * 1.22);
                  const def = Math.round(pet.defense * st.enemyScale * 1.18);
                  return (
                    <div
                      key={st.id}
                      className="pk-stone-panel"
                      style={{
                        padding: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        borderColor: '#f43f5e',
                        background: 'linear-gradient(135deg, rgba(127, 29, 29, 0.55), rgba(15, 23, 42, 0.94))',
                      }}
                    >
                      <img
                        src={getPetSpritePath(pet)}
                        alt={pet.name}
                        style={{ width: 92, height: 92, objectFit: 'contain', filter: 'drop-shadow(0 6px 12px #000)' }}
                      />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 900, color: '#fde047' }}>👑 {st.name}</div>
                        <div style={{ fontSize: 10.5, color: '#fecdd3' }}>{st.subtitle}</div>
                        <div style={{ fontSize: 10.5, fontWeight: 900, color: '#4ade80' }}>
                          HP: {hp.toLocaleString()} • Công: {atk.toLocaleString()} • Thủ: {def.toLocaleString()}
                        </div>
                        <div>{renderCaptureBadge(st)}</div>
                        <button
                          type="button"
                          className="pk-btn-gold"
                          style={{ marginTop: 3, padding: '6px 10px', fontSize: 11.5 }}
                          onClick={() => setSelectedStage(st)}
                        >
                          🐉 ĐI SĂN NGAY!
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ==================== TAB 4: ĐẤU TRƯỜNG MEGA-GALAXY & LĂNG MỘ ==================== */}
            {tab === 'SPECIAL' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 9, maxHeight: 485, overflowY: 'auto' }}>
                {specialStages.map((st) => {
                  const pet = getPetById(st.enemyPetId);
                  return (
                    <div
                      key={st.id}
                      className="pk-stone-panel"
                      style={{
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 5,
                        textAlign: 'center',
                        borderColor: st.mode === 'MEGA_ARENA' ? '#f59e0b' : '#a855f7',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 900, color: '#fde047' }}>{st.islandName}</div>
                      <img src={getPetSpritePath(pet)} alt={pet.name} style={{ width: 72, height: 72, objectFit: 'contain' }} />
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{pet.name}</div>
                      <div style={{ fontSize: 9.5, color: '#cbd5e1' }}>LC: {st.recommendedPower.toLocaleString()}</div>
                      {renderCaptureBadge(st)}
                      <button
                        type="button"
                        className="pk-btn-gold"
                        style={{ width: '100%', padding: '5px 8px', fontSize: 11, marginTop: 'auto' }}
                        onClick={() => setSelectedStage(st)}
                      >
                        ⚔️ Khiêu Chiến
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
