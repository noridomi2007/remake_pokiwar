import {
  applyPetProgression,
  CARD_UPGRADE_GOLD_COSTS,
  CHARM_PRICES,
  computeAuraTotalBonuses,
  computeEquipmentBonuses,
  computePetPower,
  DEFAULT_MAILS,
  ELEMENT_META,
  getAvatarById,
  getPetById,
  getPetSpritePath,
  getSupportCardScaledLabel,
  ONLINE_REWARDS,
  rollEggGacha,
  STARTER_PETS,
  STONE_PRICES,
  SUPPORT_CARDS,
  TRAINER_AVATARS,
  WHEEL_PRIZES,
  type AuraDef,
  type ChatMessage,
  type ChestDef,
  type EggDropItem,
  type ElementType,
  type EquipmentItemDef,
  type EquipmentSlot,
  type EvolutionTier,
  type GloryShopItemDef,
  type GuildBossDef,
  type MailItemDef,
  type SpaceShipDef,
  type StageDef,
  type SupportCardId,
  type WheelPrizeDef,
} from '@pokiwar/shared';
import { useState } from 'react';
import { DungeonWorldMapModal } from './DungeonWorldMapModal.js';
import { KingArenaModal } from './KingArenaModal.js';
import { PetHouseModal } from './PetHouseModal.js';
import { Poki40CampaignModal, type ExpeditionBossDef } from './Poki40CampaignModal.js';
import { PokiExtrasModal, type AchievementDef, type MysteryShopOffer } from './PokiExtrasModal.js';
import { SocialHubModal } from './SocialHubModal.js';

