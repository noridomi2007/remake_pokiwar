import {
  DEFAULT_MAILS,
  getPetById,
  getPetSpritePath,
  GUILD_BOSSES,
  ONLINE_REWARDS,
  simulateKingArenaBattle,
  SPACE_SHIPS,
  STARTER_PETS,
  type GuildBossDef,
  type MailItemDef,
  type SpaceShipDef,
} from '@pokiwar/shared';
import { useEffect, useState } from 'react';
import type { PlayerProgress } from './MainLobby.js';

interface SocialHubModalProps {
  progress: PlayerProgress;
  initialTab?: 'GUILD' | 'SPACE' | 'ONLINE' | 'MAIL';
  onlineSeconds: number;
  onClose: () => void;
  onGuildDonate: (goldCost: number) => { success: boolean; message: string };
  onFightGuildBoss: (boss: GuildBossDef) => { success: boolean; message: string };
  onGuild3v3Win: (won: boolean, gloryReward: number, goldReward: number) => void;
  onFinishSpaceTrip: (ship: SpaceShipDef) => string;
  onClaimOnlineReward: (rewardId: string) => { success: boolean; message: string };
  onClaimMail: (mail: MailItemDef) => { success: boolean; message: string };
  onJoinOrRenameGuild: (guildName: string) => void;
}

