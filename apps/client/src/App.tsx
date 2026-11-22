import {
  applyPetProgression,
  calcMultiStoneUpgradeRate,
  CARD_UPGRADE_GOLD_COSTS,
  chooseBotDecision,
  computeAuraTotalBonuses,
  computeEquipmentBonuses,
  createBattleState,
  EVOLUTION_CHAIN,
  executeDefaultCast,
  executeFusionStrike,
  executeInBattleEvolve,
  executeSkill,
  executeSupportCard,
  executeSwap,
  findValidMoves,
  GEM_META,
  GEN_UPGRADE_CORE_COSTS,
  GEN_UPGRADE_GOLD_COSTS,
  getAvatarById,
  getPetById,
  getPetSpriteId,
  getPetSpritePath,
  MAX_PET_LEVEL,
  MAX_UPGRADE_STONE_SLOTS,
  ONLINE_REWARDS,
  passTurn,
  PET_BREAKTHROUGH_GEN_COSTS,
  PET_BREAKTHROUGH_GOLD_COSTS,
  PET_BREAKTHROUGH_SHARD_COSTS,
  STAR_UPGRADE_GOLD_COSTS,
  STAR_UPGRADE_SHARD_COSTS,
  STARTER_PETS,
  SUPPORT_CARDS,
  type AuraDef,
  type BattleEvent,
  type BattleState,
  type BoardGrid,
  type ChatMessage,
  type ChestDef,
  type EggDropItem,
  type ElementType,
  type EquipmentItemDef,
  type EquipmentSlot,
  type GemType,
  type GloryShopItemDef,
  type GuildBossDef,
  type MailItemDef,
  type PetDef,
  type Pos,
  type QteGrade,
  type Side,
  type SpaceShipDef,
  type StageDef,
  type SupportCardId,
  type WheelPrizeDef,
} from '@pokiwar/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from './audio/sfx.js';
import { BattleScreen, type BattleCallout, type FloatingPopup } from './components/BattleScreen.js';
import type { ActiveBreakGroupFx, ActiveSwipeFx } from './components/BoardCanvas.js';
import { LoginScreen, type AuthSessionPayload } from './components/LoginScreen.js';
import { MainLobby, type PlayerProgress, type ReforgeBonus } from './components/MainLobby.js';
import { PetUpgradeScreen } from './components/PetUpgradeScreen.js';
import type { ExpeditionBossDef } from './components/Poki40CampaignModal.js';
import type { AchievementDef, MysteryShopOffer } from './components/PokiExtrasModal.js';
import type { AnimCommand, StageActionCue } from './components/SpineStageCanvas.js';

const STORAGE_KEY = 'pokiwar_16x9_save_v2';
const SESSION_TOKEN_KEY = 'pokiwar_session_token_v1';
const PVE_TURN_MS = 22_000;

function normalizeProgress(parsed?: Partial<PlayerProgress> | null): PlayerProgress {
  const validIds = new Set(STARTER_PETS.map((p) => p.id));
  const rawPetId = parsed?.selectedPetId ?? 'pet-583';
  const migratedPetId = validIds.has(rawPetId)
    ? rawPetId
    : rawPetId === 'pet-5943'
      ? 'pet-1431'
      : 'pet-583';
  const legacyLvMap = (parsed?.petLevels ?? {}) as Record<string, number>;
  const clampedPetLevels: Record<string, number> = {};
  for (const [pid, rawLv] of Object.entries(legacyLvMap)) {
    const n = typeof rawLv === 'number' && Number.isFinite(rawLv) ? Math.floor(rawLv) : 1;
    clampedPetLevels[pid] = Math.max(1, Math.min(MAX_PET_LEVEL, n));
  }
  const migratedLv = clampedPetLevels[migratedPetId] ?? clampedPetLevels['pet-5880'] ?? 1;
  clampedPetLevels[migratedPetId] = Math.max(1, Math.min(MAX_PET_LEVEL, migratedLv));
  const defaultUnlocked = Array.from(new Set([migratedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725']));
  return {
    name: parsed?.name ?? 'Potter',
    avatarId: !parsed?.avatarId || parsed.avatarId === '37' ? '29' : parsed.avatarId,
    unlockedAvatars: parsed?.unlockedAvatars ?? ['29'],
    unlockedPets:
      parsed?.unlockedPets && parsed.unlockedPets.length > 0 ? parsed.unlockedPets : defaultUnlocked,
    petShards: parsed?.petShards ?? {
      'pet-1204': 20,
      'pet-807': 15,
      'pet-mega-zidarose': 15,
    },
    petStars: parsed?.petStars ?? {},
    petGenLevels: parsed?.petGenLevels ?? {},
    petBreakthroughs: parsed?.petBreakthroughs ?? {},
    petUpgradeLuck: parsed?.petUpgradeLuck ?? {},
    equippedSupportCards:
      parsed?.equippedSupportCards && parsed.equippedSupportCards.length > 0
        ? (parsed.equippedSupportCards.slice(0, 3) as SupportCardId[])
        : ['MANA_100', 'RAGE_50', 'HP_350'],
    supportCardLevels: parsed?.supportCardLevels ?? {},
    claimedCheckinDays: parsed?.claimedCheckinDays ?? [],
    redeemedCodes: parsed?.redeemedCodes ?? [],
    level: parsed?.level ?? 1,
    exp: parsed?.exp ?? 0,
    gold: parsed?.gold ?? 1500,
    stones: parsed?.stones ?? 25,
    gloryCoins: parsed?.gloryCoins ?? 200,
    genCores: parsed?.genCores ?? 4,
    stamina: parsed?.stamina ?? 80,
    vipLevel: parsed?.vipLevel ?? 1,
    kingArenaTeam: parsed?.kingArenaTeam ?? [],
    kingArenaElo: parsed?.kingArenaElo ?? 1000,
    ownedAuras: parsed?.ownedAuras ?? ['aura-gold'],
    equippedAuraId: parsed?.equippedAuraId ?? 'aura-gold',
    guardPetId: parsed?.guardPetId ?? null,
    fusionPetId: parsed?.fusionPetId ?? null,
    ownedEquipment: parsed?.ownedEquipment ?? ['eq-non-1', 'eq-vk-1', 'eq-ao-1'],
    equippedEquipment: parsed?.equippedEquipment ?? { NON: 'eq-non-1', VU_KHI: 'eq-vk-1', AO: 'eq-ao-1' },
    equipmentReforges: parsed?.equipmentReforges ?? {},
    breakthroughLv: parsed?.breakthroughLv ?? 0,
    expeditionCleared: parsed?.expeditionCleared ?? [],
    expeditionClaimedChests: parsed?.expeditionClaimedChests ?? [],
    expeditionLockedPets: parsed?.expeditionLockedPets ?? [],
    treasureIslandAttempts: parsed?.treasureIslandAttempts ?? 0,
    treasureArchonKills: parsed?.treasureArchonKills ?? 0,
    treasureStormKills: parsed?.treasureStormKills ?? 0,
    treasureClaimedChests: parsed?.treasureClaimedChests ?? [],
    ancientArenaElo: parsed?.ancientArenaElo ?? 1100,
    ancientArenaTurns: parsed?.ancientArenaTurns ?? 0,
    ancientPresets: parsed?.ancientPresets,
    guildName: parsed?.guildName ?? 'Hội Quán ZingMe',
    guildLevel: parsed?.guildLevel ?? 1,
    guildExp: parsed?.guildExp ?? 0,
    claimedOnlineRewards: parsed?.claimedOnlineRewards ?? [],
    claimedMailIds: parsed?.claimedMailIds ?? [],
    claimedAchievements: parsed?.claimedAchievements ?? [],
    legendSpinCount: parsed?.legendSpinCount ?? 0,
    stoneBag: parsed?.stoneBag ?? [8, 4, 2, 1, 0],
    wins: parsed?.wins ?? 0,
    worldBossBestDamage: parsed?.worldBossBestDamage ?? 0,
    wheelSpunCount: parsed?.wheelSpunCount ?? 0,
    eggSmashCount: parsed?.eggSmashCount ?? 0,
    claimedEggMilestones: parsed?.claimedEggMilestones ?? [],
    selectedPetId: migratedPetId,
    petLevels: clampedPetLevels,
    petTiers: parsed?.petTiers ?? {},
    clearedStages: parsed?.clearedStages ?? [],
    claimedMissions: parsed?.claimedMissions ?? [],
  };
}

function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeProgress(JSON.parse(raw) as PlayerProgress);
    }
  } catch {
    // ignore storage errors
  }
  return normalizeProgress(null);
}