export interface ReforgeBonus {
  grade: 'RARE' | 'EPIC' | 'MYTHIC';
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface PlayerProgress {
  name: string;
  avatarId?: string;
  unlockedAvatars?: string[];
  unlockedPets?: string[];
  petShards?: Record<string, number>;
  petStars?: Record<string, number>;
  petGenLevels?: Record<string, number>;
  petBreakthroughs?: Record<string, number>;
  petUpgradeLuck?: Record<string, number>;
  equippedSupportCards?: SupportCardId[];
  supportCardLevels?: Partial<Record<SupportCardId, number>>;
  claimedCheckinDays?: number[];
  redeemedCodes?: string[];
  level: number;
  exp: number;
  gold: number;
  stones: number;
  gloryCoins?: number;
  genCores?: number;
  stamina?: number;
  vipLevel?: number;
  kingArenaTeam?: string[];
  kingArenaElo?: number;
  ownedAuras?: string[];
  equippedAuraId?: string;
  guardPetId?: string | null;
  fusionPetId?: string | null;
  ownedEquipment?: string[];
  equippedEquipment?: Partial<Record<EquipmentSlot, string>>;
  equipmentReforges?: Partial<Record<EquipmentSlot, ReforgeBonus>>;
  breakthroughLv?: number;
  expeditionCleared?: string[];
  expeditionClaimedChests?: string[];
  expeditionLockedPets?: string[];
  treasureIslandAttempts?: number;
  treasureArchonKills?: number;
  treasureStormKills?: number;
  treasureClaimedChests?: string[];
  ancientArenaElo?: number;
  ancientArenaTurns?: number;
  ancientPresets?: (string | null)[][];
  guildName?: string;
  guildLevel?: number;
  guildExp?: number;
  claimedOnlineRewards?: string[];
  claimedMailIds?: string[];
  claimedAchievements?: string[];
  legendSpinCount?: number;
  stoneBag?: [number, number, number, number, number];
  charms?: { binhAn: number; mayMan: number };
  wins: number;
  worldBossBestDamage?: number;
  wheelSpunCount?: number;
  eggSmashCount?: number;
  claimedEggMilestones?: number[];
  selectedPetId: string;
  petLevels: Record<string, number>;
  petTiers: Record<string, EvolutionTier>;
  clearedStages: string[];
  claimedMissions: string[];
}

interface MainLobbyProps {
  progress: PlayerProgress;
  accountLabel?: string | null;
  pvpStatus: 'IDLE' | 'CONNECTING' | 'QUEUED' | 'WAITING_ROOM';
  roomCode: string | null;
  pvpError: string | null;
  bgmPlaying: boolean;
  muted: boolean;
  onlineSeconds?: number;
  chatMessages?: ChatMessage[];
  serverAnnounceText?: string | null;
  onSendChat?: (channel: 'WORLD' | 'SERVER' | 'GUILD', text: string) => void;
  onToggleBgm: () => void;
  onToggleMute: () => void;
  onLogout?: () => void;
  onChangeName: (name: string) => void;
  onChangeAvatar?: (avatarId: string) => void;
  onUnlockAvatar?: (avatarId: string, costGold: number) => void;
  onOpenPetUpgrade: (initialTab?: 'UPGRADE' | 'EVOLVE_TREE') => void;
  onStartPve: (stage: StageDef, mercenaryCount?: number) => void;
  onSweepStage?: (stage: StageDef) => string;
  onChangeSupportLoadout?: (cards: SupportCardId[]) => void;
  onUpgradeSupportCard?: (cardId: SupportCardId) => { success: boolean; message: string };
  onClaimCheckin?: (day: number) => string;
  onRedeemGiftcode?: (code: string) => { success: boolean; message: string };
  onSaveKingTeam?: (teamIds: string[]) => void;
  onFinishKingMatch?: (won: boolean, gloryReward: number, goldReward: number, eloDelta: number, opponentLabel: string) => void;
  onBuyGloryItem?: (item: GloryShopItemDef, cost: number) => { success: boolean; message: string };
  onOpenChest?: (chest: ChestDef) => { success: boolean; message: string };
  onBuyOrEquipAura?: (aura: AuraDef) => { success: boolean; message: string };
  onSetGuardPet?: (petId: string | null) => void;
  onSetFusionPet?: (petId: string | null) => void;
  onBuyOrEquipItem?: (item: EquipmentItemDef) => { success: boolean; message: string };
  onBreakthrough?: () => { success: boolean; message: string };
  onReforgeSlot?: (slot: EquipmentSlot) => { success: boolean; message: string };
  onStartExpeditionBoss?: (boss: ExpeditionBossDef, stage: StageDef) => void;
  onClaimExpeditionChest?: (boss: ExpeditionBossDef) => { success: boolean; message: string };
  onResetExpeditionSeason?: () => { success: boolean; message: string };
  onStartTreasureGuard?: (kind: 'ARCHON' | 'STORM', stage: StageDef) => void;
  onClaimTreasureChest?: (chest: 'SILVER' | 'GOLD') => { success: boolean; message: string };
  onSaveAncientPreset?: (presetIdx: number, grid: (string | null)[]) => void;
  onFinishAncientMatch?: (won: boolean, glory: number, gold: number, eloDelta: number, opponentName: string) => void;
  onClaimPyramidReward?: (payload: {
    goldCost: number;
    goldGain?: number;
    gloryGain?: number;
    genGain?: number;
    stoneLv4Gain?: number;
    petId?: string;
    shardGain?: number;
    isJackpot?: boolean;
  }) => { success: boolean; message: string };
  onBuyMysteryOffer?: (offer: MysteryShopOffer) => { success: boolean; message: string };
  onRefreshMystery?: (goldCost: number) => boolean;
  onSpinLegendWheel?: (count: 1 | 5) => { success: boolean; results: { label: string; icon: string; rarity: 'EPIC' | 'LEGENDARY' }[]; message: string };
  onClaimAchievement?: (ach: AchievementDef) => { success: boolean; message: string };
  onGuildDonate?: (goldCost: number) => { success: boolean; message: string };
  onFightGuildBoss?: (boss: GuildBossDef) => { success: boolean; message: string };
  onGuild3v3Win?: (won: boolean, gloryReward: number, goldReward: number) => void;
  onFinishSpaceTrip?: (ship: SpaceShipDef) => string;
  onClaimOnlineReward?: (rewardId: string) => { success: boolean; message: string };
  onClaimMail?: (mail: MailItemDef) => { success: boolean; message: string };
  onJoinOrRenameGuild?: (guildName: string) => void;
  onQuickMatch: () => void;
  onCancelQueue: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onBuyStones: (amount: number, goldCost: number) => void;
  onBuyStoneLv?: (lvIdx: number, count: number, goldCost: number) => void;
  onBuyCharm?: (kind: 'binhAn' | 'mayMan', goldCost: number) => void;
  onSpinWheel?: (prize: WheelPrizeDef, goldCost: number) => void;
  onSpinWheelBatch?: (prizes: WheelPrizeDef[], goldCost: number) => void;
  onSmashEgg?: (drops: EggDropItem[], goldCost: number, stoneCost: number) => void;
  onClaimEggMilestone?: (milestone: number, petId: string, shards: number, gold: number) => void;
  onClaimMission: (missionId: string, goldReward: number, stoneReward: number) => void;
}

type ModalTab =
  | null
  | 'PVE'
  | 'PVP'
  | 'SHOP'
  | 'MISSIONS'
  | 'PROFILE'
  | 'WHEEL'
  | 'DEX'
  | 'RANK'
  | 'CARDS'
  | 'EGG'
  | 'GIFTCODE'
  | 'KING_ARENA'
  | 'PET_HOUSE'
  | 'SOCIAL_HUB'
  | 'POKI_EXTRAS'
  | 'POKI40_CAMPAIGN';
type PveSubTab = 'STORY' | 'ZODIAC_TOMB' | 'ENDLESS_TOWER' | 'BOSS' | 'MEGA_ARENA';

const TOP_GRANDMASTERS = [
  { name: 'Long Vương Zida', petId: 'pet-mega-zidarose', avatarId: '37', power: 4850, wins: 128 },
  { name: 'Hỏa Đế TwinFlame', petId: 'pet-mega-twinflame', avatarId: '27', power: 4120, wins: 96 },
  { name: 'Thánh Kỵ Elpidios', petId: 'pet-mega-elpidios', avatarId: '32', power: 3560, wins: 81 },
  { name: 'Lôi Thần Icarus', petId: 'pet-mega-icarus', avatarId: '26', power: 2980, wins: 64 },
  { name: 'Băng Hoàng Rồng', petId: 'pet-2023', avatarId: '28', power: 2450, wins: 49 },
  { name: 'Huyền Vũ Tướng', petId: 'pet-1204', avatarId: '31', power: 1890, wins: 31 },
  { name: 'Phong Thần Điểu', petId: 'pet-807', avatarId: '34', power: 1420, wins: 19 },
] as const;

export function MainLobby({
  progress,
  accountLabel,
  pvpStatus,
  roomCode,
  pvpError,
  bgmPlaying,
  muted,
  onlineSeconds = 0,
  chatMessages = [],
  serverAnnounceText = null,
  onSendChat,
  onToggleBgm,
  onToggleMute,
  onLogout,
  onChangeName,
  onChangeAvatar,
  onUnlockAvatar,
  onOpenPetUpgrade,
  onStartPve,
  onSweepStage,
  onChangeSupportLoadout,
  onUpgradeSupportCard,
  onClaimCheckin,
  onRedeemGiftcode,
  onSaveKingTeam,
  onFinishKingMatch,
  onBuyGloryItem,
  onOpenChest,
  onBuyOrEquipAura,
  onSetGuardPet,
  onSetFusionPet,
  onBuyOrEquipItem,
  onBreakthrough,
  onReforgeSlot,
  onStartExpeditionBoss,
  onClaimExpeditionChest,
  onResetExpeditionSeason,
  onStartTreasureGuard,
  onClaimTreasureChest,
  onSaveAncientPreset,
  onFinishAncientMatch,
  onClaimPyramidReward,
  onBuyMysteryOffer,
  onRefreshMystery,
  onSpinLegendWheel,
  onClaimAchievement,
  onGuildDonate,
  onFightGuildBoss,
  onGuild3v3Win,
  onFinishSpaceTrip,
  onClaimOnlineReward,
  onClaimMail,
  onJoinOrRenameGuild,
  onQuickMatch,
  onCancelQueue,
  onCreateRoom,
  onJoinRoom,
  onBuyStones,
  onBuyStoneLv,
  onBuyCharm,
  onSpinWheel,
  onSpinWheelBatch,
  onSmashEgg,
  onClaimEggMilestone,
  onClaimMission,
}: MainLobbyProps) {
  const [modal, setModal] = useState<ModalTab>(null);
  const [pveTab, setPveTab] = useState<PveSubTab>('STORY');
  const [joinCode, setJoinCode] = useState('');
  const [dexElement, setDexElement] = useState<'ALL' | ElementType>('ALL');
  const [cardNotice, setCardNotice] = useState<string | null>(null);
  const [giftCodeInput, setGiftCodeInput] = useState('');
  const [giftNotice, setGiftNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [kingInitTab, setKingInitTab] = useState<'ARENA' | 'GLORY_SHOP' | 'PASSIVES'>('ARENA');
  const [petHouseInitTab, setPetHouseInitTab] = useState<'AURA' | 'GUARD' | 'EQUIP'>('AURA');
  const [socialInitTab, setSocialInitTab] = useState<'GUILD' | 'SPACE' | 'ONLINE' | 'MAIL'>('GUILD');
  const [extrasInitTab, setExtrasInitTab] = useState<'PYRAMID' | 'MYSTERY' | 'LEGEND_WHEEL' | 'ACHIEVE'>('PYRAMID');
  const [campaignInitTab, setCampaignInitTab] = useState<'EXPEDITION' | 'TREASURE' | 'ANCIENT_ARENA'>('EXPEDITION');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatChannel, setChatChannel] = useState<'WORLD' | 'SERVER' | 'GUILD'>('WORLD');
  const [chatInput, setChatInput] = useState('');

  const equippedCards: SupportCardId[] =
    progress.equippedSupportCards && progress.equippedSupportCards.length > 0
      ? progress.equippedSupportCards.slice(0, 3)
      : ['MANA_100', 'RAGE_50', 'HP_350'];
  const supportCardLevels = progress.supportCardLevels ?? {};

  // Wheel & Egg Gacha animation state
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState<WheelPrizeDef | null>(null);
  const [wheelBatchResults, setWheelBatchResults] = useState<WheelPrizeDef[]>([]);
  const [eggDrops, setEggDrops] = useState<EggDropItem[]>([]);

  const avatarId = progress.avatarId ?? '29';
  const avatarDef = getAvatarById(avatarId);
  const unlockedAvatars = progress.unlockedAvatars ?? ['29'];
  const charms = progress.charms ?? { binhAn: 2, mayMan: 2 };

  const activeBase = getPetById(progress.selectedPetId);
  const activeTier = activeBase.tier;
  const activeLv = progress.petLevels[activeBase.id] ?? 1;
  const activeStars = Math.max(1, Math.min(6, progress.petStars?.[activeBase.id] ?? 1));
  const activeGen = Math.max(0, Math.min(5, progress.petGenLevels?.[activeBase.id] ?? 0));
  const activePet = applyPetProgression(activeBase, activeLv, activeTier, activeStars, activeGen);
  const activeSpriteUrl = getPetSpritePath(activeBase);

  const auraBonuses = computeAuraTotalBonuses(progress.ownedAuras ?? ['aura-gold']);
  const equipBonuses = computeEquipmentBonuses(
    progress.equippedEquipment ?? { NON: 'eq-non-1', VU_KHI: 'eq-vk-1', AO: 'eq-ao-1' },
    progress.breakthroughLv ?? 0,
  );
  const guildLv = progress.guildLevel ?? 1;
  const guardPet = progress.guardPetId ? getPetById(progress.guardPetId) : null;
  const extraHp =
    avatarDef.hpBonus +
    auraBonuses.hpBonus +
    equipBonuses.hpBonus +
    guildLv * 120 +
    (guardPet ? Math.round(guardPet.maxHp * 0.16) : 0);
  const extraAtk =
    avatarDef.atkBonus +
    auraBonuses.atkBonus +
    equipBonuses.atkBonus +
    guildLv * 18 +
    (guardPet ? Math.round(guardPet.attack * 0.16) : 0);
  const power = computePetPower(activePet) + Math.round(extraHp * 0.35 + extraAtk * 2.2);
  const expNeeded = progress.level * 500;
  const expPct = Math.min(100, Math.round((progress.exp / expNeeded) * 100));

  const vipLevel = progress.vipLevel ?? Math.min(10, Math.floor(progress.level / 10) + (progress.wins >= 20 ? 1 : 0));
  const stamina = progress.stamina ?? 80;
  const gloryCoins = progress.gloryCoins ?? 0;
  const genCores = progress.genCores ?? 0;
  const readyOnlineCount = ONLINE_REWARDS.filter(
    (r) => onlineSeconds >= r.minutes * 60 && !(progress.claimedOnlineRewards ?? []).includes(r.id),
  ).length;
  const unreadMailCount = DEFAULT_MAILS.filter(
    (m) => !(progress.claimedMailIds ?? []).includes(m.id),
  ).length;

  const missions = [
    {
      id: 'm1',
      title: 'Chiến thắng 1 trận Chinh phục hoặc PvP',
      done: progress.wins >= 1,
      gold: 350,
      stones: 10,
    },
    {
      id: 'm2',
      title: 'Nâng cấp Pet lên Cấp 3 trở lên',
      done: Object.values(progress.petLevels).some((lv) => lv >= 3),
      gold: 500,
      stones: 15,
    },
    {
      id: 'm3',
      title: 'Chinh phục ít nhất 2 Đảo Phó Bản',
      done: progress.clearedStages.length >= 2,
      gold: 850,
      stones: 25,
    },
    {
      id: 'm4',
      title: 'Thử thách Boss Thập Nhị Tinh Mộ hoặc Boss Thế Giới',
      done: progress.clearedStages.some((id) => id === 'stage-4' || id === 'stage-5' || id === 'stage-6' || id === 'stage-7'),
      gold: 1200,
      stones: 35,
    },
  ];

  const unclaimedCount = missions.filter(
    (m) => m.done && !progress.claimedMissions.includes(m.id),
  ).length;

  const isFreeSpin = (progress.wheelSpunCount ?? 0) === 0;
  const spinCost = isFreeSpin ? 0 : 300;
  const wheelPity = (progress.wheelSpunCount ?? 0) % 30;

  const handleSpinWheel = () => {
    if (spinning || progress.gold < spinCost) return;
    const prizeIdx = Math.floor(Math.random() * WHEEL_PRIZES.length);
    const prize = WHEEL_PRIZES[prizeIdx];
    const sliceDeg = 360 / WHEEL_PRIZES.length;
    const targetDeg = 360 * 4 + (360 - prizeIdx * sliceDeg - sliceDeg / 2);
    setSpinning(true);
    setWheelResult(null);
    setWheelBatchResults([]);
    setWheelAngle((prev) => prev - (prev % 360) + targetDeg);

    setTimeout(() => {
      setSpinning(false);
      setWheelResult(prize);
      onSpinWheel?.(prize, spinCost);
    }, 2200);
  };

  const handleSpinWheel10 = () => {
    if (spinning || progress.gold < 2700) return;
    const prizes: WheelPrizeDef[] = Array.from({ length: 10 }, () => {
      const idx = Math.floor(Math.random() * WHEEL_PRIZES.length);
      return WHEEL_PRIZES[idx];
    });
    setSpinning(true);
    setWheelResult(null);
    setWheelBatchResults([]);
    setWheelAngle((prev) => prev + 360 * 5);

    setTimeout(() => {
      setSpinning(false);
      setWheelBatchResults(prizes);
      onSpinWheelBatch?.(prizes, 2700);
    }, 1400);
  };

  const handleTriggerEggSmash = (tier: 'GOLD' | 'RARE', count: 1 | 10) => {
    const goldCost = tier === 'GOLD' ? (count === 10 ? 1800 : 200) : 0;
    const stoneCost = tier === 'RARE' ? (count === 10 ? 135 : 15) : 0;
    if (progress.gold < goldCost || progress.stones < stoneCost) return;
    const drops = Array.from({ length: count }, () => rollEggGacha(tier));
    setEggDrops(drops);
    onSmashEgg?.(drops, goldCost, stoneCost);
  };


  const toggleSupportCardLoadout = (cardId: SupportCardId) => {
    if (!onChangeSupportLoadout) return;
    if (equippedCards.includes(cardId)) {
      if (equippedCards.length <= 1) return;
      onChangeSupportLoadout(equippedCards.filter((c) => c !== cardId));
    } else if (equippedCards.length < 3) {
      onChangeSupportLoadout([...equippedCards, cardId]);
    } else {
      onChangeSupportLoadout([...equippedCards.slice(1), cardId]);
    }
  };

  const leaderboardEntries = [
    ...TOP_GRANDMASTERS.map((gm) => ({ ...gm, isPlayer: false })),
    {
      name: progress.name,
      petId: progress.selectedPetId,
      avatarId,
      power,
      wins: progress.wins,
      isPlayer: true,
    },
  ].sort((a, b) => b.power - a.power);

  return (
    <div className="pk-lobby-root">
      {/* Pukiwo Pastel Rainbow & Floating Sky Continent Backdrop */}
      <div className="pk-lobby-rainbow" />
      <img
        src="/assets/pokiguard/sprites/lobby_classic_bg.png"
        alt="Pokiwar Continent"
        className="pk-lobby-map"
      />

      {/* TOP BAR HUD (PUKIWO STYLE) */}
      <div className="pk-lobby-hud">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            className="pk-trainer-pill"
            onClick={() => setModal('PROFILE')}
            title="Nhấn để đổi Trang Bị Avatar (+HP/Công/Mana) & Tên"
          >
            <div className="pk-avatar-medallion">
              <img src={avatarDef.path} alt={progress.name} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 168 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontWeight: 900, fontSize: 14, color: '#ffffff', textShadow: '0 1px 2px #000' }}>
                  {progress.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: 'linear-gradient(180deg, #a855f7, #7e22ce)',
                    border: '1px solid #fde047',
                    color: '#fef08a',
                  }}
                >
                  VIP {vipLevel}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 900,
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: 'linear-gradient(180deg, #fde047, #f59e0b)',
                    color: '#3f1802',
                  }}
                >
                  Lv.{progress.level}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 7,
                  borderRadius: 999,
                  background: 'rgba(2, 6, 23, 0.78)',
                  border: '1px solid rgba(108, 224, 255, 0.55)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${expPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #38bdf8 0%, #4ade80 100%)',
                  }}
                />
              </div>
              <div style={{ fontSize: 9.5, color: '#93c5fd', fontWeight: 700 }}>
                Tổng Buff: +{extraHp} HP • +{extraAtk} Công • {progress.guildName ?? 'Hội Quán ZingMe'}
              </div>
            </div>
          </div>

          {/* Pukiwo Stylized Bold Gold Arcade Power Score */}
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: 2 }}
            title="Tổng Lực Chiến hiện tại"
          >
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#ffffff', textShadow: '0 1px 3px #041d4e' }}>
              LỰC CHIẾN
            </span>
            <span className="pk-arcade-power">{power.toLocaleString()}</span>
          </div>
        </div>

        {/* Resource Capsules & Sound Controls */}
        <div className="pk-resource-bar">
          <div className="pk-hud-capsule" title="Thể lực đi Boss & Phó bản">
            <span style={{ color: '#4ade80', fontWeight: 900 }}>⚡ {stamina}/80</span>
          </div>
          <div
            className="pk-hud-capsule"
            style={{ cursor: 'pointer' }}
            title="Xu Đấu Trường / Vinh Quang (Nhấn mở Shop Vinh Quang)"
            onClick={() => {
              setKingInitTab('GLORY_SHOP');
              setModal('KING_ARENA');
            }}
          >
            <img src="/assets/pokiguard/sprites/ico_medal.png" alt="Xu" style={{ width: 18, height: 18 }} />
            <span style={{ color: '#c084fc' }}>{gloryCoins.toLocaleString()} Xu</span>
          </div>
          <div className="pk-hud-capsule" title="Tinh Thể Gen T2 để nâng Gen Pet">
            <span style={{ color: '#38bdf8', fontWeight: 900 }}>🧬 {genCores}</span>
          </div>
          <div className="pk-hud-capsule">
            <img
              src="/assets/pokiguard/sprites/gold.png"
              alt="Vàng"
              style={{ width: 20, height: 20, objectFit: 'contain' }}
            />
            <span style={{ color: '#fde047' }}>{progress.gold.toLocaleString()}</span>
          </div>
          <div className="pk-hud-capsule">
            <img
              src="/assets/pokiguard/sprites/crystal.png"
              alt="Đá"
              style={{ width: 20, height: 20, objectFit: 'contain' }}
            />
            <span style={{ color: '#7dd3fc' }}>{progress.stones} Đá</span>
          </div>

          <button
            type="button"
            className="pk-btn-blue"
            style={{ padding: '5px 9px', fontSize: 11 }}
            onClick={onToggleBgm}
          >
            {bgmPlaying ? 'Nhạc: Bật' : 'Nhạc: Tắt'}
          </button>
          <button
            type="button"
            className="pk-btn-blue"
            style={{ padding: '5px 9px', fontSize: 11 }}
            onClick={onToggleMute}
          >
            {muted ? 'Âm: Tắt' : 'Âm: Bật'}
          </button>
          {onLogout && (
            <button
              type="button"
              className="pk-btn-red"
              style={{ padding: '5px 9px', fontSize: 11 }}
              title={accountLabel ? `Đang đăng nhập: ${accountLabel}` : 'Đăng xuất'}
              onClick={onLogout}
            >
              Thoát
            </button>
          )}
        </div>
      </div>

      {/* SERVER-WIDE ANNOUNCEMENT BANNER CHUẨN ZING ME */}
      {serverAnnounceText && (
        <div
          style={{
            position: 'absolute',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 28,
            padding: '4px 18px',
            borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(120, 53, 15, 0.92), rgba(180, 83, 9, 0.95), rgba(120, 53, 15, 0.92))',
            border: '1.5px solid #fde047',
            color: '#fef08a',
            fontSize: 11.5,
            fontWeight: 900,
            boxShadow: '0 4px 16px rgba(0,0,0,0.65)',
            whiteSpace: 'nowrap',
            maxWidth: 740,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          📢 {serverAnnounceText}
        </div>
      )}

      {/* LEFT 2-COLUMN POKIWAR 4.0 FEATURE GRID */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 76,
          zIndex: 22,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 72px)',
          gap: 6,
        }}
      >
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setKingInitTab('ARENA');
            setModal('KING_ARENA');
          }}
        >
          <img src="/assets/pokiguard/sprites/rank_1.png" alt="Bá Vương 5v5" />
          <span>Bá Vương 5v5</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setPetHouseInitTab('AURA');
            setModal('PET_HOUSE');
          }}
        >
          <img src="/assets/pokiguard/sprites/haoquang.png" alt="Nhà Pet" />
          <span>Nhà Pet &amp; Đồ</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setExtrasInitTab('PYRAMID');
            setModal('POKI_EXTRAS');
          }}
        >
          <img src="/assets/pokiguard/sprites/chest_big.png" alt="Kim Tự Tháp" />
          <span>Kim Tự Tháp</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setExtrasInitTab('MYSTERY');
            setModal('POKI_EXTRAS');
          }}
        >
          <img src="/assets/pokiguard/sprites/crystal.png" alt="Shop Thần Bí" />
          <span>Shop Thần Bí</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setExtrasInitTab('LEGEND_WHEEL');
            setModal('POKI_EXTRAS');
          }}
        >
          <img src="/assets/pokiguard/sprites/Buildings-WhishingWheel.png" alt="Quay H.Thoại" />
          <span>Quay H.Thoại</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setExtrasInitTab('ACHIEVE');
            setModal('POKI_EXTRAS');
          }}
        >
          <img src="/assets/pokiguard/sprites/gold_star.png" alt="Thành Tựu" />
          <span>Thành Tựu</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setSocialInitTab('GUILD');
            setModal('SOCIAL_HUB');
          }}
        >
          <img src="/assets/pokiguard/sprites/Buildings-Guild.png" alt="Hội Quán" />
          <span>Hội Quán</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setSocialInitTab('SPACE');
            setModal('SOCIAL_HUB');
          }}
        >
          <img src="/assets/pokiguard/sprites/bldg_event.png" alt="Thám Hiểm" />
          <span>Thám Hiểm</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setSocialInitTab('ONLINE');
            setModal('SOCIAL_HUB');
          }}
        >
          <img src="/assets/pokiguard/sprites/dock_gift.png" alt="Quà Online" />
          <span>Quà Online</span>
          {readyOnlineCount > 0 && <span className="pk-shortcut-badge">{readyOnlineCount}</span>}
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setSocialInitTab('MAIL');
            setModal('SOCIAL_HUB');
          }}
        >
          <img src="/assets/pokiguard/sprites/ico_fire_scroll.png" alt="Hộp Thư" />
          <span>Hộp Thư</span>
          {unreadMailCount > 0 && <span className="pk-shortcut-badge">{unreadMailCount}</span>}
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => setChatOpen((v) => !v)}
        >
          <img src="/assets/pokiguard/sprites/happy.png" alt="Kênh Chat" />
          <span>{chatOpen ? 'Ẩn Chat' : 'Kênh Chat'}</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setCampaignInitTab('EXPEDITION');
            setModal('POKI40_CAMPAIGN');
          }}
        >
          <img src="/assets/pokiguard/sprites/Buildings-campaign.png" alt="Viễn Chinh" />
          <span>Viễn Chinh</span>
        </button>
      </div>

      {/* FLOATING POKIWAR ZING ME LIVE CHAT BOX (WORLD / SERVER / GUILD) */}
      {chatOpen && (
        <div
          className="pk-stone-panel"
          style={{
            position: 'absolute',
            left: 84,
            bottom: 92,
            width: 340,
            zIndex: 32,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            boxShadow: '0 10px 28px rgba(0,0,0,0.85)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(
                [
                  ['WORLD', 'Thế Giới'],
                  ['SERVER', 'Server'],
                  ['GUILD', 'Hội Quán'],
                ] as const
              ).map(([ch, lb]) => (
                <button
                  key={ch}
                  type="button"
                  className={chatChannel === ch ? 'pk-btn-gold' : 'pk-btn-blue'}
                  style={{ padding: '2px 7px', fontSize: 10 }}
                  onClick={() => setChatChannel(ch)}
                >
                  {lb}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="pk-btn-red"
              style={{ padding: '1px 7px', fontSize: 10 }}
              onClick={() => setChatOpen(false)}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              height: 120,
              overflowY: 'auto',
              background: 'rgba(2, 6, 23, 0.78)',
              borderRadius: 7,
              padding: '5px 7px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              fontSize: 11,
            }}
          >
            {chatMessages
              .filter((m) => m.channel === 'SYSTEM' || chatChannel === 'WORLD' || m.channel === chatChannel)
              .slice(-20)
              .map((m) => (
                <div key={m.id} style={{ lineHeight: 1.25 }}>
                  <span
                    style={{
                      fontWeight: 900,
                      color:
                        m.channel === 'SYSTEM'
                          ? '#f59e0b'
                          : m.channel === 'GUILD'
                            ? '#4ade80'
                            : '#7dd3fc',
                    }}
                  >
                    [{m.channel === 'SYSTEM' ? 'Hệ Thống' : m.channel === 'GUILD' ? 'Hội' : m.channel === 'SERVER' ? 'SV' : 'TG'}]{' '}
                    {m.vip ? `VIP${m.vip} ` : ''}
                    {m.sender}:{' '}
                  </span>
                  <span style={{ color: m.channel === 'SYSTEM' ? '#fef08a' : '#f8fafc' }}>{m.text}</span>
                </div>
              ))}
          </div>

          <form
            style={{ display: 'flex', gap: 5 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim()) return;
              onSendChat?.(chatChannel, chatInput.trim());
              setChatInput('');
            }}
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Nhập tin nhắn Pokiwar..."
              maxLength={120}
              style={{
                flex: 1,
                padding: '5px 8px',
                borderRadius: 7,
                border: '1px solid #38bdf8',
                background: '#050d21',
                color: '#fff',
                fontSize: 11,
              }}
            />
            <button type="submit" className="pk-btn-gold" style={{ padding: '4px 10px', fontSize: 11 }}>
              Gửi
            </button>
          </form>
        </div>
      )}

      {/* RIGHT VERTICAL EVENT & SHORTCUT COLUMN (PUKIWO LAYOUT) */}
      <div className="pk-right-shortcuts">
        <button type="button" className="pk-shortcut-item" onClick={() => setModal('MISSIONS')}>
          <img src="/assets/pokiguard/sprites/dock_gift.png" alt="Nhiệm Vụ" />
          <span>Nhiệm Vụ</span>
          {unclaimedCount > 0 && <span className="pk-shortcut-badge">{unclaimedCount}</span>}
        </button>

        <button type="button" className="pk-shortcut-item" onClick={() => setModal('DEX')}>
          <img src="/assets/pokiguard/sprites/dock_rank.png" alt="Thư Viện" />
          <span>Thư Viện</span>
        </button>

        <button type="button" className="pk-shortcut-item" onClick={() => setModal('RANK')}>
          <img src="/assets/pokiguard/sprites/rank_1.png" alt="BXH Cao Thủ" />
          <span>BXH Cao Thủ</span>
        </button>

        <button type="button" className="pk-shortcut-item" onClick={() => setModal('CARDS')}>
          <img src="/assets/pokiguard/cards/card1.png" alt="Túi Thẻ" style={{ borderRadius: 6 }} />
          <span>Túi Thẻ</span>
        </button>

        <button type="button" className="pk-shortcut-item" onClick={() => { setEggDrops([]); setModal('EGG'); }}>
          <img src="/assets/pokiguard/sprites/chest_big.png" alt="Đập Trứng" />
          <span>Đập Trứng</span>
        </button>

        <button type="button" className="pk-shortcut-item" onClick={() => { setGiftNotice(null); setModal('GIFTCODE'); }}>
          <img src="/assets/pokiguard/sprites/ico_fire_scroll.png" alt="Quà & Code" />
          <span>Quà &amp; Code</span>
        </button>

        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setPveTab('STORY');
            setModal('PVE');
          }}
        >
          <img src="/assets/pokiguard/sprites/ico_sword.png" alt="Chinh Phục" />
          <span>Chinh Phục</span>
        </button>

        <button type="button" className="pk-shortcut-item" onClick={() => setModal('PVP')}>
          <img src="/assets/pokiguard/sprites/ico_shield.png" alt="Đấu PvP" />
          <span>Đấu PvP</span>
        </button>

        <button type="button" className="pk-shortcut-item" onClick={() => setModal('PROFILE')}>
          <img src={avatarDef.path} alt="Trang Bị" />
          <span>Trang Bị</span>
        </button>
        <button
          type="button"
          className="pk-shortcut-item"
          onClick={() => {
            setCampaignInitTab('ANCIENT_ARENA');
            setModal('POKI40_CAMPAIGN');
          }}
        >
          <img src="/assets/pokiguard/sprites/Buildings-ArenaPVP.png" alt="Cổ Đại 3×3" />
          <span>Cổ Đại 3×3</span>
        </button>
      </div>

      {/* WORLD ISLAND LANDMARK BUILDINGS */}
      <button
        type="button"
        className="pk-bldg-btn"
        style={{ left: '34%', top: '31%' }}
        onClick={() => onOpenPetUpgrade('EVOLVE_TREE')}
      >
        <img src="/assets/pokiguard/sprites/Buildings-Evolve.png" alt="Hợp Pet" style={{ width: 118 }} />
        <span className="pk-bldg-ribbon">TẾ ĐÀN HỢP PET</span>
      </button>

      <button
        type="button"
        className="pk-bldg-btn"
        style={{ left: '53%', top: '40%' }}
        onClick={() => setModal('PVP')}
      >
        <img src="/assets/pokiguard/sprites/Buildings-ArenaPVP.png" alt="Đấu trường" style={{ width: 152 }} />
        <span className="pk-bldg-ribbon">ĐẤU TRƯỜNG PVP</span>
      </button>

      <button
        type="button"
        className="pk-bldg-btn"
        style={{ left: '66%', top: '24%' }}
        onClick={() => {
          setPveTab('STORY');
          setModal('PVE');
        }}
      >
        <img src="/assets/pokiguard/sprites/Buildings-campaign.png" alt="Chinh phục" style={{ width: 108 }} />
        <span className="pk-bldg-ribbon">ĐẢO CHINH PHỤC</span>
      </button>

      <button
        type="button"
        className="pk-bldg-btn"
        style={{ left: '20%', top: '58%' }}
        onClick={() => {
          setPveTab('ZODIAC_TOMB');
          setModal('PVE');
        }}
      >
        <img src="/assets/pokiguard/sprites/Buildings-Tower.png" alt="Tháp Tinh Mộ" style={{ width: 96 }} />
        <span className="pk-bldg-ribbon">THẬP NHỊ TINH MỘ</span>
      </button>

      <button
        type="button"
        className="pk-bldg-btn"
        style={{ left: '43%', top: '61%' }}
        onClick={() => setModal('SHOP')}
      >
        <img src="/assets/pokiguard/sprites/Buildings-Guild.png" alt="Shop Đá" style={{ width: 116 }} />
        <span className="pk-bldg-ribbon">SHOP ĐÁ &amp; BÙA</span>
      </button>

      <button
        type="button"
        className="pk-bldg-btn"
        style={{ left: '60%', top: '63%' }}
        onClick={() => setModal('WHEEL')}
      >
        <img src="/assets/pokiguard/sprites/Buildings-WhishingWheel.png" alt="Vòng quay" style={{ width: 96 }} />
        <span className="pk-bldg-ribbon">VÒNG QUAY MAY MẮN</span>
      </button>

      <button
        type="button"
        className="pk-bldg-btn"
        style={{ left: '79%', top: '46%' }}
        onClick={() => {
          setPveTab('BOSS');
          setModal('PVE');
        }}
      >
        <img src="/assets/pokiguard/sprites/Buildings-WorldBoss.png" alt="Boss Thế Giới" style={{ width: 122 }} />
        <span className="pk-bldg-ribbon">BOSS THẾ GIỚI</span>
      </button>

      {/* BOTTOM LEFT: ACTIVE COMPANION BAR */}
      <div className="pk-lobby-companion">
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 12,
            background: 'radial-gradient(circle, rgba(56,189,248,0.28), rgba(4,13,36,0.9))',
            border: '2px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={activeSpriteUrl}
            alt={activePet.name}
            style={{ width: 52, height: 52, objectFit: 'contain' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img
              src={ELEMENT_META[activePet.element].iconPath}
              alt={activePet.element}
              style={{ width: 17, height: 17 }}
            />
            <span style={{ fontWeight: 900, fontSize: 13.5, color: '#fef08a' }}>{activePet.name}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                padding: '1px 6px',
                borderRadius: 5,
                background: '#b45309',
                color: '#fef3c7',
              }}
            >
              {activeStars}★ • {activeTier}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1' }}>
            Lv.{activeLv} • Máu {activePet.maxHp + avatarDef.hpBonus} • Công {activePet.attack + avatarDef.atkBonus} • LC{' '}
            <strong style={{ color: '#fde047' }}>{power}</strong>
          </div>
        </div>

        <button type="button" className="pk-btn-blue" onClick={() => onOpenPetUpgrade('UPGRADE')}>
          Quản lý Pet
        </button>
        <button
          type="button"
          className="pk-btn-gold"
          onClick={() => {
            setPveTab('STORY');
            setModal('PVE');
          }}
        >
          Xuất trận
        </button>
      </div>

      {/* BOTTOM RIGHT: CLASSIC ICON DOCK */}
      <div className="pk-lobby-dock">
        <button type="button" className="pk-dock-icon-btn" onClick={() => onOpenPetUpgrade('UPGRADE')}>
          <img src="/assets/pokiguard/sprites/dock_party.png" alt="Kho Thú" />
          <span>Kho Thú</span>
        </button>
        <button type="button" className="pk-dock-icon-btn" onClick={() => setModal('DEX')}>
          <img src="/assets/pokiguard/sprites/dock_rank.png" alt="Thư Viện" />
          <span>Thư Viện</span>
        </button>
        <button type="button" className="pk-dock-icon-btn" onClick={() => setModal('MISSIONS')}>
          <img src="/assets/pokiguard/sprites/dock_gift.png" alt="Nhiệm Vụ" />
          <span>Nhiệm Vụ{unclaimedCount > 0 ? ` (${unclaimedCount})` : ''}</span>
        </button>
        <button type="button" className="pk-dock-icon-btn" onClick={() => setModal('SHOP')}>
          <img src="/assets/pokiguard/sprites/bldg_event.png" alt="Cửa Hàng" />
          <span>Cửa Hàng</span>
        </button>
        <button type="button" className="pk-dock-icon-btn" onClick={() => setModal('WHEEL')}>
          <img src="/assets/pokiguard/sprites/bldg_arena.png" alt="Vòng Quay" />
          <span>Vòng Quay</span>
        </button>
      </div>

      {/* ==================== MODAL: BẢN ĐỒ PHÓ BẢN 6 ĐẢO ẢI VIỄN CHINH & ĐI SĂN BOSS ==================== */}
      {modal === 'PVE' && (
        <DungeonWorldMapModal
          progress={progress}
          initialTab={
            pveTab === 'ENDLESS_TOWER'
              ? 'TOWER'
              : pveTab === 'BOSS'
                ? 'HUNT'
                : pveTab === 'MEGA_ARENA' || pveTab === 'ZODIAC_TOMB'
                  ? 'SPECIAL'
                  : 'ISLANDS'
          }
          onClose={() => setModal(null)}
          onStartPve={(stage, mercenaryCount) => {
            setModal(null);
            onStartPve(stage, mercenaryCount);
          }}
          onSweepStage={onSweepStage}
        />
      )}

      {/* ==================== MODAL: ĐẤU TRƯỜNG PVP (1:1 POKIGUARD DAUTRUONG) ==================== */}
      {modal === 'PVP' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="pk-modal"
            style={{
              maxWidth: 680,
              backgroundImage:
                "linear-gradient(180deg, rgba(6, 20, 54, 0.72) 0%, rgba(3, 12, 34, 0.9) 100%), url('/assets/pokiguard/sprites/background-01.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-khopet-banner" style={{ minWidth: 320, height: 50, fontSize: 17 }}>
                ĐẤU TRƯỜNG PVP
              </div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/Button_Pack-Button_Pack_1_0.png" alt="Đóng" />
              </button>
            </div>

            <div
              className="pk-stone-panel"
              style={{
                padding: 14,
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={avatarDef.path} alt={progress.name} style={{ width: 56, height: 56, objectFit: 'contain' }} />
                <img src={activeSpriteUrl} alt={activePet.name} style={{ width: 64, height: 64, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontWeight: 900, color: '#fef08a', fontSize: 15 }}>
                    {progress.name} — {activePet.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                    Lv.{activeLv} ({activeTier}) • LC: <strong style={{ color: '#4ade80' }}>{power}</strong>
                  </div>
                </div>
              </div>
              <img src="/assets/pokiguard/sprites/vs_emblem.png" alt="VS" style={{ width: 68, objectFit: 'contain' }} />
              <div style={{ textAlign: 'right', color: '#94a3b8', fontSize: 12 }}>
                <div>Đối thủ Thời Gian Thực</div>
                <div style={{ color: '#fda4af', fontWeight: 800 }}>WebSocket /ws</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, color: '#cbd5e1', display: 'block', marginBottom: 5 }}>
                Tên hiển thị trong Đấu trường:
              </label>
              <input
                value={progress.name}
                onChange={(e) => onChangeName(e.target.value)}
                maxLength={20}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '2px solid #f59e0b',
                  background: '#050d21',
                  color: '#fff',
                  fontWeight: 700,
                }}
              />
            </div>

            {pvpStatus === 'IDLE' && (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <button type="button" className="pk-btn-gold" style={{ flex: 1 }} onClick={onQuickMatch}>
                    Tìm Trận Ngẫu Nhiên
                  </button>
                  <button type="button" className="pk-btn-blue" style={{ flex: 1 }} onClick={onCreateRoom}>
                    Tạo Phòng Lấy Mã
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Nhập mã phòng (VD: AB12CD)"
                    maxLength={8}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #38bdf8',
                      background: '#050d21',
                      color: '#fff',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  />
                  <button
                    type="button"
                    className="pk-btn-blue"
                    disabled={joinCode.trim().length < 4}
                    onClick={() => onJoinRoom(joinCode)}
                  >
                    Vào phòng
                  </button>
                </div>
              </>
            )}

            {pvpStatus === 'CONNECTING' && <p>Đang kết nối máy chủ PvP (/ws)...</p>}

            {pvpStatus === 'QUEUED' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Đang tìm đối thủ... (Mở thêm 1 tab trình duyệt để tự đấu thử!)</span>
                <button type="button" className="pk-btn-red" onClick={onCancelQueue}>
                  Hủy
                </button>
              </div>
            )}

            {pvpStatus === 'WAITING_ROOM' && roomCode && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div>Mã phòng thách đấu:</div>
                  <strong style={{ fontSize: 26, color: '#fde047', letterSpacing: 3 }}>{roomCode}</strong>
                </div>
                <button type="button" className="pk-btn-red" onClick={onCancelQueue}>
                  Đóng phòng
                </button>
              </div>
            )}

            {pvpError && <p style={{ color: '#fda4af', marginTop: 10 }}>Lỗi: {pvpError}</p>}
          </div>
        </div>
      )}

      {/* ==================== MODAL: CỬA HÀNG ĐÁ & BÙA ==================== */}
      {modal === 'SHOP' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div className="pk-modal" style={{ maxWidth: 780 }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-ribbon-title">CỬA HÀNG ĐÁ CƯỜNG HÓA &amp; BÙA</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
              {STONE_PRICES.map((price, idx) => (
                <div
                  key={idx}
                  className="pk-stone-panel"
                  style={{ padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                >
                  <img
                    src={`/assets/pokiguard/sprites/stone_f_${idx + 1}.png`}
                    alt={`Đá Cấp ${idx + 1}`}
                    style={{ width: 42, height: 42, objectFit: 'contain' }}
                  />
                  <div style={{ fontWeight: 900, fontSize: 12, color: '#fef08a' }}>Đá Cấp {idx + 1}</div>
                  <div style={{ fontSize: 11, color: '#fde047' }}>{price} Vàng</div>
                  <button
                    type="button"
                    className="pk-btn-gold"
                    style={{ width: '100%', padding: '5px 8px', fontSize: 11.5 }}
                    disabled={progress.gold < price}
                    onClick={() => onBuyStoneLv?.(idx, 1, price)}
                  >
                    Mua 1
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="pk-stone-panel" style={{ padding: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src="/assets/pokiguard/sprites/charm_binh_an.png" alt="Bùa Bình An" style={{ width: 44 }} />
                  <div>
                    <div style={{ fontWeight: 900, color: '#86efac', fontSize: 13 }}>Bùa Bình An (Đang có: {charms.binhAn})</div>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>Chống tụt cấp khi cường hóa thất bại</div>
                    <div style={{ fontSize: 11.5, color: '#fde047', fontWeight: 700 }}>{CHARM_PRICES.binhAn} Vàng</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="pk-btn-gold"
                  disabled={progress.gold < CHARM_PRICES.binhAn}
                  onClick={() => onBuyCharm?.('binhAn', CHARM_PRICES.binhAn)}
                >
                  Mua
                </button>
              </div>

              <div className="pk-stone-panel" style={{ padding: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src="/assets/pokiguard/sprites/charm_may_man.png" alt="Bùa May Mắn" style={{ width: 44 }} />
                  <div>
                    <div style={{ fontWeight: 900, color: '#fef08a', fontSize: 13 }}>Bùa May Mắn (Đang có: {charms.mayMan})</div>
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>Tăng +15% tỉ lệ nâng cấp thành công</div>
                    <div style={{ fontSize: 11.5, color: '#fde047', fontWeight: 700 }}>{CHARM_PRICES.mayMan} Vàng</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="pk-btn-gold"
                  disabled={progress.gold < CHARM_PRICES.mayMan}
                  onClick={() => onBuyCharm?.('mayMan', CHARM_PRICES.mayMan)}
                >
                  Mua
                </button>
              </div>
            </div>

            {/* Bulk Stone Packs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Gói 15 Đá Tiến Hóa', amount: 15, cost: 450, icon: '/assets/pokiguard/sprites/crystal.png' },
                { label: 'Rương 45 Đá Tiến Hóa', amount: 45, cost: 1150, icon: '/assets/pokiguard/sprites/stone_m_5.png' },
              ].map((pack) => (
                <div key={pack.amount} className="pk-stone-panel" style={{ padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={pack.icon} alt="" style={{ width: 38, height: 38, objectFit: 'contain' }} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#7dd3fc' }}>{pack.label}</div>
                      <div style={{ fontSize: 11.5, color: '#fde047' }}>{pack.cost} Vàng</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pk-btn-blue"
                    disabled={progress.gold < pack.cost}
                    onClick={() => onBuyStones(pack.amount, pack.cost)}
                  >
                    Mua ngay
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: NHIỆM VỤ ==================== */}
      {modal === 'MISSIONS' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div className="pk-modal" style={{ maxWidth: 660 }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-ribbon-title">NHIỆM VỤ CHIẾN BINH &amp; CHINH PHỤC</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {missions.map((m) => {
                const claimed = progress.claimedMissions.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className="pk-stone-panel"
                    style={{
                      padding: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src="/assets/pokiguard/sprites/ico_fire_scroll.png" alt="" style={{ width: 36, height: 36 }} />
                      <div>
                        <div style={{ fontWeight: 800 }}>{m.title}</div>
                        <div style={{ fontSize: 12, color: '#fde047', fontWeight: 700 }}>
                          Thưởng: +{m.gold} Vàng • +{m.stones} Đá
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={m.done && !claimed ? 'pk-btn-gold' : 'pk-btn-blue'}
                      disabled={!m.done || claimed}
                      onClick={() => onClaimMission(m.id, m.gold, m.stones)}
                    >
                      {claimed ? 'Đã nhận' : m.done ? 'Nhận thưởng' : 'Chưa xong'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: VÒNG QUAY MAY MẮN ==================== */}
      {modal === 'WHEEL' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div className="pk-modal" style={{ maxWidth: 680, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-ribbon-title">VÒNG QUAY MAY MẮN</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, margin: '8px 0' }}>
              <div style={{ position: 'relative', width: 280, height: 280 }}>
                {/* Pointer Arrow */}
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '12px solid transparent',
                    borderRight: '12px solid transparent',
                    borderTop: '24px solid #fde047',
                    zIndex: 10,
                    filter: 'drop-shadow(0 2px 4px #000)',
                  }}
                />
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: '5px solid #fbbf24',
                    background:
                      'conic-gradient(#f59e0b 0deg 45deg, #2563eb 45deg 90deg, #16a34a 90deg 135deg, #d97706 135deg 180deg, #0891b2 180deg 225deg, #9333ea 225deg 270deg, #db2777 270deg 315deg, #dc2626 315deg 360deg)',
                    boxShadow: '0 0 32px rgba(250, 204, 21, 0.45)',
                    transform: `rotate(${wheelAngle}deg)`,
                    transition: 'transform 2.1s cubic-bezier(0.15, 0.85, 0.25, 1)',
                    position: 'relative',
                  }}
                >
                  {WHEEL_PRIZES.map((p, idx) => {
                    const deg = idx * 45 + 22.5;
                    return (
                      <div
                        key={p.id}
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-92px)`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          pointerEvents: 'none',
                        }}
                      >
                        <img src={p.icon} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
                        <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', textShadow: '0 1px 2px #000', whiteSpace: 'nowrap' }}>
                          {p.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 250, textAlign: 'left' }}>
                <div className="pk-stone-panel" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 900, color: '#fde047', fontSize: 13.5, marginBottom: 4 }}>
                    Phần Thưởng Kho Báu (Pity: {wheelPity}/30)
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
                    Quay nhận Vàng, Đá Lv.2–Lv.4, Bùa! Đạt mốc <strong>30 lần</strong> tặng ngay{' '}
                    <strong style={{ color: '#4ade80' }}>+15 Mảnh Mega Zidarose</strong>.
                  </div>
                </div>

                {wheelResult && (
                  <div className="pk-stone-panel" style={{ padding: 10, borderColor: '#4ade80' }}>
                    <div style={{ fontWeight: 900, color: '#4ade80', fontSize: 13 }}>
                      CHÚC MỪNG! Bạn nhận được: {wheelResult.label}
                    </div>
                  </div>
                )}

                {wheelBatchResults.length > 0 && (
                  <div className="pk-stone-panel" style={{ padding: 8, borderColor: '#fde047', maxHeight: 110, overflowY: 'auto' }}>
                    <div style={{ fontWeight: 900, color: '#fde047', fontSize: 11.5, marginBottom: 4 }}>
                      KẾT QUẢ QUAY 10 LẦN:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {wheelBatchResults.map((p, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: 'rgba(15,23,42,0.85)',
                            border: '1px solid #38bdf8',
                            color: '#fef08a',
                          }}
                        >
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="pk-btn-gold"
                    style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
                    disabled={spinning || progress.gold < spinCost}
                    onClick={handleSpinWheel}
                  >
                    {spinning ? 'Đang quay...' : isFreeSpin ? 'Miễn Phí (1x)' : `Quay 1x (${spinCost}V)`}
                  </button>
                  <button
                    type="button"
                    className="pk-btn-orange"
                    style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
                    disabled={spinning || progress.gold < 2700}
                    onClick={handleSpinWheel10}
                  >
                    Quay 10x (2,700V)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: TRANG BỊ AVATAR & HỒ SƠ ==================== */}
      {modal === 'PROFILE' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div className="pk-modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-ribbon-title">TRANG BỊ AVATAR &amp; HỒ SƠ</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12.5, color: '#cbd5e1', display: 'block', marginBottom: 4 }}>
                Tên Huấn luyện viên:
              </label>
              <input
                value={progress.name}
                onChange={(e) => onChangeName(e.target.value)}
                maxLength={20}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '2px solid #f59e0b',
                  background: '#050d21',
                  color: '#fff',
                  fontWeight: 700,
                }}
              />
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fde047', marginBottom: 8 }}>
              Bộ Trang Bị Chibi Avatar (Cộng thẳng HP / Công / Mana cho Pet khi vào trận):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 9 }}>
              {TRAINER_AVATARS.map((av) => {
                const equipped = avatarId === av.id;
                const unlocked = av.costGold === 0 || unlockedAvatars.includes(av.id);
                return (
                  <div
                    key={av.id}
                    className="pk-stone-panel"
                    style={{
                      padding: 9,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      borderColor: equipped ? '#fde047' : unlocked ? '#38bdf8' : '#334155',
                    }}
                  >
                    <img src={av.path} alt={av.name} style={{ width: 62, height: 62, objectFit: 'contain' }} />
                    <div style={{ fontSize: 11.5, fontWeight: 900, color: equipped ? '#fde047' : '#e2e8f0', textAlign: 'center' }}>
                      {av.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#86efac', textAlign: 'center' }}>
                      +{av.hpBonus} HP • +{av.atkBonus} Công • +{av.manaBonus} Mana
                    </div>
                    {equipped ? (
                      <span style={{ fontSize: 11, fontWeight: 900, color: '#fde047' }}>Đang mặc</span>
                    ) : unlocked ? (
                      <button
                        type="button"
                        className="pk-btn-blue"
                        style={{ width: '100%', padding: '4px 8px', fontSize: 11 }}
                        onClick={() => onChangeAvatar?.(av.id)}
                      >
                        Trang bị
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="pk-btn-gold"
                        style={{ width: '100%', padding: '4px 8px', fontSize: 11 }}
                        disabled={progress.gold < av.costGold}
                        onClick={() => onUnlockAvatar?.(av.id, av.costGold)}
                      >
                        Mở ({av.costGold} V)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: THƯ VIỆN BÁCH KHOA PET (PUKIWO ELEMENT FILTER + CARDS) ==================== */}
      {modal === 'DEX' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div className="pk-modal" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-ribbon-title">THƯ VIỆN THÚ CƯNG &amp; NGŨ HÀNH</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            <div
              className="pk-stone-panel"
              style={{
                padding: '8px 14px',
                marginBottom: 10,
                fontSize: 12,
                color: '#cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span>Tương khắc Ngũ Hành: <strong>Kim → Mộc → Thổ → Thủy → Hỏa → Kim</strong></span>
              <span style={{ color: '#4ade80', fontWeight: 900 }}>Khắc hệ: +50% ST | Bị khắc: -25% ST</span>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Pukiwo Left Element Filter Checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setDexElement('ALL')}
                  className={dexElement === 'ALL' ? 'pk-btn-gold' : 'pk-btn-blue'}
                  style={{ width: 64, padding: '7px 6px', fontSize: 11.5, borderRadius: 10 }}
                >
                  Tất cả
                </button>
                {(['KIM', 'MOC', 'THUY', 'HOA', 'THO'] as ElementType[]).map((el) => {
                  const active = dexElement === el;
                  return (
                    <button
                      key={el}
                      type="button"
                      onClick={() => setDexElement(el)}
                      className={active ? 'pk-btn-gold' : 'pk-btn-blue'}
                      style={{
                        width: 64,
                        padding: '6px 6px',
                        fontSize: 11,
                        borderRadius: 10,
                        justifyContent: 'flex-start',
                      }}
                    >
                      <img src={ELEMENT_META[el].iconPath} alt={ELEMENT_META[el].label} style={{ width: 18, height: 18 }} />
                      <span>{ELEMENT_META[el].label}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto', paddingRight: 4 }}>
                {STARTER_PETS.filter((p) => dexElement === 'ALL' || p.element === dexElement).map((p) => {
                  const reqPet = p.synthesisRecipe ? getPetById(p.synthesisRecipe.requiredPetId) : null;
                  const unlocked = (progress.unlockedPets ?? []).includes(p.id);
                  const lv = progress.petLevels[p.id] ?? 1;
                  const stars = Math.max(1, Math.min(5, progress.petStars?.[p.id] ?? 1));
                  return (
                    <div
                      key={p.id}
                      className="pk-stone-panel"
                      style={{ padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 230 }}>
                        <img
                          src={getPetSpritePath(p)}
                          alt={p.name}
                          style={{ width: 52, height: 52, objectFit: 'contain', flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <img src={ELEMENT_META[p.element].iconPath} alt={p.element} style={{ width: 18, height: 18 }} />
                            <span style={{ fontWeight: 900, color: '#fef08a', fontSize: 13.5 }}>{p.name}</span>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 900,
                                padding: '1px 6px',
                                borderRadius: 999,
                                background: '#b45309',
                                color: '#fff',
                              }}
                            >
                              {p.tier}
                            </span>
                          </div>
                          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>{p.title}</div>
                          <div style={{ fontSize: 10.5, color: '#4ade80', fontWeight: 800, marginTop: 2 }}>
                            HP {p.maxHp} • Công {p.attack} • Phép {p.magic} • Tốc {p.speed}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontSize: 11 }}>
                        {reqPet && p.synthesisRecipe ? (
                          <div style={{ color: '#bae6fd', fontWeight: 800 }}>
                            ⚗️ Công thức Hợp Pet:{' '}
                            <strong style={{ color: '#fde047' }}>
                              {reqPet.name} Lv.{p.synthesisRecipe.requiredPetLevel}
                            </strong>{' '}
                            + {p.synthesisRecipe.stoneCount} Đá C{p.synthesisRecipe.stoneLevel} +{' '}
                            {p.synthesisRecipe.goldCost}V
                          </div>
                        ) : (
                          <div style={{ color: '#86efac', fontWeight: 800 }}>
                            🥚 Pet Khởi Nguyên Độc Lập (Ghép 30 Mảnh / Đập Trứng)
                          </div>
                        )}
                        <div style={{ fontSize: 10.5, color: unlocked ? '#4ade80' : '#fca5a5', fontWeight: 900, marginTop: 3 }}>
                          {unlocked ? `✅ Đã sở hữu (Lv.${lv} • ${stars}★)` : `🔒 Chưa sở hữu (${progress.petShards?.[p.id] ?? 0}/30 Mảnh)`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: TÚI THẺ & LUYỆN THẺ BỔ TRỢ (LV.1 -> LV.5) ==================== */}
      {modal === 'CARDS' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div className="pk-modal" style={{ maxWidth: 850 }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ minWidth: 112 }} />
              <div className="pk-ribbon-title">TÚI THẺ &amp; LUYỆN THẺ HỖ TRỢ (LV.1 → LV.5)</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#bae6fd', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Chọn 3 Thẻ Hỗ Trợ mang vào trận &amp; Luyện Thẻ lên Lv.5 (+20% hiệu lực mỗi cấp):</span>
              <strong style={{ color: '#fde047' }}>Đang mang: {equippedCards.length}/3</strong>
            </div>

            {cardNotice && (
              <div
                className="pk-stone-panel"
                style={{
                  padding: '6px 12px',
                  marginBottom: 8,
                  borderColor: '#4ade80',
                  color: '#fef08a',
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {cardNotice}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              {(Object.keys(SUPPORT_CARDS) as SupportCardId[]).map((cId) => {
                const card = SUPPORT_CARDS[cId];
                const slotIdx = equippedCards.indexOf(cId);
                const isEquippedCard = slotIdx >= 0;
                const cardLv = Math.max(1, Math.min(5, supportCardLevels[cId] ?? 1));
                const nextUpgradeCost = cardLv < 5 ? CARD_UPGRADE_GOLD_COSTS[cardLv] : 0;
                return (
                  <div
                    key={cId}
                    className="pk-stone-panel"
                    style={{
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 5,
                      borderColor: isEquippedCard ? '#fde047' : '#38bdf8',
                      background: isEquippedCard
                        ? 'linear-gradient(180deg, rgba(202, 138, 4, 0.25), rgba(15, 23, 42, 0.94))'
                        : undefined,
                      textAlign: 'center',
                      color: '#fff',
                    }}
                  >
                    <div
                      style={{ position: 'relative', cursor: 'pointer' }}
                      onClick={() => toggleSupportCardLoadout(cId)}
                    >
                      <img
                        src={card.image}
                        alt={card.name}
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1.5px solid #fbbf24' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: -4,
                          left: -8,
                          fontSize: 9,
                          fontWeight: 900,
                          padding: '1px 5px',
                          borderRadius: 999,
                          background: '#0284c7',
                          color: '#fff',
                        }}
                      >
                        Lv.{cardLv}/5
                      </span>
                      {isEquippedCard && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -6,
                            right: -10,
                            fontSize: 9.5,
                            fontWeight: 900,
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: '#fde047',
                            color: '#451a03',
                          }}
                        >
                          Ô #{slotIdx + 1}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 12, color: isEquippedCard ? '#fde047' : '#fef08a' }}>
                      {card.name}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#4ade80' }}>
                      {getSupportCardScaledLabel(cId, cardLv)}
                    </div>
                    <div style={{ fontSize: 9.8, color: '#cbd5e1', lineHeight: 1.22 }}>{card.description}</div>

                    <div style={{ display: 'flex', gap: 5, width: '100%', marginTop: 2 }}>
                      <button
                        type="button"
                        className={isEquippedCard ? 'pk-btn-gold' : 'pk-btn-blue'}
                        style={{ flex: 1, padding: '4px 6px', fontSize: 10 }}
                        onClick={() => toggleSupportCardLoadout(cId)}
                      >
                        {isEquippedCard ? 'Đang mang' : 'Trang bị'}
                      </button>
                      {cardLv < 5 ? (
                        <button
                          type="button"
                          className="pk-btn-orange"
                          style={{ flex: 1.15, padding: '4px 6px', fontSize: 10 }}
                          disabled={progress.gold < nextUpgradeCost}
                          onClick={() => {
                            if (!onUpgradeSupportCard) return;
                            const res = onUpgradeSupportCard(cId);
                            setCardNotice(res.message);
                          }}
                        >
                          ⬆️ Lv.{cardLv + 1} ({nextUpgradeCost}V)
                        </button>
                      ) : (
                        <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fde047', alignSelf: 'center', padding: '0 4px' }}>
                          MAX Lv.5
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: BẢNG XẾP HẠNG CAO THỦ (TOPRANKPOPUP) ==================== */}
      {modal === 'RANK' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div className="pk-modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-ribbon-title">BẢNG XẾP HẠNG CAO THỦ POKIWAR</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
              {leaderboardEntries.map((entry, idx) => {
                const rank = idx + 1;
                const entryPet = getPetById(entry.petId);
                const rankFrameBg =
                  rank === 1
                    ? '/assets/pokiguard/sprites/panels-03.png'
                    : rank === 2
                      ? '/assets/pokiguard/sprites/panels-05.png'
                      : rank === 3
                        ? '/assets/pokiguard/sprites/panels-06.png'
                        : '/assets/pokiguard/sprites/panels-02.png';
                const trophyPath =
                  rank <= 3 ? `/assets/pokiguard/sprites/rank_${rank}.png` : null;
                return (
                  <div
                    key={`${entry.name}-${rank}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 14px',
                      borderRadius: 12,
                      backgroundImage: `url('${rankFrameBg}')`,
                      backgroundSize: '100% 100%',
                      border: entry.isPlayer ? '2px solid #4ade80' : '1px solid rgba(56, 189, 248, 0.35)',
                      boxShadow: entry.isPlayer ? '0 0 14px rgba(74, 222, 128, 0.45)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {trophyPath ? (
                        <img src={trophyPath} alt={`#${rank}`} style={{ width: 34, height: 34, objectFit: 'contain' }} />
                      ) : (
                        <span
                          className="pk-num-font"
                          style={{ width: 34, textAlign: 'center', fontSize: 16, fontWeight: 900, color: '#93c5fd' }}
                        >
                          #{rank}
                        </span>
                      )}
                      <img
                        src={`/assets/pokiguard/avatars/${entry.avatarId}.png`}
                        alt={entry.name}
                        style={{ width: 38, height: 42, objectFit: 'contain', borderRadius: 6 }}
                      />
                      <img
                        src={getPetSpritePath(entryPet, entry.isPlayer ? activeTier : entryPet.tier)}
                        alt={entryPet.name}
                        style={{ width: 42, height: 42, objectFit: 'contain' }}
                      />
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 13.5, color: entry.isPlayer ? '#4ade80' : '#fef08a' }}>
                          {entry.name} {entry.isPlayer ? '(Bạn)' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                          Pet: {entryPet.name} • {entry.wins} Chiến Tích
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>LỰC CHIẾN</div>
                      <div className="pk-arcade-power" style={{ fontSize: 18 }}>
                        {entry.power.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: GACHA ĐẬP TRỨNG THẦN THÚ (POKIWAR EGG SMASH) ==================== */}
      {modal === 'EGG' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div className="pk-modal" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-ribbon-title">ĐẬP TRỨNG THẦN THÚ (GACHA)</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            {/* 2 Egg Tiers Side-by-Side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
              {/* Standard Gold Egg */}
              <div className="pk-stone-panel" style={{ padding: 14, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 900, fontSize: 14.5, color: '#fde047' }}>TRỨNG VÀNG CỔ ĐIỂN</div>
                <img src="/assets/pokiguard/sprites/chest_big.png" alt="Trứng Vàng" style={{ width: 72, height: 72, objectFit: 'contain' }} />
                <div style={{ fontSize: 11.5, color: '#cbd5e1' }}>
                  Rơi: Pet S (4%), Mảnh Pet, Đá C2–C3, Bùa Bình An, Vàng
                </div>
                <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
                  <button
                    type="button"
                    className="pk-btn-gold"
                    style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}
                    disabled={progress.gold < 200}
                    onClick={() => handleTriggerEggSmash('GOLD', 1)}
                  >
                    Đập 1x (200V)
                  </button>
                  <button
                    type="button"
                    className="pk-btn-orange"
                    style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}
                    disabled={progress.gold < 1800}
                    onClick={() => handleTriggerEggSmash('GOLD', 10)}
                  >
                    Đập 10x (1,800V)
                  </button>
                </div>
              </div>

              {/* Rare Mega / Stone Egg */}
              <div
                className="pk-stone-panel"
                style={{
                  padding: 14,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  borderColor: '#f59e0b',
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14.5, color: '#fb923c' }}>TRỨNG THẦN THÚ MEGA</div>
                <img src="/assets/pokiguard/sprites/chest_big_open.png" alt="Trứng Thần Thú" style={{ width: 72, height: 72, objectFit: 'contain' }} />
                <div style={{ fontSize: 11.5, color: '#fed7aa' }}>
                  Rơi: <strong>Full Pet Mega (8%)</strong>, +10 Mảnh Mega, Đá C4, Bùa May Mắn
                </div>
                <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
                  <button
                    type="button"
                    className="pk-btn-gold"
                    style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}
                    disabled={progress.stones < 15}
                    onClick={() => handleTriggerEggSmash('RARE', 1)}
                  >
                    Đập 1x (15 Đá)
                  </button>
                  <button
                    type="button"
                    className="pk-btn-orange"
                    style={{ flex: 1, padding: '8px 10px', fontSize: 12 }}
                    disabled={progress.stones < 135}
                    onClick={() => handleTriggerEggSmash('RARE', 10)}
                  >
                    Đập 10x (135 Đá)
                  </button>
                </div>
              </div>
            </div>

            {/* Milestone Pity Bar */}
            <div className="pk-stone-panel" style={{ padding: '10px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#fde047' }}>
                  MỐC TÍCH LŨY ĐẬP TRỨNG ({progress.eggSmashCount ?? 0} lượt)
                </span>
                <span style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>
                  Đạt mốc nhận Mảnh Mega bảo đảm!
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { count: 10, petId: 'pet-mega-zidarose', shards: 10, gold: 400, label: '10 Lần: +10 Mảnh Zida' },
                  { count: 30, petId: 'pet-mega-elpidios', shards: 15, gold: 800, label: '30 Lần: +15 Mảnh Elpidios' },
                  { count: 50, petId: 'pet-mega-twinflame', shards: 20, gold: 1200, label: '50 Lần: +20 Mảnh TwinFlame' },
                  { count: 100, petId: 'pet-mega-icarus', shards: 30, gold: 2500, label: '100 Lần: +30 Mảnh Icarus' },
                ].map((m) => {
                  const reached = (progress.eggSmashCount ?? 0) >= m.count;
                  const claimed = (progress.claimedEggMilestones ?? []).includes(m.count);
                  return (
                    <button
                      key={m.count}
                      type="button"
                      className={reached && !claimed ? 'pk-btn-gold' : 'pk-btn-blue'}
                      style={{ padding: '6px 8px', fontSize: 10.5 }}
                      disabled={!reached || claimed}
                      onClick={() => onClaimEggMilestone?.(m.count, m.petId, m.shards, m.gold)}
                    >
                      {claimed ? `✓ Mốc ${m.count}` : m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drop Results */}
            {eggDrops.length > 0 && (
              <div className="pk-stone-panel" style={{ padding: 10, borderColor: '#fde047' }}>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: '#fde047', marginBottom: 6 }}>
                  KẾT QUẢ ĐẬP TRỨNG ({eggDrops.length} phần thưởng):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                  {eggDrops.map((d, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 4px',
                        borderRadius: 8,
                        background: 'rgba(6, 18, 46, 0.9)',
                        border:
                          d.rarity === 'LEGENDARY'
                            ? '2px solid #fde047'
                            : d.rarity === 'EPIC'
                              ? '1.5px solid #c084fc'
                              : '1px solid #38bdf8',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 3,
                      }}
                    >
                      <img src={d.icon} alt={d.label} style={{ width: 34, height: 34, objectFit: 'contain' }} />
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: d.rarity === 'LEGENDARY' ? '#fde047' : '#e2e8f0', lineHeight: 1.15 }}>
                        {d.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL: ĐIỂM DANH 7 NGÀY & GIFTCODE POKIWAR ZING ME 4.0 ==================== */}
      {modal === 'GIFTCODE' && (
        <div className="stage-modal-backdrop" onClick={() => setModal(null)}>
          <div className="pk-modal" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div className="pk-modal-header">
              <div style={{ width: 38 }} />
              <div className="pk-ribbon-title">ĐIỂM DANH 7 NGÀY &amp; GIFTCODE POKIWAR 4.0</div>
              <button
                type="button"
                className="pk-close-orb"
                aria-label="Đóng"
                title="Đóng"
                onClick={() => setModal(null)}
              >
                <img src="/assets/pokiguard/sprites/btnClose.png" alt="Đóng" />
              </button>
            </div>

            {giftNotice && (
              <div
                className="pk-stone-panel"
                style={{
                  padding: '8px 14px',
                  marginBottom: 10,
                  borderColor: giftNotice.ok ? '#4ade80' : '#f87171',
                  color: giftNotice.ok ? '#86efac' : '#fda4af',
                  fontSize: 12.5,
                  fontWeight: 900,
                }}
              >
                {giftNotice.text}
              </div>
            )}

            {/* 7-Day Checkin Grid */}
            <div style={{ fontSize: 12.5, fontWeight: 900, color: '#fde047', marginBottom: 8 }}>
              📅 QUÀ ĐIỂM DANH 7 NGÀY TÂN THỦ POKIWAR ZING ME:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
              {[
                { day: 1, label: '+800 Vàng', icon: '/assets/pokiguard/sprites/gold.png' },
                { day: 2, label: '+4 Đá Cấp 3', icon: '/assets/pokiguard/sprites/stone_f_3.png' },
                { day: 3, label: '+2 Bùa May Mắn', icon: '/assets/pokiguard/sprites/charm_may_man.png' },
                { day: 4, label: '+15 Mảnh Zida', icon: '/assets/pokiguard/pets/1412.png' },
                { day: 5, label: '+3 Đá Cấp 4', icon: '/assets/pokiguard/sprites/stone_w_4.png' },
                { day: 6, label: '+2,000 Vàng', icon: '/assets/pokiguard/sprites/gold.png' },
                { day: 7, label: 'Pet Moonstar!', icon: '/assets/pokiguard/pets/1503.png' },
              ].map((d) => {
                const claimed = (progress.claimedCheckinDays ?? []).includes(d.day);
                return (
                  <div
                    key={d.day}
                    className="pk-stone-panel"
                    style={{
                      padding: '8px 6px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 5,
                      borderColor: claimed ? '#4ade80' : d.day === 7 ? '#fde047' : '#38bdf8',
                    }}
                  >
                    <span style={{ fontSize: 10.5, fontWeight: 900, color: '#fef08a' }}>Ngày {d.day}</span>
                    <img src={d.icon} alt={d.label} style={{ width: 42, height: 42, objectFit: 'contain' }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#e2e8f0', textAlign: 'center', lineHeight: 1.15 }}>
                      {d.label}
                    </span>
                    <button
                      type="button"
                      className={claimed ? 'pk-btn-blue' : 'pk-btn-gold'}
                      style={{ width: '100%', padding: '4px 4px', fontSize: 10 }}
                      disabled={claimed}
                      onClick={() => {
                        if (!onClaimCheckin) return;
                        const msg = onClaimCheckin(d.day);
                        setGiftNotice({ ok: true, text: msg });
                      }}
                    >
                      {claimed ? 'Đã nhận' : 'Nhận'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Giftcode Section */}
            <div className="pk-stone-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fde047', marginBottom: 6 }}>
                🎁 NHẬP GIFTCODE POKIWAR ZING ME (4.0):
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={giftCodeInput}
                  onChange={(e) => setGiftCodeInput(e.target.value.toUpperCase())}
                  placeholder="Nhập mã Giftcode (VD: POKIWAR40, ZINGME, FULLPET, VIP999)"
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #fbbf24',
                    background: '#050d21',
                    color: '#fff',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                />
                <button
                  type="button"
                  className="pk-btn-gold"
                  style={{ padding: '9px 18px', fontSize: 12.5 }}
                  disabled={!giftCodeInput.trim()}
                  onClick={() => {
                    if (!onRedeemGiftcode) return;
                    const res = onRedeemGiftcode(giftCodeInput.trim());
                    setGiftNotice({ ok: res.success, text: res.message });
                    if (res.success) setGiftCodeInput('');
                  }}
                >
                  Đổi Giftcode
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11, color: '#cbd5e1' }}>
                <span>Mã đang hoạt động (nhấn để điền nhanh):</span>
                {['POKIWAR40', 'ZINGME', 'FULLPET', 'VIP999'].map((code) => {
                  const used = (progress.redeemedCodes ?? []).includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      className={used ? 'pk-btn-blue' : 'pk-btn-gold'}
                      style={{ padding: '3px 9px', fontSize: 10.5 }}
                      onClick={() => setGiftCodeInput(code)}
                    >
                      {code} {used ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {modal === 'KING_ARENA' && (
        <KingArenaModal
          progress={progress}
          initialTab={kingInitTab}
          onClose={() => setModal(null)}
          onSaveTeam={(ids) => onSaveKingTeam?.(ids)}
          onFinishKingMatch={(won, g, gold, elo, op) => onFinishKingMatch?.(won, g, gold, elo, op)}
          onBuyGloryItem={(item, cost) =>
            onBuyGloryItem ? onBuyGloryItem(item, cost) : { success: false, message: 'Chưa kết nối.' }
          }
          onOpenChest={(ch) =>
            onOpenChest ? onOpenChest(ch) : { success: false, message: 'Chưa kết nối.' }
          }
        />
      )}

      {modal === 'PET_HOUSE' && (
        <PetHouseModal
          progress={progress}
          initialTab={petHouseInitTab}
          onClose={() => setModal(null)}
          onBuyOrEquipAura={(aura) =>
            onBuyOrEquipAura ? onBuyOrEquipAura(aura) : { success: false, message: 'Chưa kết nối.' }
          }
          onSetGuardPet={(pid) => onSetGuardPet?.(pid)}
          onSetFusionPet={(pid) => onSetFusionPet?.(pid)}
          onBuyOrEquipItem={(item) =>
            onBuyOrEquipItem ? onBuyOrEquipItem(item) : { success: false, message: 'Chưa kết nối.' }
          }
          onBreakthrough={() =>
            onBreakthrough ? onBreakthrough() : { success: false, message: 'Chưa kết nối.' }
          }
          onReforgeSlot={(slot) =>
            onReforgeSlot ? onReforgeSlot(slot) : { success: false, message: 'Chưa kết nối.' }
          }
        />
      )}

      {modal === 'POKI_EXTRAS' && (
        <PokiExtrasModal
          progress={progress}
          initialTab={extrasInitTab}
          onClose={() => setModal(null)}
          onClaimPyramidReward={(payload) =>
            onClaimPyramidReward
              ? onClaimPyramidReward(payload)
              : { success: false, message: 'Chưa kết nối.' }
          }
          onBuyMysteryOffer={(offer) =>
            onBuyMysteryOffer
              ? onBuyMysteryOffer(offer)
              : { success: false, message: 'Chưa kết nối.' }
          }
          onRefreshMystery={(cost) => (onRefreshMystery ? onRefreshMystery(cost) : false)}
          onSpinLegendWheel={(count) =>
            onSpinLegendWheel
              ? onSpinLegendWheel(count)
              : { success: false, results: [], message: 'Chưa kết nối.' }
          }
          onClaimAchievement={(ach) =>
            onClaimAchievement
              ? onClaimAchievement(ach)
              : { success: false, message: 'Chưa kết nối.' }
          }
        />
      )}

      {modal === 'POKI40_CAMPAIGN' && (
        <Poki40CampaignModal
          progress={progress}
          initialTab={campaignInitTab}
          onClose={() => setModal(null)}
          onStartExpeditionBoss={(boss, stage) => {
            setModal(null);
            onStartExpeditionBoss?.(boss, stage);
          }}
          onClaimExpeditionChest={(boss) =>
            onClaimExpeditionChest
              ? onClaimExpeditionChest(boss)
              : { success: false, message: 'Chưa kết nối.' }
          }
          onResetExpeditionSeason={() =>
            onResetExpeditionSeason
              ? onResetExpeditionSeason()
              : { success: false, message: 'Chưa kết nối.' }
          }
          onStartTreasureGuard={(kind, stage) => {
            setModal(null);
            onStartTreasureGuard?.(kind, stage);
          }}
          onClaimTreasureChest={(chest) =>
            onClaimTreasureChest
              ? onClaimTreasureChest(chest)
              : { success: false, message: 'Chưa kết nối.' }
          }
          onSaveAncientPreset={(idx, grid) => onSaveAncientPreset?.(idx, grid)}
          onFinishAncientMatch={(won, g, gold, elo, opp) => onFinishAncientMatch?.(won, g, gold, elo, opp)}
        />
      )}

      {modal === 'SOCIAL_HUB' && (
        <SocialHubModal
          progress={progress}
          initialTab={socialInitTab}
          onlineSeconds={onlineSeconds}
          onClose={() => setModal(null)}
          onGuildDonate={(cost) =>
            onGuildDonate ? onGuildDonate(cost) : { success: false, message: 'Chưa kết nối.' }
          }
          onFightGuildBoss={(boss) =>
            onFightGuildBoss ? onFightGuildBoss(boss) : { success: false, message: 'Chưa kết nối.' }
          }
          onGuild3v3Win={(won, g, gold) => onGuild3v3Win?.(won, g, gold)}
          onFinishSpaceTrip={(ship) =>
            onFinishSpaceTrip ? onFinishSpaceTrip(ship) : 'Đã hoàn tất thám hiểm!'
          }
          onClaimOnlineReward={(id) =>
            onClaimOnlineReward ? onClaimOnlineReward(id) : { success: false, message: 'Chưa kết nối.' }
          }
          onClaimMail={(mail) =>
            onClaimMail ? onClaimMail(mail) : { success: false, message: 'Chưa kết nối.' }
          }
          onJoinOrRenameGuild={(name) => onJoinOrRenameGuild?.(name)}
        />
      )}
    </div>
  );
}