export function SocialHubModal({
  progress,
  initialTab = 'GUILD',
  onlineSeconds,
  onClose,
  onGuildDonate,
  onFightGuildBoss,
  onGuild3v3Win,
  onFinishSpaceTrip,
  onClaimOnlineReward,
  onClaimMail,
  onJoinOrRenameGuild,
}: SocialHubModalProps) {
  const [tab, setTab] = useState<'GUILD' | 'SPACE' | 'ONLINE' | 'MAIL'>(initialTab);
  const [notice, setNotice] = useState<string | null>(null);
  const [guildNameInput, setGuildNameInput] = useState(progress.guildName ?? 'Hội Quán ZingMe');
  const [activeShipId, setActiveShipId] = useState<string | null>(null);
  const [shipSecondsLeft, setShipSecondsLeft] = useState(0);
  const [shipTierOffset, setShipTierOffset] = useState(0);

  const guildName = progress.guildName ?? 'Hội Quán ZingMe';
  const guildLv = progress.guildLevel ?? 1;
  const guildExp = progress.guildExp ?? 0;
  const guildExpNeed = guildLv * 500;
  const claimedOnline = progress.claimedOnlineRewards ?? [];
  const claimedMails = progress.claimedMailIds ?? [];

  useEffect(() => {
    if (!activeShipId || shipSecondsLeft <= 0) return;
    const t = window.setTimeout(() => setShipSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [activeShipId, shipSecondsLeft]);

  const handleLaunchShip = (ship: SpaceShipDef) => {
    setActiveShipId(ship.id);
    setShipSecondsLeft(ship.durationSec);
    setNotice(`🚀 Đã phóng ${ship.name}! Đợi ${ship.durationSec} giây để thu hoạch kho báu Vũ Trụ...`);
  };

  const handleClaimShip = (ship: SpaceShipDef) => {
    const msg = onFinishSpaceTrip(ship);
    setActiveShipId(null);
    setShipSecondsLeft(0);
    setNotice(msg);
  };

  const handleRunGuild3v3 = () => {
    const unlocked = progress.unlockedPets ?? [progress.selectedPetId, 'pet-583', 'pet-1431', 'pet-725'];
    const p3 = [0, 1, 2].map((slot) => {
      const pid = unlocked[slot % unlocked.length] ?? progress.selectedPetId;
      return {
        slot,
        pet: getPetById(pid),
        level: progress.petLevels[pid] ?? 1,
        stars: Math.max(1, Math.min(6, progress.petStars?.[pid] ?? 1)),
        genLevel: Math.max(0, Math.min(5, progress.petGenLevels?.[pid] ?? 0)),
      };
    });
    const enemyPool = STARTER_PETS.filter((p) => p.tier === 'MEGA' || p.tier === 'GALAXY');
    const e3 = [0, 1, 2].map((slot) => ({
      slot,
      pet: enemyPool[(slot + Math.floor(Math.random() * enemyPool.length)) % enemyPool.length],
      level: Math.max(5, guildLv * 4),
      stars: Math.min(5, 2 + Math.floor(guildLv / 2)),
      genLevel: Math.min(3, Math.floor(guildLv / 3)),
    }));
    const res = simulateKingArenaBattle(p3, e3, Date.now());
    const won = res.winner === 'P1';
    onGuild3v3Win(won, won ? 130 : 40, won ? 1100 : 300);
    setNotice(
      won
        ? `⚔️ CHIẾN BANG 3v3 THẮNG LỢI (${res.playerSurvivors}/3 sống sót sau ${res.rounds} hiệp)! Nhận +130 Xu Vinh Quang & +1,100 Vàng!`
        : `💥 Chiến Bang 3v3 thất bại sau ${res.rounds} hiệp! Nhận +40 Xu & +300 Vàng khích lệ.`,
    );
  };

  const activeShip = SPACE_SHIPS.find((s) => s.id === activeShipId) ?? null;

  return (
    <div className="stage-modal-backdrop" onClick={onClose}>
      <div className="pk-modal" style={{ maxWidth: 920, maxHeight: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="pk-modal-header">
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={tab === 'GUILD' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 10px', fontSize: 11.5 }}
              onClick={() => setTab('GUILD')}
            >
              🏰 Hội Quán
            </button>
            <button
              type="button"
              className={tab === 'SPACE' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 10px', fontSize: 11.5 }}
              onClick={() => setTab('SPACE')}
            >
              🚀 Thám Hiểm Vũ Trụ
            </button>
            <button
              type="button"
              className={tab === 'ONLINE' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 10px', fontSize: 11.5 }}
              onClick={() => setTab('ONLINE')}
            >
              ⏱️ Quà Online
            </button>
            <button
              type="button"
              className={tab === 'MAIL' ? 'pk-btn-gold' : 'pk-btn-blue'}
              style={{ padding: '5px 10px', fontSize: 11.5 }}
              onClick={() => setTab('MAIL')}
            >
              ✉️ Hộp Thư
            </button>
          </div>
          <div className="pk-ribbon-title" style={{ minWidth: 210, fontSize: 14 }}>
            HOẠT ĐỘNG POKIWAR 4.0
          </div>
          <button type="button" className="pk-close-orb" aria-label="Đóng" onClick={onClose}>
            <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
          </button>
        </div>

        {notice && (
          <div
            className="pk-stone-panel"
            style={{ padding: '7px 12px', marginBottom: 8, borderColor: '#4ade80', color: '#fef08a', fontSize: 12, fontWeight: 900 }}
          >
            {notice}
          </div>
        )}

        {/* TAB 1: HỘI QUÁN (GUILD + BOSS BANG + CHIẾN BANG 3V3) */}
        {tab === 'GUILD' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pk-stone-panel" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/assets/pokiguard/sprites/Buildings-Guild.png" alt="Hội Quán" style={{ width: 64, height: 58, objectFit: 'contain' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 900, fontSize: 16, color: '#fde047' }}>{guildName}</span>
                    <span style={{ fontSize: 11, fontWeight: 900, padding: '1px 8px', borderRadius: 999, background: '#16a34a', color: '#fff' }}>
                      Cấp {guildLv}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#86efac', fontWeight: 800 }}>
                    Phúc lợi Hội Quán: +{guildLv * 120} HP &amp; +{guildLv * 18} Công vĩnh viễn cho mọi trận đấu!
                  </div>
                  <div style={{ fontSize: 10.5, color: '#93c5fd' }}>
                    EXP Bang: {guildExp}/{guildExpNeed}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 250 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={guildNameInput}
                    onChange={(e) => setGuildNameInput(e.target.value)}
                    maxLength={20}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: 7,
                      border: '1px solid #38bdf8',
                      background: '#050d21',
                      color: '#fff',
                      fontSize: 11.5,
                      fontWeight: 700,
                    }}
                  />
                  <button
                    type="button"
                    className="pk-btn-blue"
                    style={{ padding: '5px 9px', fontSize: 11 }}
                    onClick={() => {
                      onJoinOrRenameGuild(guildNameInput.trim() || 'Hội Quán ZingMe');
                      setNotice(`🏰 Đã cập nhật tên Hội Quán thành "${guildNameInput.trim()}"!`);
                    }}
                  >
                    Đổi tên
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="pk-btn-gold"
                    style={{ flex: 1, padding: '6px 8px', fontSize: 11 }}
                    disabled={progress.gold < 400}
                    onClick={() => setNotice(onGuildDonate(400).message)}
                  >
                    💰 Cống Hiến (400V)
                  </button>
                  <button
                    type="button"
                    className="pk-btn-orange"
                    style={{ flex: 1, padding: '6px 8px', fontSize: 11 }}
                    onClick={handleRunGuild3v3}
                  >
                    ⚔️ Chiến Bang 3v3
                  </button>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 900, color: '#fde047' }}>
              👹 BOSS HỘI QUÁN (SĂN BOSS CÙNG ANH EM — RƠI XU VINH QUANG &amp; MẢNH HIẾM):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {GUILD_BOSSES.map((boss) => (
                <div
                  key={boss.id}
                  className="pk-stone-panel"
                  style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}
                >
                  <img src={`/assets/pokiguard/pets/${boss.spriteId}.png`} alt={boss.name} style={{ width: 84, height: 84, objectFit: 'contain' }} />
                  <div style={{ fontWeight: 900, fontSize: 12.5, color: '#fef08a' }}>{boss.name}</div>
                  <div style={{ fontSize: 10.5, color: '#cbd5e1' }}>{boss.subtitle}</div>
                  <div style={{ fontSize: 10.5, color: '#4ade80', fontWeight: 800 }}>
                    +{boss.rewardGlory} Xu • +{boss.rewardGold}V • +{boss.rewardShards} Mảnh
                  </div>
                  <button
                    type="button"
                    className="pk-btn-orange"
                    style={{ width: '100%', padding: '7px 10px', fontSize: 11.5, marginTop: 'auto' }}
                    onClick={() => setNotice(onFightGuildBoss(boss).message)}
                  >
                    🔥 Đánh Boss Hội Quán (-10 Thể Lực)
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: THÁM HIỂM VŨ TRỤ (5 CẤP PHI THUYỀN) */}
        {tab === 'SPACE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pk-stone-panel" style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span>
                🚀 <strong>Thám Hiểm Vũ Trụ Pokiwar 4.0</strong>: Chọn 1 trong 5 cấp Phi Thuyền để thu thập Tinh Thể Gen T2, Xu Vinh Quang &amp; Mảnh Galaxy/Titan!
              </span>
              <button
                type="button"
                className="pk-btn-blue"
                style={{ padding: '4px 10px', fontSize: 11 }}
                disabled={Boolean(activeShipId)}
                onClick={() => {
                  setShipTierOffset((o) => (o + 1) % 3);
                  setNotice('🔄 Đã làm mới tuyến bay Thám Hiểm Vũ Trụ!');
                }}
              >
                🔄 Làm Mới Tàu
              </button>
            </div>

            {activeShip && (
              <div className="pk-stone-panel" style={{ padding: 12, borderColor: '#fde047', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14, color: '#fde047' }}>
                    🛰️ Đang Thám Hiểm: {activeShip.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#86efac' }}>
                    {shipSecondsLeft > 0
                      ? `Tàu đang vượt tinh vân... còn ${shipSecondsLeft} giây nữa cập bến!`
                      : '✅ Phi thuyền đã trở về mang theo kho báu! Hãy nhấn Nhận Quà!'}
                  </div>
                </div>
                <button
                  type="button"
                  className="pk-btn-gold"
                  disabled={shipSecondsLeft > 0}
                  onClick={() => handleClaimShip(activeShip)}
                >
                  {shipSecondsLeft > 0 ? `Đang bay (${shipSecondsLeft}s)` : '🎁 Thu Hoạch Ngay!'}
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
              {SPACE_SHIPS.map((ship) => {
                const isFlying = activeShipId === ship.id;
                const bonusMult = shipTierOffset === 2 && ship.tierScore >= 200 ? 1.2 : 1;
                return (
                  <div
                    key={ship.id}
                    className="pk-stone-panel"
                    style={{
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 5,
                      textAlign: 'center',
                      borderColor: isFlying ? '#fde047' : ship.color,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 999, background: ship.color, color: '#020617' }}>
                      Cấp {ship.tierScore}
                    </span>
                    <div style={{ fontSize: 30 }}>🚀</div>
                    <div style={{ fontWeight: 900, fontSize: 11.5, color: '#fef08a' }}>{ship.name}</div>
                    <div style={{ fontSize: 9.5, color: '#cbd5e1' }}>{ship.subtitle}</div>
                    <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 800 }}>
                      +{Math.round(ship.rewardGold * bonusMult)}V • +{ship.rewardGlory} Xu
                    </div>
                    <div style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 800 }}>
                      +{ship.rewardGenCores} Gen T2 • +{ship.shardCount} Mảnh
                    </div>
                    <button
                      type="button"
                      className="pk-btn-gold"
                      style={{ width: '100%', padding: '5px 8px', fontSize: 10.5, marginTop: 'auto' }}
                      disabled={Boolean(activeShipId)}
                      onClick={() => handleLaunchShip(ship)}
                    >
                      {isFlying ? 'Đang bay...' : `Bắt Đầu (${ship.durationSec}s)`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: QUÀ ONLINE ĐẾM NGƯỢC */}
        {tab === 'ONLINE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pk-stone-panel" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#fde047' }}>
                ⏱️ Thời gian Online phiên này: {Math.floor(onlineSeconds / 60)} phút {onlineSeconds % 60} giây
              </span>
              <span style={{ fontSize: 11.5, color: '#86efac' }}>Online đủ mốc là nhận ngay Vàng, Xu Vinh Quang &amp; Gen T2!</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
              {ONLINE_REWARDS.map((rw) => {
                const claimed = claimedOnline.includes(rw.id);
                const ready = onlineSeconds >= rw.minutes * 60;
                const remainSec = Math.max(0, rw.minutes * 60 - onlineSeconds);
                return (
                  <div
                    key={rw.id}
                    className="pk-stone-panel"
                    style={{
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      textAlign: 'center',
                      borderColor: claimed ? '#4ade80' : ready ? '#fde047' : '#38bdf8',
                    }}
                  >
                    <img src="/assets/pokiguard/sprites/dock_gift.png" alt="" style={{ width: 46, height: 46, objectFit: 'contain' }} />
                    <div style={{ fontWeight: 900, fontSize: 12, color: '#fef08a' }}>Mốc {rw.minutes} Phút</div>
                    <div style={{ fontSize: 10.5, color: '#4ade80', fontWeight: 800 }}>
                      +{rw.gold}V • +{rw.gloryCoins} Xu • +{rw.stones} Đá
                    </div>
                    {rw.genCores > 0 && (
                      <div style={{ fontSize: 10, color: '#c084fc', fontWeight: 900 }}>+{rw.genCores} Tinh Thể Gen T2</div>
                    )}
                    <button
                      type="button"
                      className={ready && !claimed ? 'pk-btn-gold' : 'pk-btn-blue'}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 11, marginTop: 'auto' }}
                      disabled={claimed || !ready}
                      onClick={() => setNotice(onClaimOnlineReward(rw.id).message)}
                    >
                      {claimed ? '✓ Đã nhận' : ready ? 'Nhận Quà' : `Còn ${remainSec}s`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: HỘP THƯ (MAIL) */}
        {tab === 'MAIL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 450, overflowY: 'auto' }}>
            {DEFAULT_MAILS.map((mail) => {
              const claimed = claimedMails.includes(mail.id);
              const bonusPet = mail.rewards.petId ? getPetById(mail.rewards.petId) : null;
              return (
                <div
                  key={mail.id}
                  className="pk-stone-panel"
                  style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 14, color: '#fde047' }}>
                      ✉️ {mail.title} <span style={{ fontSize: 10.5, color: '#94a3b8' }}>({mail.sender})</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#e2e8f0', margin: '4px 0 6px', lineHeight: 1.4 }}>{mail.body}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, fontWeight: 900, color: '#4ade80' }}>
                      {mail.rewards.gold && <span>+{mail.rewards.gold} Vàng</span>}
                      {mail.rewards.gloryCoins && <span>+{mail.rewards.gloryCoins} Xu Vinh Quang</span>}
                      {mail.rewards.stones && <span>+{mail.rewards.stones} Đá</span>}
                      {mail.rewards.genCores && <span>+{mail.rewards.genCores} Gen T2</span>}
                      {mail.rewards.stamina && <span>+{mail.rewards.stamina} Thể Lực</span>}
                      {bonusPet && mail.rewards.shards && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#fde047' }}>
                          <img src={getPetSpritePath(bonusPet)} alt="" style={{ width: 20, height: 20 }} />+{mail.rewards.shards} Mảnh {bonusPet.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={claimed ? 'pk-btn-blue' : 'pk-btn-gold'}
                    style={{ padding: '8px 16px', fontSize: 12, flexShrink: 0 }}
                    disabled={claimed}
                    onClick={() => setNotice(onClaimMail(mail).message)}
                  >
                    {claimed ? 'Đã Nhận' : 'Nhận Thư'}
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