function getWsUrl(): string {
  const custom = import.meta.env.VITE_WS_URL as string | undefined;
  if (custom) return custom;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function App() {
  const [progress, setProgress] = useState<PlayerProgress>(loadProgress);
  const [screen, setScreen] = useState<'LOGIN' | 'LOBBY' | 'UPGRADE' | 'BATTLE'>('LOGIN');
  const [authSession, setAuthSession] = useState<AuthSessionPayload | null>(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [scale, setScale] = useState(1);
  const [fps, setFps] = useState(60);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  // Battle State
  const [battleMode, setBattleMode] = useState<'PVE' | 'PVP'>('PVE');
  const [activeStage, setActiveStage] = useState<StageDef | null>(null);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [lastEvents, setLastEvents] = useState<BattleEvent[]>([]);
  const [yourSide, setYourSide] = useState<Side>('P1');
  const [opponentName, setOpponentName] = useState('Bot Pokiwar');
  const [hintMove, setHintMove] = useState<{ from: Pos; to: Pos } | null>(null);
  const [turnDeadlineMs, setTurnDeadlineMs] = useState(0);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);
  const [overlayPaused, setOverlayPaused] = useState(false);
  const [petModalTab, setPetModalTab] = useState<'UPGRADE' | 'EVOLVE_TREE'>('UPGRADE');
  const [activeMercenaryCount, setActiveMercenaryCount] = useState(0);
  const [activeExpeditionBossId, setActiveExpeditionBossId] = useState<string | null>(null);
  const [activeTreasureGuardKind, setActiveTreasureGuardKind] = useState<'ARCHON' | 'STORM' | null>(null);

  // Visual Combat FX & 4-Phase Pokiwar Swipe -> Sequential Match-3 -> Collected Gems -> Effect Choreography
  const [boardFaded, setBoardFaded] = useState(false);
  const [displayBoard, setDisplayBoard] = useState<BoardGrid | undefined>(undefined);
  const [activeSwipe, setActiveSwipe] = useState<ActiveSwipeFx | null>(null);
  const [breakingGroup, setBreakingGroup] = useState<ActiveBreakGroupFx | null>(null);
  const [collectedGems, setCollectedGems] = useState<{ gemType: GemType; count: number }[]>([]);
  const [collectedCombo, setCollectedCombo] = useState(0);
  const [animatingTurn, setAnimatingTurn] = useState(false);
  const [capturedNewPet, setCapturedNewPet] = useState<PetDef | null>(null);
  const [alreadyCapturedNote, setAlreadyCapturedNote] = useState(false);
  const playbackTimersRef = useRef<number[]>([]);
  const [callout, setCallout] = useState<BattleCallout | string | null>(null);
  const [actionCue, setActionCue] = useState<StageActionCue | null>(null);
  const [animCommand, setAnimCommand] = useState<AnimCommand | null>(null);
  const [popups, setPopups] = useState<FloatingPopup[]>([]);
  const [battleSpeed, setBattleSpeed] = useState<1 | 2>(1);
  const battleSpeedRef = useRef<1 | 2>(1);
  battleSpeedRef.current = battleSpeed;

  // PvP Socket
  const wsRef = useRef<WebSocket | null>(null);
  const [pvpStatus, setPvpStatus] = useState<'IDLE' | 'CONNECTING' | 'QUEUED' | 'WAITING_ROOM'>('IDLE');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [pvpError, setPvpError] = useState<string | null>(null);
  const rewardClaimedRef = useRef(false);
  const seqRef = useRef(1);
  const pausedAtRef = useRef<number | null>(null);

  // Pokiwar 4.0 Social: Online Timer, World Chat & Server Marquee Announcements
  const [onlineSeconds, setOnlineSeconds] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      channel: 'SYSTEM',
      sender: 'Hệ Thống',
      text: 'Chào mừng đến Pokiwar 4.0 Zing Me! Vào Đấu Trường Bá Vương 5v5, Nhà PET & Hội Quán ngay!',
      ts: Date.now(),
    },
  ]);
  const [serverAnnounceText, setServerAnnounceText] = useState<string | null>(
    'Pokiwar 4.0 Zing Me: Đã mở Đấu Trường Bá Vương 5v5, Nhà PET Vòng Sáng, Hội Quán & Thám Hiểm Vũ Trụ!',
  );
  const chatWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setOnlineSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-regen stamina (+1 every 30s up to 80)
  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((prev) => {
        const cur = prev.stamina ?? 80;
        if (cur >= 80) return prev;
        return { ...prev, stamina: Math.min(80, cur + 1) };
      });
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Persistent lightweight WebSocket for World Chat & Server-Wide Announcements
  useEffect(() => {
    if (screen === 'LOGIN') return;
    if (chatWsRef.current && chatWsRef.current.readyState <= WebSocket.OPEN) return;
    try {
      const ws = new WebSocket(getWsUrl());
      chatWsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data as string);
          if (data.type === 'CHAT_HISTORY' && Array.isArray(data.messages)) {
            setChatMessages(data.messages);
          } else if (data.type === 'CHAT_MESSAGE' && data.message) {
            setChatMessages((prev) => [...prev.slice(-45), data.message]);
          } else if (data.type === 'SERVER_ANNOUNCE' && typeof data.text === 'string') {
            setServerAnnounceText(data.text);
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        if (chatWsRef.current === ws) chatWsRef.current = null;
      };
    } catch {
      // ignore offline chat fallback
    }
  }, [screen]);

  const broadcastAnnounce = useCallback((text: string) => {
    setServerAnnounceText(text);
    if (chatWsRef.current?.readyState === WebSocket.OPEN) {
      chatWsRef.current.send(JSON.stringify({ type: 'SERVER_ANNOUNCE', text }));
    } else {
      setChatMessages((prev) => [
        ...prev.slice(-45),
        { id: `local-sys-${Date.now()}`, channel: 'SYSTEM', sender: 'Thông Báo', text, ts: Date.now() },
      ]);
    }
  }, []);

  const handleSendChat = useCallback(
    (channel: 'WORLD' | 'SERVER' | 'GUILD', text: string) => {
      const vip = progress.vipLevel ?? Math.min(10, Math.floor(progress.level / 10) + 1);
      if (chatWsRef.current?.readyState === WebSocket.OPEN) {
        chatWsRef.current.send(
          JSON.stringify({ type: 'CHAT_SEND', channel, sender: progress.name, vip, text }),
        );
      } else {
        setChatMessages((prev) => [
          ...prev.slice(-45),
          { id: `local-${Date.now()}`, channel, sender: progress.name, vip, text, ts: Date.now() },
        ]);
      }
    },
    [progress.name, progress.vipLevel, progress.level],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore
    }
    if (authSession?.token) {
      const token = authSession.token;
      const timer = setTimeout(() => {
        fetch('/api/auth/progress', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ progress }),
        }).catch(() => {});
      }, 650);
      return () => clearTimeout(timer);
    }
  }, [progress, authSession]);

  // Check server status & restore active tab session if present
  useEffect(() => {
    fetch('/health')
      .then((r) => setServerOnline(r.ok))
      .catch(() => setServerOnline(false));

    try {
      const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (savedToken) {
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.ok && data.user) {
              setAuthSession({
                token: savedToken,
                username: data.user.username,
                displayName: data.user.displayName,
                serverId: data.user.serverId,
                isGuest: false,
              });
              if (data.progress) setProgress(normalizeProgress(data.progress as PlayerProgress));
              setScreen('LOBBY');
            }
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const updateScale = () => {
      const vw = Math.min(
        window.visualViewport?.width ?? window.innerWidth,
        document.documentElement.clientWidth || window.innerWidth,
      );
      const vh = Math.min(
        window.visualViewport?.height ?? window.innerHeight,
        document.documentElement.clientHeight || window.innerHeight,
      );
      const s = Math.min(vw / 1280, vh / 720);
      setScale(Math.max(0.25, s));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, []);

  useEffect(() => {
    const preloadUrls = [
      '/assets/pokiguard/sprites/pedestal.png',
      '/assets/pokiguard/sprites/pedestal_blue.png',
      '/assets/pokiguard/sprites/standSlot.png',
      '/assets/pokiguard/sprites/haoquang.png',
      '/assets/pokiguard/pets/581.png',
      '/assets/pokiguard/pets/582.png',
      '/assets/pokiguard/pets/583.png',
      '/assets/pokiguard/pets/1203.png',
      '/assets/pokiguard/sprites/stone_f_1.png',
      '/assets/pokiguard/sprites/stone_f_2.png',
      '/assets/pokiguard/sprites/stone_f_3.png',
      '/assets/pokiguard/sprites/stone_f_4.png',
      '/assets/pokiguard/sprites/stone_f_5.png',
      '/assets/pokiguard/sprites/gem_attack.png',
      '/assets/pokiguard/sprites/gem_mana.png',
      '/assets/pokiguard/sprites/gem_rage.png',
      '/assets/pokiguard/sprites/gem_heal.png',
      '/assets/pokiguard/sprites/gem_armor.png',
      '/assets/pokiguard/sprites/gem_steal.png',
    ];
    for (const url of preloadUrls) {
      const img = new Image();
      img.src = url;
    }

    let frames = 0;
    let last = performance.now();
    let rafId = 0;
    const loop = (now: number) => {
      frames++;
      if (now - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = now;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const spawnPopup = useCallback((side: Side, text: string, color: string, isBurst = false) => {
    const id = seqRef.current++;
    setPopups((prev) => [...prev, { id, side, text, color, isBurst }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, isBurst ? 1150 : 1020);
  }, []);

  const playEventsVisuals = useCallback(
    (events: BattleEvent[], nextState: BattleState, mySide: Side) => {
      let maxCombo = 0;
      let totalDmg = 0;
      let totalHeal = 0;
      let totalShield = 0;
      let totalRage = 0;
      let totalMana = 0;
      let totalPurple = 0;
      let hitTarget: Side | null = null;
      let attackerSide: Side = mySide;
      let mainGemColor = '#fde047';
      let matchedGem: { gemType: GemType; count: number } | null = null;
      let skillCardImage: string | undefined;
      let calloutText: string | null = null;
      let isSkill = false;

      for (const ev of events) {
        if (ev.type === 'MATCH_CLEAR') {
          maxCombo = Math.max(maxCombo, ev.cascadeIndex);
          if (ev.groups[0]) {
            const g = ev.groups[0];
            const totalEff = ev.groups.reduce((acc, grp) => acc + grp.effectiveValue, 0);
            mainGemColor = GEM_META[g.gemType].color;
            matchedGem = { gemType: g.gemType, count: totalEff };
            calloutText = `${GEM_META[g.gemType].label} x${totalEff}`;
          }
        }
        if (ev.type === 'RESOURCE_DELTA') {
          attackerSide = ev.side;
          if (ev.damage && ev.damage > 0) {
            totalDmg += ev.damage;
            hitTarget = ev.target;
            const heavyHit = Boolean(ev.isCrit || ev.damage >= Math.round(nextState.fighters[ev.target].maxHp * 0.14));
            spawnPopup(
              ev.target,
              ev.isCrit ? `${ev.damage.toLocaleString('vi-VN')}!` : `${ev.damage.toLocaleString('vi-VN')}`,
              ev.isCrit ? '#fde047' : '#ffffff',
              heavyHit,
            );
          }
          if (ev.heal && ev.heal > 0) {
            totalHeal += ev.heal;
            spawnPopup(ev.side, `+${ev.heal} HP`, '#4ade80');
          }
          if (ev.shieldGain && ev.shieldGain > 0) {
            totalShield += ev.shieldGain;
            spawnPopup(ev.side, `+${ev.shieldGain} Giáp 🛡️`, '#a78bfa');
          }
          if (ev.rageGain && ev.rageGain > 0 && ev.gemType === 'FIRE') {
            totalRage += ev.rageGain;
            spawnPopup(ev.side, `+${ev.rageGain} Nộ 🔥`, '#fb923c');
          }
          if (ev.purpleGain && ev.purpleGain > 0 && ev.gemType === 'YINYANG') {
            totalPurple += ev.purpleGain;
            spawnPopup(ev.side, `+${ev.purpleGain} Tích Lũy ✦`, '#c084fc');
          }
          if (ev.manaGain && ev.manaGain > 0 && ev.gemType === 'LIGHTNING') {
            totalMana += ev.manaGain;
            spawnPopup(ev.side, `+${ev.manaGain} Mana ⚡`, '#38bdf8');
          }
          if (ev.manaDrained || ev.rageDrained) {
            spawnPopup(
              ev.side,
              `Hút ${ev.manaDrained ?? 0}M / ${ev.rageDrained ?? 0} Nộ`,
              '#e2e8f0',
            );
          }
        }
        if (ev.type === 'IN_BATTLE_EVOLVE') {
          isSkill = true;
          attackerSide = ev.side;
          calloutText = `HÓA THẦN CUỒNG NỘ! (+${ev.hpBonus} HP / +20% Công / +200 Mana)`;
          skillCardImage = `/assets/pokiguard/pets/${ev.newSpriteId}.png`;
          spawnPopup(ev.side, `HÓA THẦN +${ev.hpBonus} HP!`, '#fde047');
        }
        if (ev.type === 'SUPPORT_CARD_CAST') {
          attackerSide = ev.side;
          if (ev.manaGain && ev.manaGain > 0) {
            spawnPopup(ev.side, `+${ev.manaGain} Mana`, '#38bdf8');
          }
          if (ev.rageGain && ev.rageGain > 0) {
            spawnPopup(ev.side, `+${ev.rageGain} Nộ`, '#fb923c');
          }
          if (ev.heal && ev.heal > 0) {
            totalHeal += ev.heal;
            spawnPopup(ev.side, `+${ev.heal} HP`, '#4ade80');
          }
          if (ev.shieldGain && ev.shieldGain > 0) {
            totalShield += ev.shieldGain;
            spawnPopup(ev.side, `+${ev.shieldGain} Giáp`, '#a78bfa');
          }
          if (ev.damage && ev.damage > 0) {
            totalDmg += ev.damage;
            hitTarget = ev.side === 'P1' ? 'P2' : 'P1';
            spawnPopup(hitTarget, `-${ev.damage} ĐÓNG BĂNG!`, '#7dd3fc');
          }
          if (ev.appliedStatus === 'ATK_UP') {
            spawnPopup(ev.side, '+35% CÔNG!', '#fca5a5');
          }
          if (ev.manaDrained || ev.rageDrained) {
            spawnPopup(ev.side, `Hút ${ev.manaDrained ?? 0}M/${ev.rageDrained ?? 0} Nộ`, '#e2e8f0');
          }
        }
        if (ev.type === 'DEFAULT_CAST') {
          isSkill = true;
          attackerSide = ev.side;
          calloutText = ev.skillName;
          skillCardImage = '/assets/pokiguard/cards/card4.png';
          totalDmg += ev.damage;
          hitTarget = ev.side === 'P1' ? 'P2' : 'P1';
          spawnPopup(hitTarget, `${ev.damage.toLocaleString('vi-VN')}`, '#ffffff', true);
        }
        if (ev.type === 'SKILL_CAST') {
          isSkill = true;
          attackerSide = ev.side;
          const baseCallout = ev.qteGrade ? `${ev.skillName} [${ev.qteGrade}]` : ev.skillName;
          calloutText = ev.specialNote ? `${baseCallout} • ${ev.specialNote}` : baseCallout;
          const actorFighter = nextState.fighters[ev.side];
          mainGemColor = actorFighter.colorPrimary;
          skillCardImage = actorFighter.skills.find((s) => s.name === ev.skillName)?.cardImage;
          if (ev.damage && ev.damage > 0) {
            totalDmg += ev.damage;
            hitTarget = ev.side === 'P1' ? 'P2' : 'P1';
            spawnPopup(
              hitTarget,
              `${ev.damage.toLocaleString('vi-VN')}`,
              ev.qteGrade === 'PERFECT' ? '#fef08a' : '#ffffff',
              true,
            );
          }
          if (ev.heal && ev.heal > 0) {
            totalHeal += ev.heal;
            spawnPopup(ev.side, `+${ev.heal} HP`, '#4ade80');
          }
          if (ev.shieldGain && ev.shieldGain > 0) {
            totalShield += ev.shieldGain;
            spawnPopup(ev.side, `+${ev.shieldGain} Giáp`, '#7dd3fc');
          }
        }
        if (ev.type === 'REVIVE') {
          isSkill = true;
          attackerSide = ev.side;
          calloutText = `❤️ HỒI SINH T2! (+${ev.hpRestored} HP • Còn ${ev.remainingCharges} Tim)`;
          spawnPopup(ev.side, `❤️ HỒI SINH +${ev.hpRestored} HP!`, '#fb7185');
        }
        if (ev.type === 'PASS_TURN') {
          calloutText = ev.autoLost ? 'BỎ 3 LƯỢT — XỬ THUA!' : `Bỏ lượt (${ev.consecutivePasses}/2)`;
        }
        if (ev.type === 'EXTRA_TURN') {
          calloutText = 'NỐI 4+ VIÊN — THÊM LƯỢT!';
        }
      }

      if (isSkill) sfx.playSkill();
      else if (maxCombo > 0) sfx.playMatch(maxCombo);

      if (maxCombo >= 2 && calloutText && !calloutText.includes('THÊM LƯỢT')) {
        calloutText = `${calloutText} • COMBO x${maxCombo}!`;
      }

      const nextCallout: BattleCallout | null = calloutText
        ? {
            text: calloutText,
            gemType: matchedGem?.gemType,
            count: matchedGem?.count,
            combo: maxCombo,
            skillCardImage,
          }
        : null;

      const spd = battleSpeedRef.current === 2 ? 1.85 : 1;
      if (totalDmg > 0 || isSkill) {
        if (hitTarget) {
          setTimeout(() => sfx.playHit(), Math.round(260 / spd));
        }
        setBoardFaded(true);
        if (nextCallout) setCallout(nextCallout);
        const id = seqRef.current++;
        setActionCue({
          id,
          attackerSide,
          kind: isSkill ? 'SKILL' : 'GEM_ATTACK',
          colorHex: mainGemColor,
        });
        setAnimCommand({
          id,
          actor: attackerSide,
          type: isSkill ? 'SKILL' : 'ATTACK',
          element: nextState.fighters[attackerSide].element,
          crit: maxCombo >= 2,
        });
        setTimeout(() => {
          setBoardFaded(false);
          setCallout(null);
        }, Math.round(780 / spd));
      } else {
        const selfAnimType =
          totalRage > 0
            ? 'RAGE'
            : totalPurple > 0
              ? 'ENERGY'
              : totalShield > 0
                ? 'SHIELD'
                : totalHeal > 0
                  ? 'HEAL'
                  : totalMana > 0
                    ? 'MANA'
                    : null;
        if (selfAnimType) {
          setAnimCommand({
            id: seqRef.current++,
            actor: attackerSide,
            type: selfAnimType,
            element: nextState.fighters[attackerSide].element,
          });
        }
        if (nextCallout) {
          setCallout(nextCallout);
          setTimeout(() => setCallout(null), 900);
        }
      }

      if (nextState.winner) {
        if (nextState.winner === mySide) sfx.playWin();
        else sfx.playLose();
      }
    },
    [spawnPopup],
  );

  const clearPlaybackTimers = useCallback(() => {
    for (const tid of playbackTimersRef.current) {
      window.clearTimeout(tid);
    }
    playbackTimersRef.current = [];
    setBreakingGroup(null);
    setCollectedGems([]);
    setCollectedCombo(0);
    setAnimatingTurn(false);
  }, []);

  const schedulePlayback = useCallback((ms: number, fn: () => void) => {
    const tid = window.setTimeout(fn, ms);
    playbackTimersRef.current.push(tid);
  }, []);

  const playChoreographedTurn = useCallback(
    (prevBoard: BoardGrid | null, events: BattleEvent[], nextState: BattleState, mySide: Side, resetDeadline = true) => {
      clearPlaybackTimers();
      const swapEv = events.find((e) => e.type === 'SWAP');
      const matchClears = events.filter((e): e is Extract<BattleEvent, { type: 'MATCH_CLEAR' }> => e.type === 'MATCH_CLEAR');
      const refills = events.filter((e): e is Extract<BattleEvent, { type: 'BOARD_REFILL' }> => e.type === 'BOARD_REFILL');

      // Fast path for non-board actions (pure buff/heal/pass/support card)
      if (!swapEv && matchClears.length === 0) {
        setBattleState({ ...nextState });
        setDisplayBoard(nextState.board);
        setLastEvents(events);
        playEventsVisuals(events, nextState, mySide);
        if (resetDeadline) setTurnDeadlineMs(Date.now() + PVE_TURN_MS);
        return;
      }

      setAnimatingTurn(true);
      setLastEvents([]);
      const spd = battleSpeedRef.current === 2 ? 1.85 : 1;
      let t = 0;

      // PHASE 1: Glowing Gem Swipe Trail + 2-Gem Slide Swap
      if (swapEv && prevBoard) {
        const swapped = prevBoard.map((row) => row.map((cell) => ({ ...cell })));
        const tmp = swapped[swapEv.from.row][swapEv.from.col];
        swapped[swapEv.from.row][swapEv.from.col] = swapped[swapEv.to.row][swapEv.to.col];
        swapped[swapEv.to.row][swapEv.to.col] = tmp;
        setActiveSwipe({ id: seqRef.current++, from: swapEv.from, to: swapEv.to, valid: true });
        setDisplayBoard(swapped);
        t += Math.round(195 / spd);
      } else if (prevBoard) {
        setDisplayBoard(prevBoard);
        t += Math.round(80 / spd);
      }

      // PHASE 2: Sequential Match-3 Pop (bộ 3 -> bộ 3 -> gravity refill -> combo 2...)
      const runningTotals = new Map<GemType, number>();
      let maxComboSeen = 0;

      matchClears.forEach((mc, cascadeIdx) => {
        maxComboSeen = Math.max(maxComboSeen, mc.cascadeIndex);
        mc.groups.forEach((grp) => {
          const breakTime = t;
          const comboNow = maxComboSeen;
          const nextCount = (runningTotals.get(grp.gemType) ?? 0) + grp.effectiveValue;
          runningTotals.set(grp.gemType, nextCount);
          const traySnapshot = Array.from(runningTotals.entries()).map(([gemType, count]) => ({
            gemType,
            count,
          }));

          schedulePlayback(breakTime, () => {
            sfx.playMatch(mc.cascadeIndex);
            setBreakingGroup({
              id: seqRef.current++,
              positions: grp.positions,
              gemType: grp.gemType,
              cascadeIndex: mc.cascadeIndex,
            });
            setCollectedGems(traySnapshot);
            setCollectedCombo(comboNow);
          });
          t += Math.round(175 / spd);
        });

        // Gravity refill for THIS cascade!
        const refillEv = refills[cascadeIdx];
        if (refillEv) {
          const dropTime = t;
          schedulePlayback(dropTime, () => {
            setBreakingGroup(null);
            setDisplayBoard(refillEv.boardAfter);
            setLastEvents([refillEv]);
          });
          t += Math.round(235 / spd);
        }
      });

      // PHASE 3: Hide Board & Showcase Collected Gems Tray (PokiGuard style)
      const showcaseTime = t;
      schedulePlayback(showcaseTime, () => {
        setBreakingGroup(null);
        setBoardFaded(true);
      });
      t += Math.round(400 / spd);

      // PHASE 4: Execute Eaten Gems Effects + Pet Dash/Skill Animation + Damage/Heal Popups
      const executeTime = t;
      schedulePlayback(executeTime, () => {
        setBattleState({ ...nextState });
        setDisplayBoard(nextState.board);
        setLastEvents(events);
        playEventsVisuals(events, nextState, mySide);
        if (resetDeadline) setTurnDeadlineMs(Date.now() + PVE_TURN_MS);
      });

      // Release lock after Pet animation finishes
      schedulePlayback(executeTime + Math.round(700 / spd), () => {
        setCollectedGems([]);
        setCollectedCombo(0);
        setBoardFaded(false);
        setAnimatingTurn(false);
      });
    },
    [clearPlaybackTimers, playEventsVisuals, schedulePlayback],
  );

  // Safety sync: whenever not animating a turn, displayBoard MUST match live battleState.board 100%
  useEffect(() => {
    if (!animatingTurn && battleState) {
      setDisplayBoard(battleState.board);
    }
  }, [animatingTurn, battleState]);

  // Claim Victory Rewards once + Authentic Pokiwar First-Clear Pet Ownership Rule!
  useEffect(() => {
    if (!battleState?.winner || rewardClaimedRef.current) return;
    rewardClaimedRef.current = true;

    const bonusGold = battleState.bonusGold[yourSide] ?? 0;
    if (battleState.winner === yourSide) {
      const gainGold =
        (battleMode === 'PVE' && activeStage ? activeStage.rewards.gold : 650) + bonusGold;
      const gainExp = battleMode === 'PVE' && activeStage ? activeStage.rewards.exp : 320;
      const gainStones = battleMode === 'PVE' && activeStage ? activeStage.rewards.stones : 15;

      // Compute first-clear capture BEFORE setProgress so Victory banner displays immediately
      let justCapturedPet: PetDef | null = null;
      let wasAlreadyCleared = false;
      if (battleMode === 'PVE' && activeStage) {
        const isFirstClear = !progress.clearedStages.includes(activeStage.id);
        const alreadyOwned = (progress.unlockedPets ?? []).includes(activeStage.enemyPetId);
        if (isFirstClear && (activeStage.captureOnFirstClear ?? true) && !alreadyOwned) {
          justCapturedPet = getPetById(activeStage.enemyPetId);
        } else if (!isFirstClear) {
          wasAlreadyCleared = true;
        }
      }
      setCapturedNewPet(justCapturedPet);
      setAlreadyCapturedNote(wasAlreadyCleared);
      if (justCapturedPet && activeStage) {
        broadcastAnnounce(`🎉 ${progress.name} vượt ${activeStage.name} và THU PHỤC thành công ${justCapturedPet.name}!`);
      }

      setProgress((prev) => {
        let nextLv = prev.level;
        let nextExp = prev.exp + gainExp;
        while (nextExp >= nextLv * 500) {
          nextExp -= nextLv * 500;
          nextLv++;
        }
        const bag = [...(prev.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
        bag[1] += 2; // Reward 2 Lv.2 stones on win
        const prevShards = { ...(prev.petShards ?? {}) };
        const prevUnlocked = [...(prev.unlockedPets ?? [prev.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'])];
        const nextPetLevels = { ...prev.petLevels };
        const nextPetStars = { ...(prev.petStars ?? {}) };
        let nextCleared = prev.clearedStages;

        if (battleMode === 'PVE' && activeStage) {
          const isFirstClear = !prev.clearedStages.includes(activeStage.id);
          const shardBonus = isFirstClear ? 15 : 8;
          prevShards[activeStage.enemyPetId] = (prevShards[activeStage.enemyPetId] ?? 0) + shardBonus;
          if (isFirstClear) {
            nextCleared = [...prev.clearedStages, activeStage.id];
            // AUTHENTIC POKIWAR RULE: First clear grants ownership of the defeated Pet! Replaying NEVER grants it again.
            if ((activeStage.captureOnFirstClear ?? true) && !prevUnlocked.includes(activeStage.enemyPetId)) {
              prevUnlocked.push(activeStage.enemyPetId);
              nextPetLevels[activeStage.enemyPetId] = nextPetLevels[activeStage.enemyPetId] ?? 1;
              nextPetStars[activeStage.enemyPetId] = nextPetStars[activeStage.enemyPetId] ?? 1;
            }
          }
        }
        const nextExpCleared =
          activeExpeditionBossId && !(prev.expeditionCleared ?? []).includes(activeExpeditionBossId)
            ? [...(prev.expeditionCleared ?? []), activeExpeditionBossId]
            : prev.expeditionCleared ?? [];
        const nextExpLocked = activeExpeditionBossId
          ? Array.from(
              new Set([
                ...(prev.expeditionLockedPets ?? []),
                prev.selectedPetId,
                ...(prev.fusionPetId ? [prev.fusionPetId] : []),
              ]),
            )
          : prev.expeditionLockedPets ?? [];
        const nextArchonKills =
          (prev.treasureArchonKills ?? 0) + (activeTreasureGuardKind === 'ARCHON' ? 1 : 0);
        const nextStormKills =
          (prev.treasureStormKills ?? 0) + (activeTreasureGuardKind === 'STORM' ? 1 : 0);

        return {
          ...prev,
          level: nextLv,
          exp: nextExp,
          gold: prev.gold + gainGold,
          stones: prev.stones + gainStones,
          stoneBag: bag,
          petShards: prevShards,
          unlockedPets: prevUnlocked,
          petLevels: nextPetLevels,
          petStars: nextPetStars,
          wins: prev.wins + 1,
          expeditionCleared: nextExpCleared,
          expeditionLockedPets: nextExpLocked,
          treasureArchonKills: nextArchonKills,
          treasureStormKills: nextStormKills,
          worldBossBestDamage:
            activeStage?.mode === 'BOSS' || activeStage?.isBoss
              ? Math.max(prev.worldBossBestDamage ?? 0, battleState.turnNumber)
              : prev.worldBossBestDamage,
          clearedStages: nextCleared,
        };
      });
    } else if (bonusGold > 0) {
      setProgress((prev) => ({ ...prev, gold: prev.gold + bonusGold }));
    }
  }, [
    battleState?.winner,
    battleState?.bonusGold,
    battleState?.turnNumber,
    yourSide,
    battleMode,
    activeStage,
    activeExpeditionBossId,
    activeTreasureGuardKind,
    broadcastAnnounce,
  ]);

  // Adjust PvE turnDeadlineMs only on pause/resume transitions (prevents render-loop!)
  useEffect(() => {
    if (battleMode !== 'PVE') {
      pausedAtRef.current = null;
      return;
    }
    if (overlayPaused) {
      if (pausedAtRef.current === null) {
        pausedAtRef.current = Date.now();
      }
    } else if (pausedAtRef.current !== null) {
      const pausedDelta = Math.max(0, Date.now() - pausedAtRef.current);
      pausedAtRef.current = null;
      setTurnDeadlineMs((d) => (d > 0 ? d + pausedDelta : d));
    }
  }, [overlayPaused, battleMode]);

  // Turn countdown for both PvP and PvE (freezes cleanly during PvE QTE / Phong Hỏa overlays)
  useEffect(() => {
    if (screen !== 'BATTLE' || !battleState || battleState.winner || !turnDeadlineMs) {
      setTurnSecondsLeft(null);
      return;
    }
    if (battleMode === 'PVE' && overlayPaused) {
      return;
    }
    const tick = () => {
      const sec = Math.max(0, Math.ceil((turnDeadlineMs - Date.now()) / 1000));
      setTurnSecondsLeft(sec);
      if (battleMode === 'PVE' && sec === 0 && battleState.currentTurn === yourSide && !boardFaded && !animatingTurn) {
        const cloned = structuredClone(battleState);
        const res = passTurn(cloned, yourSide);
        if (res.ok) {
          playChoreographedTurn(battleState.board, res.events, res.state, yourSide, true);
        }
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [screen, battleMode, turnDeadlineMs, battleState, yourSide, boardFaded, animatingTurn, overlayPaused, playChoreographedTurn]);

  // PvE Bot Turn
  useEffect(() => {
    if (screen !== 'BATTLE' || battleMode !== 'PVE' || !battleState || battleState.winner) return;
    if (battleState.currentTurn === yourSide || boardFaded || animatingTurn) return;

    const timer = setTimeout(() => {
      const cloned = structuredClone(battleState);
      const decision = chooseBotDecision(cloned, activeStage?.difficulty ?? 'NORMAL');
      if (decision.kind === 'SKILL') {
        const res = executeSkill(cloned, cloned.currentTurn, decision.skillId, decision.qteGrade);
        if (res.ok) {
          playChoreographedTurn(battleState.board, res.events, res.state, yourSide, true);
        }
      } else if (decision.kind === 'DEFAULT_CAST') {
        const res = executeDefaultCast(cloned, cloned.currentTurn);
        if (res.ok) {
          playChoreographedTurn(battleState.board, res.events, res.state, yourSide, true);
        }
      } else if (decision.kind === 'SWAP') {
        const res = executeSwap(cloned, cloned.currentTurn, decision.from, decision.to);
        if (res.ok) {
          playChoreographedTurn(battleState.board, res.events, res.state, yourSide, true);
        }
      } else {
        const res = passTurn(cloned, cloned.currentTurn);
        if (res.ok) {
          playChoreographedTurn(battleState.board, res.events, res.state, yourSide, true);
        }
      }
    }, 620);

    return () => clearTimeout(timer);
  }, [screen, battleMode, battleState, yourSide, activeStage, boardFaded, animatingTurn, playChoreographedTurn]);

  useEffect(() => {
    const id = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING', ts: Date.now() }));
      }
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const handleStartPve = (
    stage: StageDef,
    mercenaryCount = 0,
    chargeGold = true,
    extraOpts?: {
      fieldElement?: ElementType;
      restrictedRules?: boolean;
      expeditionBossId?: string | null;
      treasureGuardKind?: 'ARCHON' | 'STORM' | null;
    },
  ) => {
    let hiredCount = 0;
    let totalCost = 0;
    if (!chargeGold) {
      hiredCount = Math.max(0, Math.min(2, mercenaryCount));
    } else {
      if (mercenaryCount >= 1 && progress.gold >= 150) {
        hiredCount = 1;
        totalCost += 150;
      }
      if (mercenaryCount >= 2 && progress.gold - totalCost >= 200) {
        hiredCount = 2;
        totalCost += 200;
      }
      if (totalCost > 0) {
        setProgress((prev) => ({ ...prev, gold: prev.gold - totalCost }));
      }
    }

    const baseP1 = getPetById(progress.selectedPetId);
    const lv = progress.petLevels[baseP1.id] ?? 1;
    const p1Stars = Math.max(1, Math.min(6, progress.petStars?.[baseP1.id] ?? 1));
    const p1Gen = Math.max(0, Math.min(5, progress.petGenLevels?.[baseP1.id] ?? 0));
    const p1Bt = Math.max(0, Math.min(5, progress.petBreakthroughs?.[baseP1.id] ?? 0));
    const p1 = applyPetProgression(baseP1, lv, baseP1.tier, p1Stars, p1Gen, p1Bt);
    const av = getAvatarById(progress.avatarId);
    const auraB = computeAuraTotalBonuses(progress.ownedAuras ?? ['aura-gold']);
    const eqB = computeEquipmentBonuses(
      progress.equippedEquipment ?? { NON: 'eq-non-1', VU_KHI: 'eq-vk-1', AO: 'eq-ao-1' },
      progress.breakthroughLv ?? 0,
    );
    const reforgeVals = Object.values(progress.equipmentReforges ?? {});
    const rfHp = reforgeVals.reduce((s, r) => s + (r?.hp ?? 0), 0);
    const rfAtk = reforgeVals.reduce((s, r) => s + (r?.atk ?? 0), 0);
    const rfDef = reforgeVals.reduce((s, r) => s + (r?.def ?? 0), 0);
    const rfSpd = reforgeVals.reduce((s, r) => s + (r?.spd ?? 0), 0);
    const gLv = progress.guildLevel ?? 1;
    const guardPetDef = progress.guardPetId ? getPetById(progress.guardPetId) : null;
    const fusionPetDef = progress.fusionPetId ? getPetById(progress.fusionPetId) : null;
    const baseEnemy = getPetById(stage.enemyPetId);
    const p2 = {
      ...baseEnemy,
      tier: baseEnemy.tier,
      spriteId: getPetSpriteId(baseEnemy),
    };
    const seed = Math.floor(Math.random() * 2_147_483_647);
    const state = createBattleState(
      p1,
      p2,
      seed,
      stage.enemyScale,
      lv,
      stage.isBoss || stage.mode === 'BOSS'
        ? Math.max(12, Math.round(stage.enemyScale * 7.8))
        : Math.max(1, Math.round(stage.enemyScale * 5)),
      8,
      8,
      {
        hpBonus: av.hpBonus + auraB.hpBonus + eqB.hpBonus + rfHp + gLv * 120,
        atkBonus: av.atkBonus + auraB.atkBonus + eqB.atkBonus + rfAtk + gLv * 18,
        magicBonus: Math.round(av.atkBonus * 0.7) + eqB.magicBonus + gLv * 14,
        defenseBonus: auraB.defenseBonus + eqB.defenseBonus + rfDef,
        speedBonus: eqB.speedBonus + rfSpd,
        manaBonus: av.manaBonus,
        mercenaryBuff: hiredCount >= 1,
        secondMercenaryBuff: hiredCount >= 2,
        equippedSupportCards: progress.equippedSupportCards,
        supportCardLevels: progress.supportCardLevels,
        petStars: p1Stars,
        genLevel: p1Gen,
        breakthroughLevel: p1Bt,
        auraId: progress.equippedAuraId ?? 'aura-gold',
        guardPet: guardPetDef,
        fusionPet: fusionPetDef,
        fieldElement: extraOpts?.fieldElement,
        restrictedRules: extraOpts?.restrictedRules,
        isBossEncounter: Boolean(stage.isBoss || stage.mode === 'BOSS'),
      },
    );

    clearPlaybackTimers();
    rewardClaimedRef.current = false;
    setActiveExpeditionBossId(extraOpts?.expeditionBossId ?? null);
    setActiveTreasureGuardKind(extraOpts?.treasureGuardKind ?? null);
    setCapturedNewPet(null);
    setAlreadyCapturedNote(false);
    sfx.playBattleBgm();
    setBattleMode('PVE');
    setActiveStage(stage);
    setActiveMercenaryCount(hiredCount);
    setOverlayPaused(false);
    setYourSide('P1');
    setOpponentName(stage.name);
    setBattleState(state);
    setDisplayBoard(state.board);
    setActiveSwipe(null);
    setLastEvents([]);
    setHintMove(null);
    setBoardFaded(false);
    setCallout(null);
    setAnimCommand(null);
    setTurnDeadlineMs(Date.now() + PVE_TURN_MS);
    setScreen('BATTLE');
  };

  const ensureSocket = (onOpenSend: (ws: WebSocket) => void) => {
    setPvpError(null);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      onOpenSend(wsRef.current);
      return;
    }
    if (wsRef.current) wsRef.current.close();

    setPvpStatus('CONNECTING');
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'PING', ts: Date.now() }));
      onOpenSend(ws);
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data as string);
      if (data.type === 'PONG' && typeof data.ts === 'number') {
        setPingMs(Math.max(1, Date.now() - data.ts));
      } else if (data.type === 'QUEUED') {
        setPvpStatus('QUEUED');
      } else if (data.type === 'QUEUE_CANCELLED') {
        setPvpStatus('IDLE');
        setRoomCode(null);
      } else if (data.type === 'ROOM_CREATED') {
        setRoomCode(data.roomCode);
        setPvpStatus('WAITING_ROOM');
      } else if (data.type === 'MATCH_STARTED') {
        clearPlaybackTimers();
        rewardClaimedRef.current = false;
        setCapturedNewPet(null);
        setAlreadyCapturedNote(false);
        sfx.playBattleBgm();
        setPvpStatus('IDLE');
        setRoomCode(null);
        setBattleMode('PVP');
        setActiveStage(null);
        setYourSide(data.yourSide);
        setOpponentName(data.opponentName);
        setBattleState(data.state);
        setDisplayBoard(data.state.board);
        setLastEvents([]);
        setHintMove(null);
        setTurnDeadlineMs(data.turnDeadlineMs);
        setAnimCommand(null);
        setScreen('BATTLE');
      } else if (data.type === 'BATTLE_UPDATE') {
        setBattleState(data.state);
        setDisplayBoard(data.state.board);
        setLastEvents(data.events);
        setTurnDeadlineMs(data.turnDeadlineMs);
        setHintMove(null);
        setYourSide((side) => {
          playEventsVisuals(data.events, data.state, side);
          return side;
        });
      } else if (data.type === 'ERROR') {
        setPvpError(data.message);
      }
    };

    ws.onerror = () => {
      setPvpStatus('IDLE');
      setPvpError('Không kết nối được máy chủ PvP (/ws). Hãy kiểm tra backend đang chạy.');
    };

    ws.onclose = () => {
      setPvpStatus('IDLE');
      setPingMs(null);
    };
  };

  const pvpPayloadMeta = () => ({
    petId: progress.selectedPetId,
    playerName: progress.name,
    petLevel: progress.petLevels[progress.selectedPetId] ?? 1,
    petTier: progress.petTiers[progress.selectedPetId],
    avatarId: progress.avatarId,
  });

  const handleQuickMatch = () => {
    ensureSocket((ws) => ws.send(JSON.stringify({ type: 'QUICK_MATCH', ...pvpPayloadMeta() })));
  };

  const handleCreateRoom = () => {
    ensureSocket((ws) => ws.send(JSON.stringify({ type: 'CREATE_ROOM', ...pvpPayloadMeta() })));
  };

  const handleJoinRoom = (code: string) => {
    ensureSocket((ws) =>
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: code, ...pvpPayloadMeta() })),
    );
  };

  const handleCancelQueue = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CANCEL_QUEUE' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setPvpStatus('IDLE');
    setRoomCode(null);
  };

  const handleSwap = (from: Pos, to: Pos) => {
    if (!battleState || battleState.winner || battleState.currentTurn !== yourSide || boardFaded || animatingTurn) return;
    setHintMove(null);
    sfx.playSwap();

    if (battleMode === 'PVE') {
      const cloned = structuredClone(battleState);
      const res = executeSwap(cloned, yourSide, from, to);
      if (!res.ok) {
        setActiveSwipe({ id: seqRef.current++, from, to, valid: false });
        setCallout(res.error ?? 'Nước đi không hợp lệ');
        setTimeout(() => setCallout(null), 900);
        return;
      }
      playChoreographedTurn(battleState.board, res.events, res.state, yourSide, true);
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SWAP', from, to }));
    }
  };

  const handleCastSkill = (skillId: string, qteGrade?: QteGrade, selectedRows?: number[]) => {
    if (!battleState || battleState.winner || battleState.currentTurn !== yourSide || boardFaded || animatingTurn) return;
    setHintMove(null);

    if (battleMode === 'PVE') {
      const cloned = structuredClone(battleState);
      const res = executeSkill(cloned, yourSide, skillId, qteGrade, selectedRows);
      if (!res.ok) return;
      playChoreographedTurn(battleState.board, res.events, res.state, yourSide, true);
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CAST_SKILL', skillId, qteGrade, selectedRows }));
    }
  };

  const handleSupportCard = (cardId: SupportCardId) => {
    if (!battleState || battleState.winner || battleState.currentTurn !== yourSide || boardFaded || animatingTurn) return;
    if (battleMode === 'PVE') {
      const cloned = structuredClone(battleState);
      const res = executeSupportCard(cloned, yourSide, cardId);
      if (!res.ok) {
        setCallout({ text: res.error ?? 'Không thể dùng Thẻ Hỗ Trợ lúc này' });
        setTimeout(() => setCallout(null), 900);
        return;
      }
      setBattleState({ ...res.state });
      setLastEvents(res.events);
      playEventsVisuals(res.events, res.state, yourSide);
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'SUPPORT_CARD', cardId }));
    }
  };

  const handleInBattleEvolve = () => {
    if (!battleState || battleState.winner || battleState.currentTurn !== yourSide || boardFaded || animatingTurn) return;
    if (battleMode === 'PVE') {
      const cloned = structuredClone(battleState);
      const res = executeInBattleEvolve(cloned, yourSide);
      if (!res.ok) {
        setCallout(res.error ?? 'Không thể tiến hóa lúc này');
        setTimeout(() => setCallout(null), 900);
        return;
      }
      setBattleState({ ...res.state });
      setLastEvents(res.events);
      playEventsVisuals(res.events, res.state, yourSide);
      // Free Action: keeps current deadline!
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'IN_BATTLE_EVOLVE' }));
    }
  };

  const handleDefaultCast = () => {
    if (!battleState || battleState.winner || battleState.currentTurn !== yourSide || boardFaded || animatingTurn) return;
    if (battleMode === 'PVE') {
      const cloned = structuredClone(battleState);
      const res = executeDefaultCast(cloned, yourSide);
      if (!res.ok) {
        setCallout(res.error ?? 'Cần 160 Mana để dùng Thẻ Chưởng');
        setTimeout(() => setCallout(null), 900);
        return;
      }
      setBattleState({ ...res.state });
      setLastEvents(res.events);
      playEventsVisuals(res.events, res.state, yourSide);
      setTurnDeadlineMs(Date.now() + PVE_TURN_MS);
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'DEFAULT_CAST' }));
    }
  };

  const handleFusionStrike = () => {
    if (!battleState || battleState.winner || battleState.currentTurn !== yourSide || boardFaded || animatingTurn) return;
    if (battleMode === 'PVE') {
      const cloned = structuredClone(battleState);
      const res = executeFusionStrike(cloned, yourSide);
      if (!res.ok) {
        setCallout({ text: res.error ?? 'Chưa thể kích hoạt Thẻ Bài Hợp Thể' });
        setTimeout(() => setCallout(null), 1100);
        return;
      }
      const ev = res.events.find((e) => e.type === 'FUSION_STRIKE');
      if (ev && ev.type === 'FUSION_STRIKE') {
        setCallout({ text: `🤝 HỢP THỂ LIÊN KÍCH (${ev.partnerName}) • -${ev.damage} HP!` });
        setTimeout(() => setCallout(null), 1400);
      }
      sfx.playSkill();
      setBattleState({ ...res.state });
      setLastEvents(res.events);
      playEventsVisuals(res.events, res.state, yourSide);
      setTurnDeadlineMs(Date.now() + PVE_TURN_MS);
    }
  };

  const handlePassTurn = () => {
    if (!battleState || battleState.winner || battleState.currentTurn !== yourSide || boardFaded || animatingTurn) return;
    if (battleState.turnNumber <= 1) return;
    if (battleMode === 'PVE') {
      const cloned = structuredClone(battleState);
      const res = passTurn(cloned, yourSide);
      if (!res.ok) return;
      setBattleState({ ...res.state });
      setLastEvents(res.events);
      playEventsVisuals(res.events, res.state, yourSide);
      setTurnDeadlineMs(Date.now() + PVE_TURN_MS);
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'PASS_TURN' }));
    }
  };

  const handleHint = () => {
    if (!battleState || battleState.currentTurn !== yourSide) return;
    const moves = findValidMoves(battleState.board);
    if (moves.length > 0) setHintMove(moves[0]);
  };

  const handleLeaveBattle = () => {
    if (battleMode === 'PVP' && wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN && battleState && !battleState.winner) {
        wsRef.current.send(JSON.stringify({ type: 'SURRENDER' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    clearPlaybackTimers();
    sfx.playLobbyBgm();
    setOverlayPaused(false);
    setActiveMercenaryCount(0);
    setBattleState(null);
    setActiveStage(null);
    setAnimCommand(null);
    setScreen('LOBBY');
  };

  const handleClaimFlipReward = (reward: {
    kind: 'GOLD' | 'STONE' | 'SHARD';
    amount: number;
    stoneLv?: number;
    petId?: string;
    label: string;
    goldCost?: number;
  }) => {
    const cost = reward.goldCost ?? 0;
    setProgress((prev) => {
      if (cost > 0 && prev.gold < cost) return prev;
      const bag = [...(prev.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
      const shards = { ...(prev.petShards ?? {}) };
      let gold = prev.gold - cost;
      let stones = prev.stones;
      if (reward.kind === 'GOLD') {
        gold += reward.amount;
      } else if (reward.kind === 'STONE') {
        const lvIdx = Math.max(0, Math.min(4, (reward.stoneLv ?? 2) - 1));
        bag[lvIdx] = (bag[lvIdx] ?? 0) + reward.amount;
        stones += reward.amount * 2;
      } else if (reward.kind === 'SHARD' && reward.petId) {
        shards[reward.petId] = (shards[reward.petId] ?? 0) + reward.amount;
      }
      return {
        ...prev,
        gold,
        stones,
        stoneBag: bag,
        petShards: shards,
      };
    });
  };

  const handleUnlockPetWithShards = (petId: string): boolean => {
    const unlocked = progress.unlockedPets ?? [progress.selectedPetId, 'pet-583', 'pet-1431', 'pet-725'];
    if (unlocked.includes(petId)) return true;
    const curShards = progress.petShards?.[petId] ?? 0;
    if (curShards < 30) return false;
    setProgress((prev) => {
      const prevUnlocked = prev.unlockedPets ?? [prev.selectedPetId, 'pet-583', 'pet-1431', 'pet-725'];
      const prevShards = { ...(prev.petShards ?? {}) };
      if (prevUnlocked.includes(petId) || (prevShards[petId] ?? 0) < 30) return prev;
      prevShards[petId] = (prevShards[petId] ?? 0) - 30;
      return {
        ...prev,
        unlockedPets: [...prevUnlocked, petId],
        petShards: prevShards,
        petLevels: { ...prev.petLevels, [petId]: prev.petLevels[petId] ?? 1 },
      };
    });
    return true;
  };

  const handleBuyPetUnlock = (petId: string, goldCost: number): boolean => {
    const unlocked = progress.unlockedPets ?? [progress.selectedPetId, 'pet-583', 'pet-1431', 'pet-725'];
    if (unlocked.includes(petId)) return true;
    if (progress.gold < goldCost) return false;
    setProgress((prev) => {
      const prevUnlocked = prev.unlockedPets ?? [prev.selectedPetId, 'pet-583', 'pet-1431', 'pet-725'];
      if (prevUnlocked.includes(petId) || prev.gold < goldCost) return prev;
      return {
        ...prev,
        gold: prev.gold - goldCost,
        unlockedPets: [...prevUnlocked, petId],
        petLevels: { ...prev.petLevels, [petId]: prev.petLevels[petId] ?? 1 },
      };
    });
    return true;
  };

  const handleChangeSupportLoadout = (cards: SupportCardId[]) => {
    const clean = cards.slice(0, 3);
    if (clean.length === 0) return;
    setProgress((prev) => ({ ...prev, equippedSupportCards: clean }));
  };

  const handleUpgradePet = (
    petId: string,
    goldCost: number,
    _stoneCost: number,
    stoneLv: number,
    stackedStones?: [number, number, number, number, number],
  ): { success: boolean; message: string } => {
    const curLv = Math.max(1, Math.min(MAX_PET_LEVEL, progress.petLevels[petId] ?? 1));
    if (curLv >= MAX_PET_LEVEL) {
      return { success: false, message: `👑 Pet đã đạt cấp tối đa Lv.${MAX_PET_LEVEL}/${MAX_PET_LEVEL}!` };
    }
    const bag = [...(progress.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
    const accLuck = progress.petUpgradeLuck?.[petId] ?? 0;

    // Lắp tối đa 3 viên đá (ưu tiên đá cấp cao nhất nếu truyền > 3)
    const usedStack: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    let slotsLeft = MAX_UPGRADE_STONE_SLOTS;
    if (stackedStones && stackedStones.some((n) => n > 0)) {
      for (let i = 4; i >= 0 && slotsLeft > 0; i--) {
        const want = Math.max(0, Math.floor(stackedStones[i] ?? 0));
        const take = Math.min(want, bag[i] ?? 0, slotsLeft);
        if (take > 0) {
          usedStack[i] = take;
          slotsLeft -= take;
        }
      }
    } else {
      const stoneIdx = Math.max(0, Math.min(4, stoneLv - 1));
      if ((bag[stoneIdx] ?? 0) > 0) {
        usedStack[stoneIdx] = 1;
        slotsLeft -= 1;
      }
    }

    const installedCount = MAX_UPGRADE_STONE_SLOTS - slotsLeft;
    if (installedCount <= 0) {
      return { success: false, message: 'Hãy lắp ít nhất 1 viên Đá (tối đa 3 ô) để nâng cấp!' };
    }
    if (progress.gold < goldCost) {
      return { success: false, message: 'Không đủ Vàng để nâng cấp!' };
    }

    const rate = calcMultiStoneUpgradeRate(curLv, usedStack, accLuck);
    const rolled = Math.random() * 100;
    const succeeded = rolled < rate;

    let nextLv = curLv;
    let nextLuck = accLuck;
    let message = '';
    if (succeeded) {
      nextLv = Math.min(MAX_PET_LEVEL, curLv + 1);
      nextLuck = 0;
      message = `Đập Level thành công lên Lv.${nextLv}/${MAX_PET_LEVEL} (${rate}%)!`;
      if (nextLv >= 12) {
        broadcastAnnounce(`Chúc mừng ${progress.name} nâng cấp ${getPetById(petId).name} lên Lv.${nextLv}!`);
      }
    } else {
      // Xóa cơ chế tụt cấp khi thất bại: luôn giữ nguyên cấp hiện tại & tích lũy +10%
      nextLv = curLv;
      nextLuck = Math.min(60, accLuck + 10);
      message = `Đập xịt (${rate}%)! Giữ nguyên Lv.${curLv} & tích lũy +10% (Tổng +${nextLuck}%)!`;
    }

    for (let i = 0; i < 5; i++) {
      bag[i] = Math.max(0, (bag[i] ?? 0) - usedStack[i]);
    }

    setProgress((prev) => ({
      ...prev,
      gold: prev.gold - goldCost,
      stoneBag: bag,
      petLevels: { ...prev.petLevels, [petId]: nextLv },
      petUpgradeLuck: { ...(prev.petUpgradeLuck ?? {}), [petId]: nextLuck },
    }));

    return { success: succeeded, message };
  };

  const handleCombineStones = (fromLvIdx: number): boolean => {
    if (fromLvIdx < 0 || fromLvIdx >= 4) return false;
    const bag = [...(progress.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
    if (bag[fromLvIdx] < 3) return false;
    bag[fromLvIdx] -= 3;
    bag[fromLvIdx + 1] += 1;
    setProgress((prev) => ({ ...prev, stoneBag: bag }));
    return true;
  };

  const handleEvolvePet = (petId: string, goldCost: number, stoneCost: number) => {
    setProgress((prev) => {
      if (prev.gold < goldCost || prev.stones < stoneCost) return prev;
      const base = getPetById(petId);
      const curTier = prev.petTiers[petId] ?? base.tier;
      const idx = EVOLUTION_CHAIN.indexOf(curTier);
      if (idx < 0 || idx >= EVOLUTION_CHAIN.length - 1) return prev;
      return {
        ...prev,
        gold: prev.gold - goldCost,
        stones: prev.stones - stoneCost,
        petTiers: { ...prev.petTiers, [petId]: EVOLUTION_CHAIN[idx + 1] },
      };
    });
  };

  const handleUpgradePetStar = (petId: string): { success: boolean; message: string } => {
    const base = getPetById(petId);
    const unlocked = progress.unlockedPets ?? [progress.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'];
    if (!unlocked.includes(petId)) {
      return { success: false, message: `Cần mở khóa ${base.name} trước khi Nâng Sao!` };
    }
    const curStars = Math.max(1, Math.min(6, progress.petStars?.[petId] ?? 1));
    if (curStars >= 6) {
      return { success: false, message: `${base.name} đã đạt 6★ tối thượng!` };
    }
    const shardCost = STAR_UPGRADE_SHARD_COSTS[curStars];
    const goldCost = STAR_UPGRADE_GOLD_COSTS[curStars];
    const haveShards = progress.petShards?.[petId] ?? 0;
    if (haveShards < shardCost || progress.gold < goldCost) {
      return {
        success: false,
        message: `Cần ${shardCost} Mảnh ${base.name} và ${goldCost.toLocaleString()} Vàng để nâng lên ${curStars + 1}★!`,
      };
    }

    setProgress((prev) => {
      const prevStars = Math.max(1, Math.min(6, prev.petStars?.[petId] ?? 1));
      if (prevStars >= 6) return prev;
      const sCost = STAR_UPGRADE_SHARD_COSTS[prevStars];
      const gCost = STAR_UPGRADE_GOLD_COSTS[prevStars];
      const prevShards = { ...(prev.petShards ?? {}) };
      if ((prevShards[petId] ?? 0) < sCost || prev.gold < gCost) return prev;
      prevShards[petId] = (prevShards[petId] ?? 0) - sCost;
      return {
        ...prev,
        gold: prev.gold - gCost,
        petShards: prevShards,
        petStars: { ...(prev.petStars ?? {}), [petId]: prevStars + 1 },
      };
    });

    if (curStars + 1 >= 4) {
      broadcastAnnounce(`Chúc mừng ${progress.name} Siêu Tiến Hóa thành công ${base.name} lên ${curStars + 1} sao!`);
    }

    return {
      success: true,
      message: `⭐ Siêu Tiến Hóa thành công: ${base.name} tăng lên ${curStars + 1}★ (+8% toàn chỉ số)!`,
    };
  };

  const handleUpgradePetGen = (petId: string): { success: boolean; message: string } => {
    const base = getPetById(petId);
    const curGen = Math.max(0, Math.min(5, progress.petGenLevels?.[petId] ?? 0));
    if (curGen >= 5) {
      return { success: false, message: `${base.name} đã đạt Gen T2 tối đa (Lv.5)!` };
    }
    const coreCost = GEN_UPGRADE_CORE_COSTS[curGen];
    const goldCost = GEN_UPGRADE_GOLD_COSTS[curGen];
    if ((progress.genCores ?? 0) < coreCost || progress.gold < goldCost) {
      return {
        success: false,
        message: `Cần ${coreCost} Tinh Thể Gen T2 & ${goldCost.toLocaleString()} Vàng để nâng Gen Lv.${curGen + 1}!`,
      };
    }
    setProgress((prev) => {
      const g = Math.max(0, Math.min(5, prev.petGenLevels?.[petId] ?? 0));
      if (g >= 5 || (prev.genCores ?? 0) < GEN_UPGRADE_CORE_COSTS[g] || prev.gold < GEN_UPGRADE_GOLD_COSTS[g]) {
        return prev;
      }
      return {
        ...prev,
        gold: prev.gold - GEN_UPGRADE_GOLD_COSTS[g],
        genCores: (prev.genCores ?? 0) - GEN_UPGRADE_CORE_COSTS[g],
        petGenLevels: { ...(prev.petGenLevels ?? {}), [petId]: g + 1 },
      };
    });
    const nextGen = curGen + 1;
    if (nextGen >= 3) {
      broadcastAnnounce(`🧬 ${progress.name} kích hoạt Gen T2 Lv.${nextGen} (Hồi Sinh) cho ${base.name}!`);
    }
    return {
      success: true,
      message:
        nextGen === 3
          ? `🧬 Nâng Gen Lv.3 thành công! ${base.name} đã mở khóa ❤️ Tim Hồi Sinh trong trận!`
          : `🧬 Nâng Gen T2 cho ${base.name} lên Lv.${nextGen} (+6% toàn chỉ số)!`,
    };
  };

  // ==================== BATCH 1, 2, 3 HANDLERS (POKIWAR 4.0 ZING ME) ====================
  const handleSaveKingTeam = (teamIds: string[]) => {
    setProgress((prev) => ({ ...prev, kingArenaTeam: teamIds.slice(0, 5) }));
  };

  const handleFinishKingMatch = (
    won: boolean,
    gloryReward: number,
    goldReward: number,
    eloDelta: number,
    opponentLabel: string,
  ) => {
    setProgress((prev) => ({
      ...prev,
      gold: prev.gold + goldReward,
      gloryCoins: (prev.gloryCoins ?? 0) + gloryReward,
      kingArenaElo: Math.max(800, (prev.kingArenaElo ?? 1000) + eloDelta),
      wins: won ? prev.wins + 1 : prev.wins,
    }));
    if (won) {
      broadcastAnnounce(`🏆 ${progress.name} chiến thắng ${opponentLabel} tại Đấu Trường Bá Vương 5v5 (+${gloryReward} Xu Vinh Quang)!`);
    }
  };

  const handleBuyGloryItem = (item: GloryShopItemDef, cost: number): { success: boolean; message: string } => {
    if ((progress.gloryCoins ?? 0) < cost) {
      return { success: false, message: `Cần ${cost} Xu Vinh Quang!` };
    }
    setProgress((prev) => {
      if ((prev.gloryCoins ?? 0) < cost) return prev;
      const shards = { ...(prev.petShards ?? {}) };
      const bag = [...(prev.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
      let genCores = prev.genCores ?? 0;

      if (item.kind === 'SHARD' && item.refId) {
        shards[item.refId] = (shards[item.refId] ?? 0) + item.amount;
      } else if (item.kind === 'GEN_CORE') {
        genCores += item.amount;
      } else if (item.kind === 'STONE_LV4') {
        bag[3] += item.amount;
      } else if (item.kind === 'STONE_LV5') {
        bag[4] += item.amount;
      }

      return {
        ...prev,
        gloryCoins: (prev.gloryCoins ?? 0) - cost,
        petShards: shards,
        stoneBag: bag,
        genCores,
      };
    });
    return { success: true, message: `🏆 Đổi thành công ${item.name} (-${cost} Xu Vinh Quang)!` };
  };

  const handleOpenChest = (chest: ChestDef): { success: boolean; message: string } => {
    const costGold = chest.costGold ?? 0;
    const costGlory = chest.costGlory ?? 0;
    if (progress.gold < costGold || (progress.gloryCoins ?? 0) < costGlory) {
      return { success: false, message: 'Không đủ Vàng hoặc Xu Vinh Quang để mở Rương!' };
    }
    const pool =
      chest.tier === 'ANCIENT'
        ? STARTER_PETS.filter((p) => p.tier === 'ANCIENT' || p.tier === 'TITAN' || p.tier === 'FANTASY')
        : chest.tier === 'ARTIFACT'
          ? STARTER_PETS.filter((p) => p.tier === 'GALAXY' || p.tier === 'FANTASY' || p.tier === 'MEGA')
          : STARTER_PETS.filter((p) => p.tier === 'LEGEND' || p.tier === 'MEGA' || p.tier === 'S');
    const picked = pool[Math.floor(Math.random() * pool.length)] ?? STARTER_PETS[0];
    const shardGain = chest.tier === 'ANCIENT' ? 20 : chest.tier === 'ARTIFACT' ? 15 : chest.tier === 'WARRIOR' ? 12 : 8;
    const genGain = chest.tier === 'ANCIENT' ? 4 : chest.tier === 'ARTIFACT' ? 2 : 1;
    const stoneGain = chest.tier === 'STARTER' ? 6 : 14;

    setProgress((prev) => {
      if (prev.gold < costGold || (prev.gloryCoins ?? 0) < costGlory) return prev;
      const shards = { ...(prev.petShards ?? {}) };
      shards[picked.id] = (shards[picked.id] ?? 0) + shardGain;
      return {
        ...prev,
        gold: prev.gold - costGold,
        gloryCoins: (prev.gloryCoins ?? 0) - costGlory,
        stones: prev.stones + stoneGain,
        genCores: (prev.genCores ?? 0) + genGain,
        petShards: shards,
      };
    });
    return {
      success: true,
      message: `📦 Mở ${chest.name}: Nhận +${shardGain} Mảnh ${picked.name}, +${stoneGain} Đá & +${genGain} Tinh Thể Gen T2!`,
    };
  };

  const handleBuyOrEquipAura = (aura: AuraDef): { success: boolean; message: string } => {
    const owned = progress.ownedAuras ?? ['aura-gold'];
    if (owned.includes(aura.id)) {
      setProgress((prev) => ({ ...prev, equippedAuraId: aura.id }));
      return { success: true, message: `✨ Đã trang bị hiển thị ${aura.name}!` };
    }
    const gCost = aura.costGold ?? 0;
    const glCost = aura.costGlory ?? 0;
    if (progress.gold < gCost || (progress.gloryCoins ?? 0) < glCost) {
      return { success: false, message: 'Không đủ Vàng hoặc Xu Vinh Quang để mở Vòng Sáng!' };
    }
    setProgress((prev) => {
      const prevOwned = prev.ownedAuras ?? ['aura-gold'];
      if (prevOwned.includes(aura.id)) return { ...prev, equippedAuraId: aura.id };
      if (prev.gold < gCost || (prev.gloryCoins ?? 0) < glCost) return prev;
      return {
        ...prev,
        gold: prev.gold - gCost,
        gloryCoins: (prev.gloryCoins ?? 0) - glCost,
        ownedAuras: [...prevOwned, aura.id],
        equippedAuraId: aura.id,
      };
    });
    broadcastAnnounce(`✨ ${progress.name} mở khóa ${aura.name} (+${aura.hpBonus} HP, +${aura.atkBonus} Công vĩnh viễn)!`);
    return { success: true, message: `✨ Mở khóa & trang bị thành công ${aura.name}!` };
  };

  const handleSetGuardPet = (petId: string | null) => {
    setProgress((prev) => ({ ...prev, guardPetId: petId }));
  };

  const handleBuyOrEquipItem = (item: EquipmentItemDef): { success: boolean; message: string } => {
    const owned = progress.ownedEquipment ?? ['eq-non-1', 'eq-vk-1', 'eq-ao-1'];
    const isFree = item.costGold === 0 && !item.costGlory;
    if (owned.includes(item.id) || isFree) {
      setProgress((prev) => ({
        ...prev,
        equippedEquipment: { ...(prev.equippedEquipment ?? {}), [item.slot]: item.id },
      }));
      return { success: true, message: `⚔️ Đã mặc trang bị ${item.name}!` };
    }
    const gCost = item.costGold ?? 0;
    const glCost = item.costGlory ?? 0;
    if (progress.gold < gCost || (progress.gloryCoins ?? 0) < glCost) {
      return { success: false, message: 'Không đủ Vàng hoặc Xu Vinh Quang để mua trang bị!' };
    }
    setProgress((prev) => {
      const prevOwned = prev.ownedEquipment ?? ['eq-non-1', 'eq-vk-1', 'eq-ao-1'];
      if (prev.gold < gCost || (prev.gloryCoins ?? 0) < glCost) return prev;
      return {
        ...prev,
        gold: prev.gold - gCost,
        gloryCoins: (prev.gloryCoins ?? 0) - glCost,
        ownedEquipment: prevOwned.includes(item.id) ? prevOwned : [...prevOwned, item.id],
        equippedEquipment: { ...(prev.equippedEquipment ?? {}), [item.slot]: item.id },
      };
    });
    return { success: true, message: `⚔️ Mua & mặc thành công ${item.name} (${item.stars}★)!` };
  };

  const handleBreakthrough = (): { success: boolean; message: string } => {
    const curLv = progress.breakthroughLv ?? 0;
    if (curLv >= 15) return { success: false, message: 'Đã đạt Xung Phá Cực Hạn tối đa (Lv.15)!' };
    const goldCost = 900 + curLv * 550;
    const stoneCost = 10 + curLv * 6;
    if (progress.gold < goldCost || progress.stones < stoneCost) {
      return { success: false, message: `Cần ${goldCost} Vàng & ${stoneCost} Đá để Xung Phá!` };
    }
    setProgress((prev) => {
      const lv = prev.breakthroughLv ?? 0;
      const g = 900 + lv * 550;
      const s = 10 + lv * 6;
      if (lv >= 15 || prev.gold < g || prev.stones < s) return prev;
      return {
        ...prev,
        gold: prev.gold - g,
        stones: prev.stones - s,
        breakthroughLv: lv + 1,
      };
    });
    return {
      success: true,
      message: `⚡ Xung Phá Cực Hạn lên Lv.${curLv + 1} thành công (+105 HP, +14 Công/Phép, +10 Thủ, +2 Tốc)!`,
    };
  };

  const handleGuildDonate = (goldCost: number): { success: boolean; message: string } => {
    if (progress.gold < goldCost) return { success: false, message: `Cần ${goldCost} Vàng để cống hiến Hội Quán!` };
    setProgress((prev) => {
      if (prev.gold < goldCost) return prev;
      let gLv = prev.guildLevel ?? 1;
      let gExp = (prev.guildExp ?? 0) + 180;
      while (gExp >= gLv * 500) {
        gExp -= gLv * 500;
        gLv += 1;
      }
      return {
        ...prev,
        gold: prev.gold - goldCost,
        gloryCoins: (prev.gloryCoins ?? 0) + 55,
        guildLevel: gLv,
        guildExp: gExp,
      };
    });
    return { success: true, message: '🏰 Cống hiến Hội Quán thành công: +180 EXP Bang & +55 Xu Vinh Quang!' };
  };

  const handleFightGuildBoss = (boss: GuildBossDef): { success: boolean; message: string } => {
    const curStamina = progress.stamina ?? 80;
    if (curStamina < 10) {
      return { success: false, message: 'Không đủ 10 Thể Lực để đánh Boss Hội Quán! (Hồi tự động hoặc nhận Hộp Thư)' };
    }
    setProgress((prev) => {
      if ((prev.stamina ?? 80) < 10) return prev;
      let gLv = prev.guildLevel ?? 1;
      let gExp = (prev.guildExp ?? 0) + boss.guildExp;
      while (gExp >= gLv * 500) {
        gExp -= gLv * 500;
        gLv += 1;
      }
      const shards = { ...(prev.petShards ?? {}) };
      shards[boss.petId] = (shards[boss.petId] ?? 0) + boss.rewardShards;
      return {
        ...prev,
        stamina: (prev.stamina ?? 80) - 10,
        gold: prev.gold + boss.rewardGold,
        gloryCoins: (prev.gloryCoins ?? 0) + boss.rewardGlory,
        stones: prev.stones + boss.rewardStones,
        petShards: shards,
        guildLevel: gLv,
        guildExp: gExp,
      };
    });
    broadcastAnnounce(`🔥 ${progress.name} cùng ${progress.guildName ?? 'Hội Quán'} tiêu diệt ${boss.name}!`);
    return {
      success: true,
      message: `🔥 Diệt ${boss.name} thành công: +${boss.rewardGlory} Xu, +${boss.rewardGold}V, +${boss.rewardStones} Đá & +${boss.rewardShards} Mảnh!`,
    };
  };

  const handleGuild3v3Win = (won: boolean, gloryReward: number, goldReward: number) => {
    setProgress((prev) => ({
      ...prev,
      gold: prev.gold + goldReward,
      gloryCoins: (prev.gloryCoins ?? 0) + gloryReward,
      guildExp: (prev.guildExp ?? 0) + (won ? 200 : 60),
    }));
  };

  const handleFinishSpaceTrip = (ship: SpaceShipDef): string => {
    const rarePool = STARTER_PETS.filter(
      (p) => p.tier === 'GALAXY' || p.tier === 'ANCIENT' || p.tier === 'TITAN' || p.tier === 'FANTASY',
    );
    const picked = rarePool[Math.floor(Math.random() * rarePool.length)] ?? STARTER_PETS[0];
    setProgress((prev) => {
      const shards = { ...(prev.petShards ?? {}) };
      shards[picked.id] = (shards[picked.id] ?? 0) + ship.shardCount;
      return {
        ...prev,
        gold: prev.gold + ship.rewardGold,
        gloryCoins: (prev.gloryCoins ?? 0) + ship.rewardGlory,
        stones: prev.stones + ship.rewardStones,
        genCores: (prev.genCores ?? 0) + ship.rewardGenCores,
        petShards: shards,
      };
    });
    return `🚀 ${ship.name} cập bến: +${ship.rewardGold}V, +${ship.rewardGlory} Xu, +${ship.rewardGenCores} Gen T2 & +${ship.shardCount} Mảnh ${picked.name}!`;
  };

  const handleClaimOnlineReward = (rewardId: string): { success: boolean; message: string } => {
    const rw = ONLINE_REWARDS.find((r) => r.id === rewardId);
    if (!rw) return { success: false, message: 'Mốc quà không tồn tại.' };
    if ((progress.claimedOnlineRewards ?? []).includes(rewardId)) {
      return { success: false, message: 'Bạn đã nhận mốc quà Online này rồi!' };
    }
    if (onlineSeconds < rw.minutes * 60) {
      return { success: false, message: `Chưa đủ ${rw.minutes} phút Online!` };
    }
    setProgress((prev) => {
      const prevClaimed = prev.claimedOnlineRewards ?? [];
      if (prevClaimed.includes(rewardId)) return prev;
      return {
        ...prev,
        gold: prev.gold + rw.gold,
        stones: prev.stones + rw.stones,
        gloryCoins: (prev.gloryCoins ?? 0) + rw.gloryCoins,
        genCores: (prev.genCores ?? 0) + rw.genCores,
        claimedOnlineRewards: [...prevClaimed, rewardId],
      };
    });
    return { success: true, message: `⏱️ Nhận Quà Online ${rw.minutes} Phút thành công!` };
  };

  const handleClaimMail = (mail: MailItemDef): { success: boolean; message: string } => {
    if ((progress.claimedMailIds ?? []).includes(mail.id)) {
      return { success: false, message: 'Thư này đã nhận quà rồi!' };
    }
    setProgress((prev) => {
      const prevClaimed = prev.claimedMailIds ?? [];
      if (prevClaimed.includes(mail.id)) return prev;
      const shards = { ...(prev.petShards ?? {}) };
      if (mail.rewards.petId && mail.rewards.shards) {
        shards[mail.rewards.petId] = (shards[mail.rewards.petId] ?? 0) + mail.rewards.shards;
      }
      return {
        ...prev,
        gold: prev.gold + (mail.rewards.gold ?? 0),
        stones: prev.stones + (mail.rewards.stones ?? 0),
        gloryCoins: (prev.gloryCoins ?? 0) + (mail.rewards.gloryCoins ?? 0),
        genCores: (prev.genCores ?? 0) + (mail.rewards.genCores ?? 0),
        stamina: Math.min(120, (prev.stamina ?? 80) + (mail.rewards.stamina ?? 0)),
        petShards: shards,
        claimedMailIds: [...prevClaimed, mail.id],
      };
    });
    return { success: true, message: `✉️ Đã nhận toàn bộ quà từ "${mail.title}"!` };
  };

  const handleJoinOrRenameGuild = (guildName: string) => {
    setProgress((prev) => ({ ...prev, guildName }));
  };

  const handleSynthesizePet = (petId: string): { success: boolean; message: string } => {
    const targetPet = getPetById(petId);
    const unlocked = progress.unlockedPets ?? [progress.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'];
    if (unlocked.includes(petId)) {
      return { success: false, message: `Bạn đã sở hữu ${targetPet.name} rồi!` };
    }
    const recipe = targetPet.synthesisRecipe;
    if (!recipe) {
      return { success: false, message: `${targetPet.name} là Pet Khởi Nguyên, mở khóa bằng Mảnh hoặc Đập Trứng!` };
    }
    const reqPet = getPetById(recipe.requiredPetId);
    const hasReqPet = unlocked.includes(reqPet.id);
    const reqLv = progress.petLevels[reqPet.id] ?? 1;
    const bag = [...(progress.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
    const stoneIdx = Math.max(0, Math.min(4, recipe.stoneLevel - 1));
    const haveStones = bag[stoneIdx] ?? 0;

    if (!hasReqPet || reqLv < recipe.requiredPetLevel) {
      return {
        success: false,
        message: `Cần sở hữu ${reqPet.name} đạt Lv.${recipe.requiredPetLevel} để làm phôi Hợp Pet!`,
      };
    }
    if (haveStones < recipe.stoneCount || progress.gold < recipe.goldCost) {
      return {
        success: false,
        message: `Cần ${recipe.stoneCount} Đá Cấp ${recipe.stoneLevel} và ${recipe.goldCost.toLocaleString()} Vàng!`,
      };
    }

    bag[stoneIdx] -= recipe.stoneCount;
    setProgress((prev) => {
      const prevUnlocked = prev.unlockedPets ?? [prev.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'];
      if (prevUnlocked.includes(petId)) return prev;
      return {
        ...prev,
        gold: prev.gold - recipe.goldCost,
        stoneBag: bag,
        unlockedPets: [...prevUnlocked, petId],
        petLevels: { ...prev.petLevels, [petId]: prev.petLevels[petId] ?? 1 },
        petStars: { ...(prev.petStars ?? {}), [petId]: prev.petStars?.[petId] ?? 1 },
      };
    });

    return {
      success: true,
      message: `⚗️ Hợp Pet thành công! Triệu hồi Pet độc lập ${targetPet.name} vào Kho Pet!`,
    };
  };

  const handleUpgradeSupportCard = (cardId: SupportCardId): { success: boolean; message: string } => {
    const def = SUPPORT_CARDS[cardId];
    const curLv = Math.max(1, Math.min(5, progress.supportCardLevels?.[cardId] ?? 1));
    if (curLv >= 5) {
      return { success: false, message: `${def.name} đã đạt cấp tối đa Lv.5!` };
    }
    const cost = CARD_UPGRADE_GOLD_COSTS[curLv];
    if (progress.gold < cost) {
      return { success: false, message: `Cần ${cost} Vàng để Luyện Thẻ ${def.name} lên Lv.${curLv + 1}!` };
    }
    setProgress((prev) => {
      const lv = Math.max(1, Math.min(5, prev.supportCardLevels?.[cardId] ?? 1));
      if (lv >= 5 || prev.gold < CARD_UPGRADE_GOLD_COSTS[lv]) return prev;
      return {
        ...prev,
        gold: prev.gold - CARD_UPGRADE_GOLD_COSTS[lv],
        supportCardLevels: { ...(prev.supportCardLevels ?? {}), [cardId]: lv + 1 },
      };
    });
    return {
      success: true,
      message: `⬆️ Luyện Thẻ thành công: ${def.name} tăng lên Lv.${curLv + 1} (+${curLv * 20}% hiệu lực)!`,
    };
  };

  const handleSweepStage = (stage: StageDef): string => {
    const enemy = getPetById(stage.enemyPetId);
    setProgress((prev) => {
      let nextLv = prev.level;
      let nextExp = prev.exp + stage.rewards.exp;
      while (nextExp >= nextLv * 500) {
        nextExp -= nextLv * 500;
        nextLv++;
      }
      const bag = [...(prev.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
      bag[1] += 1;
      const shards = { ...(prev.petShards ?? {}) };
      shards[stage.enemyPetId] = (shards[stage.enemyPetId] ?? 0) + 10;
      return {
        ...prev,
        level: nextLv,
        exp: nextExp,
        gold: prev.gold + stage.rewards.gold,
        stones: prev.stones + stage.rewards.stones,
        stoneBag: bag,
        petShards: shards,
        wins: prev.wins + 1,
      };
    });
    return `⚡ Càn Quét ${stage.islandName}: +${stage.rewards.gold} Vàng, +${stage.rewards.exp} EXP, +${stage.rewards.stones} Đá & +10 Mảnh ${enemy.name}!`;
  };

  const handleClaimCheckin = (day: number): string => {
    setProgress((prev) => {
      const claimed = prev.claimedCheckinDays ?? [];
      if (claimed.includes(day)) return prev;
      const bag = [...(prev.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
      const shards = { ...(prev.petShards ?? {}) };
      const unlocked = [...(prev.unlockedPets ?? [prev.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'])];
      const petLevels = { ...prev.petLevels };
      let gold = prev.gold;
      if (day === 1) gold += 800;
      if (day === 2) bag[2] += 4;
      if (day === 3) bag[2] += 3;
      if (day === 4) shards['pet-mega-zidarose'] = (shards['pet-mega-zidarose'] ?? 0) + 15;
      if (day === 5) bag[3] += 3;
      if (day === 6) gold += 2000;
      if (day === 7) {
        if (!unlocked.includes('pet-1503')) {
          unlocked.push('pet-1503');
          petLevels['pet-1503'] = petLevels['pet-1503'] ?? 1;
        } else {
          shards['pet-1503'] = (shards['pet-1503'] ?? 0) + 30;
        }
      }
      return {
        ...prev,
        gold,
        stoneBag: bag,
        petShards: shards,
        unlockedPets: unlocked,
        petLevels,
        claimedCheckinDays: [...claimed, day],
      };
    });
    return `📅 Đã nhận quà Điểm Danh Ngày ${day} thành công!`;
  };

  const handleRedeemGiftcode = (rawCode: string): { success: boolean; message: string } => {
    const code = rawCode.trim().toUpperCase();
    const used = progress.redeemedCodes ?? [];
    if (used.includes(code)) {
      return { success: false, message: `Mã Giftcode ${code} đã được sử dụng rồi!` };
    }
    if (!['POKIWAR40', 'ZINGME', 'FULLPET', 'VIP999'].includes(code)) {
      return {
        success: false,
        message: 'Mã Giftcode không hợp lệ! Hãy thử: POKIWAR40, ZINGME, FULLPET, VIP999',
      };
    }

    setProgress((prev) => {
      const prevUsed = prev.redeemedCodes ?? [];
      if (prevUsed.includes(code)) return prev;
      const bag = [...(prev.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
      const shards = { ...(prev.petShards ?? {}) };
      const unlocked = [...(prev.unlockedPets ?? [prev.selectedPetId, 'pet-581', 'pet-583', 'pet-1431', 'pet-725'])];
      const petLevels = { ...prev.petLevels };
      let gold = prev.gold;
      let stones = prev.stones;
      let gloryCoins = prev.gloryCoins ?? 0;
      let genCores = prev.genCores ?? 0;

      if (code === 'POKIWAR40') {
        gold += 5000;
        stones += 50;
        gloryCoins += 500;
        genCores += 5;
        bag[2] += 5;
        bag[3] += 3;
        shards['pet-mega-zidarose'] = (shards['pet-mega-zidarose'] ?? 0) + 30;
      } else if (code === 'ZINGME') {
        gold += 3000;
        gloryCoins += 300;
        bag[3] += 4;
        bag[4] += 2;
        if (!unlocked.includes('pet-1461')) {
          unlocked.push('pet-1461');
          petLevels['pet-1461'] = petLevels['pet-1461'] ?? 1;
        }
      } else if (code === 'VIP999') {
        gold += 10000;
        stones += 100;
        gloryCoins += 2000;
        genCores += 15;
        bag[3] += 6;
        bag[4] += 4;
      } else if (code === 'FULLPET') {
        for (const p of STARTER_PETS) {
          if (!unlocked.includes(p.id)) {
            unlocked.push(p.id);
          }
          petLevels[p.id] = Math.min(MAX_PET_LEVEL, Math.max(petLevels[p.id] ?? 1, 10));
        }
      }

      return {
        ...prev,
        gold,
        stones,
        gloryCoins,
        genCores,
        stoneBag: bag,
        petShards: shards,
        unlockedPets: unlocked,
        petLevels,
        redeemedCodes: [...prevUsed, code],
      };
    });

    const msgMap: Record<string, string> = {
      POKIWAR40: '🎁 Đổi POKIWAR40: +5,000 Vàng, +50 Đá, +500 Xu Vinh Quang, +5 Gen T2 & +30 Mảnh Mega Zidarose!',
      ZINGME: '🎁 Đổi ZINGME: +3,000 Vàng, +300 Xu Vinh Quang, +4 Đá C4, +2 Đá C5 & Mở khóa Cửu Vĩ Thiên Hồ!',
      VIP999: '🎁 Đổi VIP999: +10,000 Vàng, +100 Đá, +2,000 Xu Vinh Quang, +15 Gen T2 & Đá C4-C5!',
      FULLPET: `🎁 Đổi FULLPET: Mở khóa toàn bộ ${STARTER_PETS.length}/${STARTER_PETS.length} Pet Độc Lập Pokiwar 4.0 (Tối thiểu Lv.10)!`,
    };
    return { success: true, message: msgMap[code] };
  };

  const handleReforgeSlot = (slot: EquipmentSlot): { success: boolean; message: string } => {
    const goldCost = 450;
    const stoneCost = 4;
    if (progress.gold < goldCost || progress.stones < stoneCost) {
      return { success: false, message: `Cần ${goldCost} Vàng và ${stoneCost} Đá để Tẩy Luyện Trang Bị!` };
    }
    const r = Math.random();
    let rolled: ReforgeBonus;
    if (r < 0.15) {
      rolled = {
        grade: 'MYTHIC',
        hp: 260 + Math.floor(Math.random() * 140),
        atk: 38 + Math.floor(Math.random() * 20),
        def: 26 + Math.floor(Math.random() * 16),
        spd: 14 + Math.floor(Math.random() * 9),
      };
      const txt = `🔮 ${progress.name} vừa Tẩy Luyện trúng dòng THẦN THOẠI ★ (+${rolled.hp} HP, +${rolled.atk} Công)!`;
      setServerAnnounceText(txt);
    } else if (r < 0.48) {
      rolled = {
        grade: 'EPIC',
        hp: 150 + Math.floor(Math.random() * 90),
        atk: 22 + Math.floor(Math.random() * 14),
        def: 15 + Math.floor(Math.random() * 10),
        spd: 8 + Math.floor(Math.random() * 6),
      };
    } else {
      rolled = {
        grade: 'RARE',
        hp: 80 + Math.floor(Math.random() * 60),
        atk: 12 + Math.floor(Math.random() * 9),
        def: 8 + Math.floor(Math.random() * 7),
        spd: 4 + Math.floor(Math.random() * 4),
      };
    }
    setProgress((p) => ({
      ...p,
      gold: p.gold - goldCost,
      stones: p.stones - stoneCost,
      equipmentReforges: {
        ...(p.equipmentReforges ?? {}),
        [slot]: rolled,
      },
    }));
    const gradeLabel = rolled.grade === 'MYTHIC' ? 'THẦN THOẠI ★' : rolled.grade === 'EPIC' ? 'SỬ THI' : 'HIẾM';
    return {
      success: true,
      message: `🔮 Tẩy Luyện ra phẩm ${gradeLabel}: +${rolled.hp} HP, +${rolled.atk} Công, +${rolled.def} Thủ, +${rolled.spd} Tốc!`,
    };
  };

  const handleClaimPyramidReward = (payload: {
    goldCost: number;
    goldGain?: number;
    gloryGain?: number;
    genGain?: number;
    stoneLv4Gain?: number;
    petId?: string;
    shardGain?: number;
    isJackpot?: boolean;
  }): { success: boolean; message: string } => {
    if (progress.gold < payload.goldCost) {
      return { success: false, message: `Không đủ ${payload.goldCost} Vàng để khai quật!` };
    }
    setProgress((p) => {
      const bag = [...(p.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
      bag[3] = (bag[3] ?? 0) + (payload.stoneLv4Gain ?? 0);
      const shards = { ...(p.petShards ?? {}) };
      if (payload.petId && payload.shardGain) {
        shards[payload.petId] = (shards[payload.petId] ?? 0) + payload.shardGain;
      }
      return {
        ...p,
        gold: p.gold - payload.goldCost + (payload.goldGain ?? 0),
        gloryCoins: (p.gloryCoins ?? 0) + (payload.gloryGain ?? 0),
        genCores: (p.genCores ?? 0) + (payload.genGain ?? 0),
        stoneBag: bag,
        petShards: shards,
      };
    });
    const petName = payload.petId ? getPetById(payload.petId).name : 'Pet Hiếm';
    if (payload.isJackpot) {
      setServerAnnounceText(`🔺 ${progress.name} chạm ĐỈNH KIM TỰ THÁP nhận JACKPOT +${payload.shardGain} Mảnh ${petName} & +${payload.genGain} Gen T2!`);
      return {
        success: true,
        message: `🏆 JACKPOT ĐỈNH KIM TỰ THÁP: +${payload.goldGain}V, +${payload.gloryGain} Xu, +${payload.genGain} Gen T2 & +${payload.shardGain} Mảnh ${petName}!`,
      };
    }
    return {
      success: true,
      message: `🔺 Nhận +${payload.goldGain ?? 0}V, +${payload.gloryGain ?? 0} Xu, +${payload.genGain ?? 0} Gen T2 & +${payload.shardGain ?? 0} Mảnh ${petName}!`,
    };
  };

  const handleBuyMysteryOffer = (offer: MysteryShopOffer): { success: boolean; message: string } => {
    if (progress.gold < offer.finalGold) {
      return { success: false, message: `Không đủ ${offer.finalGold.toLocaleString()} Vàng!` };
    }
    setProgress((p) => {
      const bag = [...(p.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
      const shards = { ...(p.petShards ?? {}) };
      let genCores = p.genCores ?? 0;
      if (offer.kind === 'SHARD' && offer.petId) {
        shards[offer.petId] = (shards[offer.petId] ?? 0) + offer.amount;
      } else if (offer.kind === 'STONE_LV4') {
        bag[3] = (bag[3] ?? 0) + offer.amount;
      } else if (offer.kind === 'GEN_CORE') {
        genCores += offer.amount;
      } else if (offer.kind === 'STONE_LV5') {
        bag[4] = (bag[4] ?? 0) + offer.amount;
      }
      return {
        ...p,
        gold: p.gold - offer.finalGold,
        genCores,
        stoneBag: bag,
        petShards: shards,
      };
    });
    return { success: true, message: `🏪 Mua thành công ${offer.name} (Sale -${offer.discountPct}%)!` };
  };

  const handleRefreshMystery = (goldCost: number): boolean => {
    if (progress.gold < goldCost) return false;
    setProgress((p) => ({ ...p, gold: p.gold - goldCost }));
    return true;
  };

  const handleSpinLegendWheel = (
    count: 1 | 5,
  ): { success: boolean; results: { label: string; icon: string; rarity: 'EPIC' | 'LEGENDARY' }[]; message: string } => {
    const goldCost = count === 5 ? 2500 : 600;
    const gloryCost = count === 5 ? 220 : 50;
    if (progress.gold < goldCost || (progress.gloryCoins ?? 0) < gloryCost) {
      return {
        success: false,
        results: [],
        message: `Cần ${goldCost.toLocaleString()} Vàng & ${gloryCost} Xu Vinh Quang để quay!`,
      };
    }
    const jackpotPool = STARTER_PETS.filter(
      (p) => p.tier === 'GALAXY' || p.tier === 'FANTASY' || p.tier === 'ANCIENT' || p.tier === 'MEGA',
    );
    const startCount = progress.legendSpinCount ?? 0;
    const results: { label: string; icon: string; rarity: 'EPIC' | 'LEGENDARY' }[] = [];
    const shardAdds: Record<string, number> = {};
    const unlockedAdds: string[] = [];
    let extraGen = 0;
    let extraStone4 = 0;
    let extraStone5 = 0;
    let jackpotName: string | null = null;

    for (let i = 1; i <= count; i++) {
      const spinNum = startCount + i;
      const isPityJackpot = spinNum % 10 === 0 || Math.random() < 0.12;
      if (isPityJackpot) {
        const picked = jackpotPool[Math.floor(Math.random() * jackpotPool.length)] ?? STARTER_PETS[0];
        jackpotName = picked.name;
        unlockedAdds.push(picked.id);
        shardAdds[picked.id] = (shardAdds[picked.id] ?? 0) + 25;
        results.push({
          label: `👑 JACKPOT: ${picked.name} (+25 Mảnh)`,
          icon: getPetSpritePath(picked),
          rarity: 'LEGENDARY',
        });
      } else {
        const roll = Math.random();
        if (roll < 0.4) {
          const picked = jackpotPool[Math.floor(Math.random() * jackpotPool.length)] ?? STARTER_PETS[0];
          shardAdds[picked.id] = (shardAdds[picked.id] ?? 0) + 12;
          results.push({ label: `+12 Mảnh ${picked.name}`, icon: getPetSpritePath(picked), rarity: 'EPIC' });
        } else if (roll < 0.7) {
          extraGen += 4;
          results.push({ label: '+4 Tinh Thể Gen T2', icon: '/assets/pokiguard/sprites/crystal.png', rarity: 'EPIC' });
        } else if (roll < 0.88) {
          extraStone5 += 2;
          results.push({ label: '+2 Đá Nâng Cấp C5', icon: '/assets/pokiguard/sprites/stone_m_5.png', rarity: 'EPIC' });
        } else {
          extraStone4 += 3;
          results.push({ label: '+3 Đá Nâng Cấp C4', icon: '/assets/pokiguard/sprites/stone_m_4.png', rarity: 'EPIC' });
        }
      }
    }

    setProgress((p) => {
      const bag = [...(p.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
      bag[3] = (bag[3] ?? 0) + extraStone4;
      bag[4] = (bag[4] ?? 0) + extraStone5;
      const shards = { ...(p.petShards ?? {}) };
      for (const [pid, amt] of Object.entries(shardAdds)) {
        shards[pid] = (shards[pid] ?? 0) + amt;
      }
      const unlocked = [...(p.unlockedPets ?? [p.selectedPetId])];
      const petLevels = { ...p.petLevels };
      for (const pid of unlockedAdds) {
        if (!unlocked.includes(pid)) {
          unlocked.push(pid);
          petLevels[pid] = petLevels[pid] ?? 1;
        }
      }
      return {
        ...p,
        gold: p.gold - goldCost,
        gloryCoins: (p.gloryCoins ?? 0) - gloryCost,
        genCores: (p.genCores ?? 0) + extraGen,
        stoneBag: bag,
        petShards: shards,
        unlockedPets: unlocked,
        petLevels,
        legendSpinCount: (p.legendSpinCount ?? 0) + count,
      };
    });

    if (jackpotName) {
      setServerAnnounceText(`🎡 ${progress.name} quay Vòng Quay Huyền Thoại trúng JACKPOT Pet ${jackpotName}!`);
    }
    return {
      success: true,
      results,
      message: jackpotName
        ? `👑 NỔ HŨ HUYỀN THOẠI! Sở hữu ${jackpotName} cùng toàn bộ vật phẩm cực hiếm!`
        : `🎡 Đã quay x${count} Vòng Quay Huyền Thoại thành công!`,
    };
  };

  const handleClaimAchievement = (ach: AchievementDef): { success: boolean; message: string } => {
    const claimed = progress.claimedAchievements ?? [];
    if (claimed.includes(ach.id)) {
      return { success: false, message: 'Thành tựu này đã được nhận thưởng!' };
    }
    if (ach.getValue(progress) < ach.target) {
      return { success: false, message: 'Chưa đủ điều kiện hoàn thành Thành Tựu!' };
    }
    setProgress((p) => {
      const prevClaimed = p.claimedAchievements ?? [];
      if (prevClaimed.includes(ach.id)) return p;
      return {
        ...p,
        gold: p.gold + ach.rewardGold,
        gloryCoins: (p.gloryCoins ?? 0) + ach.rewardGlory,
        genCores: (p.genCores ?? 0) + ach.rewardGen,
        claimedAchievements: [...prevClaimed, ach.id],
      };
    });
    return {
      success: true,
      message: `🏅 Nhận Thành Tựu "${ach.title}": +${ach.rewardGold.toLocaleString()}V, +${ach.rewardGlory} Xu & +${ach.rewardGen} Gen T2!`,
    };
  };

  const handleBreakthroughPet = (petId: string): { success: boolean; message: string } => {
    const curBt = Math.max(0, Math.min(5, progress.petBreakthroughs?.[petId] ?? 0));
    if (curBt >= 5) return { success: false, message: 'Pet này đã đạt Đột Phá tối đa (+5)!' };
    const nextBt = curBt + 1;
    const goldCost = PET_BREAKTHROUGH_GOLD_COSTS[nextBt];
    const genCost = PET_BREAKTHROUGH_GEN_COSTS[nextBt];
    const shardCost = PET_BREAKTHROUGH_SHARD_COSTS[nextBt];
    const haveShards = progress.petShards?.[petId] ?? 0;
    const haveGen = progress.genCores ?? 0;
    if (progress.gold < goldCost || haveGen < genCost || haveShards < shardCost) {
      return {
        success: false,
        message: `Cần ${shardCost} Mảnh, ${genCost} Gen T2 & ${goldCost.toLocaleString()} Vàng để Đột Phá +${nextBt}!`,
      };
    }
    const petName = getPetById(petId).name;
    setProgress((p) => ({
      ...p,
      gold: p.gold - goldCost,
      genCores: (p.genCores ?? 0) - genCost,
      petShards: { ...(p.petShards ?? {}), [petId]: Math.max(0, (p.petShards?.[petId] ?? 0) - shardCost) },
      petBreakthroughs: { ...(p.petBreakthroughs ?? {}), [petId]: nextBt },
    }));
    broadcastAnnounce(`⚡ ${progress.name} ĐỘT PHÁ thành công ${petName} lên +${nextBt} (+${nextBt * 12}% Toàn Chỉ Số)!`);
    return {
      success: true,
      message: `⚡ ĐỘT PHÁ THÀNH CÔNG ${petName} +${nextBt} (+12% HP/Công/Phép/Thủ & +5 Tốc)!`,
    };
  };

  const handleSetFusionPet = (petId: string | null) => {
    setProgress((p) => ({ ...p, fusionPetId: petId }));
  };

  const handleStartExpeditionBoss = (boss: ExpeditionBossDef, stage: StageDef) => {
    handleStartPve(stage, 0, false, { expeditionBossId: boss.id });
  };

  const handleClaimExpeditionChest = (boss: ExpeditionBossDef): { success: boolean; message: string } => {
    if (!(progress.expeditionCleared ?? []).includes(boss.id)) {
      return { success: false, message: 'Hãy đánh bại Boss Viễn Chinh này trước!' };
    }
    if ((progress.expeditionClaimedChests ?? []).includes(boss.id)) {
      return { success: false, message: 'Rương Chiến Thắng này đã được mở!' };
    }
    const rewardPet = getPetById(boss.rewardPetId);
    setProgress((p) => {
      const shards = { ...(p.petShards ?? {}) };
      shards[boss.rewardPetId] = (shards[boss.rewardPetId] ?? 0) + boss.rewardShards;
      const bag = [...(p.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
      bag[4] = (bag[4] ?? 0) + 2;
      return {
        ...p,
        gold: p.gold + boss.rewardGold,
        genCores: (p.genCores ?? 0) + boss.rewardGen,
        stoneBag: bag,
        petShards: shards,
        expeditionClaimedChests: [...(p.expeditionClaimedChests ?? []), boss.id],
      };
    });
    return {
      success: true,
      message: `🎁 Mở Rương Chiến Thắng ${boss.name}: +${boss.rewardGold.toLocaleString()}V, +${boss.rewardGen} Gen T2, +2 Đá C5 & +${boss.rewardShards} Mảnh ${rewardPet.name}!`,
    };
  };

  const handleResetExpeditionSeason = (): { success: boolean; message: string } => {
    setProgress((p) => ({
      ...p,
      expeditionCleared: [],
      expeditionClaimedChests: [],
      expeditionLockedPets: [],
    }));
    return { success: true, message: '🔄 Đã mở Mùa Ải Viễn Chinh mới — toàn bộ Pet đã được gỡ khóa!' };
  };

  const handleStartTreasureGuard = (kind: 'ARCHON' | 'STORM', stage: StageDef) => {
    if ((progress.treasureIslandAttempts ?? 0) >= 10) return;
    setProgress((p) => ({ ...p, treasureIslandAttempts: (p.treasureIslandAttempts ?? 0) + 1 }));
    handleStartPve(stage, 0, false, { restrictedRules: true, treasureGuardKind: kind });
  };

  const handleClaimTreasureChest = (chest: 'SILVER' | 'GOLD'): { success: boolean; message: string } => {
    const claimed = progress.treasureClaimedChests ?? [];
    if (claimed.includes(chest)) return { success: false, message: 'Rương này đã được mở rồi!' };
    if (chest === 'SILVER' && (progress.treasureArchonKills ?? 0) < 3) {
      return { success: false, message: 'Cần hạ 3 lần Lính Canh Archon@ để mở Rương Bạc!' };
    }
    if (chest === 'GOLD' && (progress.treasureStormKills ?? 0) < 5) {
      return { success: false, message: 'Cần hạ 5 lần Lính Canh Storm Soul@ để mở Rương Vàng!' };
    }
    setProgress((p) => {
      const shards = { ...(p.petShards ?? {}) };
      if (chest === 'SILVER') {
        shards['pet-mega-icarus'] = (shards['pet-mega-icarus'] ?? 0) + 20;
      } else {
        shards['pet-galaxy-shadow-sword'] = (shards['pet-galaxy-shadow-sword'] ?? 0) + 25;
      }
      return {
        ...p,
        gold: p.gold + (chest === 'SILVER' ? 3000 : 6000),
        genCores: (p.genCores ?? 0) + (chest === 'SILVER' ? 4 : 8),
        petShards: shards,
        treasureClaimedChests: [...(p.treasureClaimedChests ?? []), chest],
      };
    });
    return {
      success: true,
      message:
        chest === 'SILVER'
          ? '🥈 Mở Rương Bạc Đảo Châu Báu: +3,000V, +4 Gen T2 & +20 Mảnh Mega Icarus!'
          : '🥇 Mở Rương Vàng Đảo Châu Báu: +6,000V, +8 Gen T2 & +25 Mảnh Galaxy Shadow Sword!',
    };
  };

  const handleSaveAncientPreset = (presetIdx: number, grid: (string | null)[]) => {
    setProgress((p) => {
      const cur = p.ancientPresets
        ? [...p.ancientPresets]
        : [Array(9).fill(null), Array(9).fill(null), Array(9).fill(null)];
      cur[presetIdx] = grid;
      return { ...p, ancientPresets: cur };
    });
  };

  const handleFinishAncientMatch = (
    won: boolean,
    glory: number,
    gold: number,
    eloDelta: number,
    opponentName: string,
  ) => {
    setProgress((p) => ({
      ...p,
      gold: p.gold + gold,
      gloryCoins: (p.gloryCoins ?? 0) + glory,
      ancientArenaElo: Math.max(800, (p.ancientArenaElo ?? 1100) + eloDelta),
      ancientArenaTurns: (p.ancientArenaTurns ?? 0) + 1,
      wins: won ? p.wins + 1 : p.wins,
    }));
    if (won) {
      broadcastAnnounce(`🏛️ ${progress.name} đánh bại ${opponentName} tại Đấu Trường Cổ Đại 3×3 (+${eloDelta} ELO)!`);
    }
  };

  const handleAuthenticated = (session: AuthSessionPayload) => {
    setAuthSession(session);
    try {
      if (session.token) {
        sessionStorage.setItem(SESSION_TOKEN_KEY, session.token);
      } else {
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }
    } catch {
      // ignore
    }
    if (session.progress) {
      setProgress(normalizeProgress(session.progress));
    } else if (session.displayName) {
      setProgress((prev) => ({ ...prev, name: session.displayName }));
    }
    setScreen('LOBBY');
  };

  const handleLogout = () => {
    if (authSession?.token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authSession.token}` },
      }).catch(() => {});
    }
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {
      // ignore
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setAuthSession(null);
    setBattleState(null);
    setActiveStage(null);
    setScreen('LOGIN');
  };

  return (
    <div className="viewport-root">
      <div className="game-stage-16x9" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {screen === 'BATTLE' && (
          <div
            className="hud-telemetry"
            style={{
              top: 66,
              left: 12,
              right: 'auto',
              zIndex: 25,
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              opacity: 0.92,
              fontSize: 11.5,
              fontWeight: 900,
              color: '#f8fafc',
              textShadow: '0 1.5px 3px #000',
              padding: 0,
            }}
          >
            Ping: {pingMs ?? (battleMode === 'PVP' ? '...' : 12)} ms | FPS: {fps}
          </div>
        )}

        {screen === 'LOGIN' && (
          <LoginScreen serverOnline={serverOnline} onAuthenticated={handleAuthenticated} />
        )}

        {screen === 'LOBBY' && (
          <MainLobby
            progress={progress}
            accountLabel={
              authSession
                ? `${authSession.isGuest ? 'Khách' : authSession.username} (${authSession.serverId})`
                : null
            }
            pvpStatus={pvpStatus}
            roomCode={roomCode}
            pvpError={pvpError}
            bgmPlaying={bgmPlaying}
            muted={muted}
            onlineSeconds={onlineSeconds}
            chatMessages={chatMessages}
            serverAnnounceText={serverAnnounceText}
            onSendChat={handleSendChat}
            onToggleBgm={() => setBgmPlaying(sfx.toggleBgm())}
            onToggleMute={() => {
              sfx.setMuted(!muted);
              setMuted(!muted);
            }}
            onLogout={handleLogout}
            onChangeName={(name) => setProgress((p) => ({ ...p, name }))}
            onChangeAvatar={(avatarId) => setProgress((p) => ({ ...p, avatarId }))}
            onUnlockAvatar={(avatarId, costGold) =>
              setProgress((p) => {
                const unlocked = p.unlockedAvatars ?? ['29'];
                if (unlocked.includes(avatarId)) return { ...p, avatarId };
                if (p.gold < costGold) return p;
                return {
                  ...p,
                  gold: p.gold - costGold,
                  avatarId,
                  unlockedAvatars: [...unlocked, avatarId],
                };
              })
            }
            onOpenPetUpgrade={(tab = 'UPGRADE') => {
              setPetModalTab(tab);
              setScreen('UPGRADE');
            }}
            onStartPve={handleStartPve}
            onSweepStage={handleSweepStage}
            onChangeSupportLoadout={handleChangeSupportLoadout}
            onUpgradeSupportCard={handleUpgradeSupportCard}
            onClaimCheckin={handleClaimCheckin}
            onRedeemGiftcode={handleRedeemGiftcode}
            onSaveKingTeam={handleSaveKingTeam}
            onFinishKingMatch={handleFinishKingMatch}
            onBuyGloryItem={handleBuyGloryItem}
            onOpenChest={handleOpenChest}
            onBuyOrEquipAura={handleBuyOrEquipAura}
            onSetGuardPet={handleSetGuardPet}
            onSetFusionPet={handleSetFusionPet}
            onBuyOrEquipItem={handleBuyOrEquipItem}
            onBreakthrough={handleBreakthrough}
            onReforgeSlot={handleReforgeSlot}
            onStartExpeditionBoss={handleStartExpeditionBoss}
            onClaimExpeditionChest={handleClaimExpeditionChest}
            onResetExpeditionSeason={handleResetExpeditionSeason}
            onStartTreasureGuard={handleStartTreasureGuard}
            onClaimTreasureChest={handleClaimTreasureChest}
            onSaveAncientPreset={handleSaveAncientPreset}
            onFinishAncientMatch={handleFinishAncientMatch}
            onClaimPyramidReward={handleClaimPyramidReward}
            onBuyMysteryOffer={handleBuyMysteryOffer}
            onRefreshMystery={handleRefreshMystery}
            onSpinLegendWheel={handleSpinLegendWheel}
            onClaimAchievement={handleClaimAchievement}
            onGuildDonate={handleGuildDonate}
            onFightGuildBoss={handleFightGuildBoss}
            onGuild3v3Win={handleGuild3v3Win}
            onFinishSpaceTrip={handleFinishSpaceTrip}
            onClaimOnlineReward={handleClaimOnlineReward}
            onClaimMail={handleClaimMail}
            onJoinOrRenameGuild={handleJoinOrRenameGuild}
            onQuickMatch={handleQuickMatch}
            onCancelQueue={handleCancelQueue}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onBuyStones={(amount, cost) =>
              setProgress((p) =>
                p.gold >= cost ? { ...p, gold: p.gold - cost, stones: p.stones + amount } : p,
              )
            }
            onBuyStoneLv={(lvIdx, count, costGold) =>
              setProgress((p) => {
                if (p.gold < costGold) return p;
                const bag = [...(p.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
                bag[lvIdx] = (bag[lvIdx] ?? 0) + count;
                return { ...p, gold: p.gold - costGold, stoneBag: bag };
              })
            }
            onSpinWheel={(prize: WheelPrizeDef, goldCost: number) =>
              setProgress((p) => {
                if (p.gold < goldCost) return p;
                const bag = [...(p.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
                let gold = p.gold - goldCost;
                if (prize.kind === 'GOLD') gold += prize.amount;
                if (prize.kind === 'STONE_LV2') bag[1] += prize.amount;
                if (prize.kind === 'STONE_LV3') bag[2] += prize.amount;
                if (prize.kind === 'STONE_LV4') bag[3] += prize.amount;
                if (prize.kind === 'STONE_LV5') bag[4] += prize.amount;
                return {
                  ...p,
                  gold,
                  stoneBag: bag,
                  wheelSpunCount: (p.wheelSpunCount ?? 0) + 1,
                };
              })
            }
            onSpinWheelBatch={(prizes: WheelPrizeDef[], goldCost: number) =>
              setProgress((p) => {
                if (p.gold < goldCost) return p;
                const bag = [...(p.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
                const shards = { ...(p.petShards ?? {}) };
                let gold = p.gold - goldCost;
                const prevSpuns = p.wheelSpunCount ?? 0;
                const nextSpuns = prevSpuns + prizes.length;
                for (const prize of prizes) {
                  if (prize.kind === 'GOLD') gold += prize.amount;
                  if (prize.kind === 'STONE_LV2') bag[1] += prize.amount;
                  if (prize.kind === 'STONE_LV3') bag[2] += prize.amount;
                  if (prize.kind === 'STONE_LV4') bag[3] += prize.amount;
                  if (prize.kind === 'STONE_LV5') bag[4] += prize.amount;
                }
                if (Math.floor(nextSpuns / 30) > Math.floor(prevSpuns / 30)) {
                  shards['pet-mega-zidarose'] = (shards['pet-mega-zidarose'] ?? 0) + 15;
                }
                return {
                  ...p,
                  gold,
                  stoneBag: bag,
                  petShards: shards,
                  wheelSpunCount: nextSpuns,
                };
              })
            }
            onSmashEgg={(drops: EggDropItem[], goldCost: number, stoneCost: number) =>
              setProgress((p) => {
                if (p.gold < goldCost || p.stones < stoneCost) return p;
                const bag = [...(p.stoneBag ?? [8, 4, 2, 1, 0])] as [number, number, number, number, number];
                const shards = { ...(p.petShards ?? {}) };
                const unlocked = [...(p.unlockedPets ?? [p.selectedPetId, 'pet-583', 'pet-1431', 'pet-725'])];
                const petLevels = { ...p.petLevels };
                let gold = p.gold - goldCost;
                for (const d of drops) {
                  if (d.kind === 'GOLD') gold += d.amount;
                  if (d.kind === 'STONE_LV2') bag[1] += d.amount;
                  if (d.kind === 'STONE_LV3') bag[2] += d.amount;
                  if (d.kind === 'STONE_LV4') bag[3] += d.amount;
                  if (d.kind === 'STONE_LV5') bag[4] += d.amount;
                  if (d.kind === 'SHARD' && d.petId) {
                    shards[d.petId] = (shards[d.petId] ?? 0) + d.amount;
                  }
                  if (d.kind === 'PET' && d.petId) {
                    if (unlocked.includes(d.petId)) {
                      shards[d.petId] = (shards[d.petId] ?? 0) + 15;
                    } else {
                      unlocked.push(d.petId);
                      petLevels[d.petId] = petLevels[d.petId] ?? 1;
                    }
                  }
                }
                return {
                  ...p,
                  gold,
                  stones: p.stones - stoneCost,
                  stoneBag: bag,
                  petShards: shards,
                  unlockedPets: unlocked,
                  petLevels,
                  eggSmashCount: (p.eggSmashCount ?? 0) + drops.length,
                };
              })
            }
            onClaimEggMilestone={(milestone: number, petId: string, shardAmount: number, goldReward: number) =>
              setProgress((p) => {
                const claimed = p.claimedEggMilestones ?? [];
                if (claimed.includes(milestone) || (p.eggSmashCount ?? 0) < milestone) return p;
                const shards = { ...(p.petShards ?? {}) };
                shards[petId] = (shards[petId] ?? 0) + shardAmount;
                return {
                  ...p,
                  gold: p.gold + goldReward,
                  petShards: shards,
                  claimedEggMilestones: [...claimed, milestone],
                };
              })
            }
            onClaimMission={(id, goldReward, stoneReward) =>
              setProgress((p) =>
                p.claimedMissions.includes(id)
                  ? p
                  : {
                      ...p,
                      gold: p.gold + goldReward,
                      stones: p.stones + stoneReward,
                      claimedMissions: [...p.claimedMissions, id],
                    },
              )
            }
          />
        )}

        {screen === 'UPGRADE' && (
          <PetUpgradeScreen
            progress={progress}
            initialTab={petModalTab}
            onBack={() => setScreen('LOBBY')}
            onSelectPet={(petId) => setProgress((p) => ({ ...p, selectedPetId: petId }))}
            onUpgradePet={handleUpgradePet}
            onEvolvePet={handleEvolvePet}
            onUpgradePetStar={handleUpgradePetStar}
            onUpgradePetGen={handleUpgradePetGen}
            onBreakthroughPet={handleBreakthroughPet}
            onSynthesizePet={handleSynthesizePet}
            onCombineStones={handleCombineStones}
            onUnlockPetWithShards={handleUnlockPetWithShards}
            onBuyPetUnlock={handleBuyPetUnlock}
          />
        )}

        {screen === 'BATTLE' && battleState && (
          <BattleScreen
            arenaBg={activeStage?.arenaBg ?? '/assets/pokiguard/sprites/bg_arena.png'}
            modeLabel={battleMode === 'PVP' ? 'ĐẤU TRƯỜNG PVP' : activeStage?.name ?? 'PHÓ BẢN PVE'}
            playerName={progress.name}
            playerAvatarId={progress.avatarId}
            isBossStage={Boolean(activeStage?.isBoss || activeStage?.mode === 'BOSS')}
            opponentName={opponentName}
            yourSide={yourSide}
            battleState={battleState}
            displayBoard={displayBoard}
            activeSwipe={activeSwipe}
            breakingGroup={breakingGroup}
            collectedGems={collectedGems}
            collectedCombo={collectedCombo}
            animatingTurn={animatingTurn}
            capturedNewPet={capturedNewPet}
            alreadyCapturedNote={alreadyCapturedNote}
            lastEvents={lastEvents}
            hintMove={hintMove}
            turnSecondsLeft={turnSecondsLeft}
            boardFaded={boardFaded}
            callout={callout}
            actionCue={actionCue}
            animCommand={animCommand}
            popups={popups}
            onSwap={handleSwap}
            onCastSkill={handleCastSkill}
            onInBattleEvolve={handleInBattleEvolve}
            onFusionStrike={handleFusionStrike}
            onSupportCard={handleSupportCard}
            onDefaultCast={handleDefaultCast}
            onPassTurn={handlePassTurn}
            onHint={handleHint}
            onLeave={handleLeaveBattle}
            onRetryPve={
              battleMode === 'PVE' && activeStage
                ? () =>
                    handleStartPve(activeStage, activeMercenaryCount, false, {
                      restrictedRules: battleState.restrictedRules,
                      fieldElement: battleState.fieldElement,
                      expeditionBossId: activeExpeditionBossId,
                      treasureGuardKind: activeTreasureGuardKind,
                    })
                : undefined
            }
            onOverlayPauseChange={setOverlayPaused}
            mercenaryCount={battleMode === 'PVE' ? activeMercenaryCount : 0}
            playerGold={progress.gold}
            battleSpeed={battleSpeed}
            onToggleSpeed={() => setBattleSpeed((s) => (s === 1 ? 2 : 1))}
            onClaimFlipReward={handleClaimFlipReward}
          />
        )}
      </div>
    </div>
  );
}
