import {
  ELEMENT_META,
  GEM_META,
  getAuraById,
  getPetById,
  getPetSpritePath,
  getSkillGemProgress,
  getSupportCardScaledLabel,
  MATCH_CONSTANTS,
  SUPPORT_CARDS,
  type BattleEvent,
  type BattleFighter,
  type BattleState,
  type BoardGrid,
  type GemType,
  type PetDef,
  type Pos,
  type QteGrade,
  type Side,
  type SkillDef,
  type SupportCardId,
} from '@pokiwar/shared';
import { useEffect, useRef, useState } from 'react';
import { BoardCanvas, type ActiveBreakGroupFx, type ActiveSwipeFx } from './BoardCanvas.js';
import { QteAuditionModal } from './QteAuditionModal.js';
import { SpineStageCanvas, type AnimCommand, type StageActionCue } from './SpineStageCanvas.js';

export interface FloatingPopup {
  id: number;
  side: Side;
  text: string;
  color: string;
  isBurst?: boolean;
}

export interface BattleCallout {
  text: string;
  gemType?: GemType;
  count?: number;
  combo?: number;
  skillCardImage?: string;
}

interface BattleScreenProps {
  arenaBg: string;
  modeLabel: string;
  playerName: string;
  playerAvatarId?: string;
  isBossStage?: boolean;
  opponentName: string;
  yourSide: Side;
  battleState: BattleState;
  displayBoard?: BoardGrid;
  activeSwipe?: ActiveSwipeFx | null;
  breakingGroup?: ActiveBreakGroupFx | null;
  collectedGems?: { gemType: GemType; count: number }[];
  collectedCombo?: number;
  animatingTurn?: boolean;
  capturedNewPet?: PetDef | null;
  alreadyCapturedNote?: boolean;
  lastEvents: BattleEvent[];
  hintMove: { from: Pos; to: Pos } | null;
  turnSecondsLeft: number | null;
  boardFaded: boolean;
  callout: BattleCallout | string | null;
  actionCue: StageActionCue | null;
  animCommand?: AnimCommand | null;
  popups: FloatingPopup[];
  onSwap: (from: Pos, to: Pos) => void;
  onCastSkill: (skillId: string, qteGrade?: QteGrade, selectedRows?: number[]) => void;
  onInBattleEvolve: () => void;
  onFusionStrike?: () => void;
  onSupportCard: (cardId: SupportCardId) => void;
  onDefaultCast: () => void;
  onPassTurn: () => void;
  onHint: () => void;
  onLeave: () => void;
  onRetryPve?: () => void;
  onOverlayPauseChange?: (paused: boolean) => void;
  mercenaryCount?: number;
  playerGold?: number;
  battleSpeed?: 1 | 2;
  onToggleSpeed?: () => void;
  onClaimFlipReward?: (reward: {
    kind: 'GOLD' | 'STONE' | 'SHARD';
    amount: number;
    stoneLv?: number;
    petId?: string;
    label: string;
    goldCost?: number;
  }) => void;
}

const EMOJI_IDS = ['happy', 'laugh', 'love', 'roar', 'angry', 'cry'] as const;
type EmojiId = (typeof EMOJI_IDS)[number];

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  BURN: { label: 'Thiêu Đốt', color: '#fb923c' },
  POISON: { label: 'Trúng Độc', color: '#c084fc' },
  STUN: { label: 'Choáng', color: '#fde047' },
  ATK_UP: { label: '+Tấn Công', color: '#f87171' },
  SHIELD_REGEN: { label: '+Hồi Giáp', color: '#7dd3fc' },
  DEEP_WOUND: { label: 'Vết Thương Sâu', color: '#f43f5e' },
  SILENCE: { label: 'Câm Lặng', color: '#a78bfa' },
  REFLECT: { label: 'Phản Đòn', color: '#38bdf8' },
};

function formatEventLine(ev: BattleEvent, state: BattleState, yourSide: Side): string | null {
  if (ev.type === 'MATCH_CLEAR') {
    const first = ev.groups[0];
    if (!first) return null;
    return `Ăn ${first.effectiveValue} điểm ${GEM_META[first.gemType].label}${ev.cascadeIndex > 1 ? ` (Combo x${ev.cascadeIndex})` : ''}`;
  }
  if (ev.type === 'SKILL_CAST') {
    const actor = state.fighters[ev.side].name;
    const qteSuffix = ev.qteGrade ? ` [${ev.qteGrade}]` : '';
    const noteSuffix = ev.specialNote ? ` — ${ev.specialNote}` : '';
    return `${actor} tung "${ev.skillName}"${qteSuffix}${noteSuffix}`;
  }
  if (ev.type === 'DEFAULT_CAST') {
    return `${state.fighters[ev.side].name} dùng Thẻ Chưởng (-${ev.damage} HP)`;
  }
  if (ev.type === 'IN_BATTLE_EVOLVE') {
    return `${state.fighters[ev.side].name} HÓA THẦN CUỒNG NỘ (+${ev.hpBonus} HP, +20% Công, không mất lượt)!`;
  }
  if (ev.type === 'SUPPORT_CARD_CAST') {
    const parts: string[] = [];
    if (ev.manaGain) parts.push(`+${ev.manaGain} Mana`);
    if (ev.rageGain) parts.push(`+${ev.rageGain} Nộ`);
    if (ev.heal) parts.push(`+${ev.heal} HP`);
    if (ev.shieldGain) parts.push(`+${ev.shieldGain} Giáp`);
    if (ev.damage) parts.push(`-${ev.damage} HP địch`);
    if (ev.appliedStatus === 'STUN') parts.push('Đóng Băng địch');
    if (ev.appliedStatus === 'ATK_UP') parts.push('+35% Công');
    return `${state.fighters[ev.side].name} dùng ${ev.cardName} (${parts.join(', ') || 'Free'})`;
  }
  if (ev.type === 'PASS_TURN') {
    const who = ev.side === yourSide ? 'Bạn' : 'Đối thủ';
    return ev.autoLost ? `${who} bỏ 3 lượt liên tiếp — Xử thua!` : `${who} bỏ lượt (${ev.consecutivePasses}/2)`;
  }
  if (ev.type === 'EXTRA_TURN') {
    const who = ev.side === yourSide ? 'Bạn' : 'Đối thủ';
    return `${who} nối 4+ viên — Thưởng thêm 1 lượt!`;
  }
  if (ev.type === 'STATUS_TICK' && ev.skippedTurn) {
    return `${state.fighters[ev.side].name} bị Choáng, mất lượt!`;
  }
  if (ev.type === 'REVIVE') {
    return `❤️ ${state.fighters[ev.side].name} KÍCH HOẠT HỒI SINH (+${ev.hpRestored} HP, còn ${ev.remainingCharges} Tim)!`;
  }
  if (ev.type === 'FUSION_STRIKE') {
    return `🤝 ${state.fighters[ev.side].name} + ${ev.partnerName} HỢP THỂ LIÊN KÍCH (-${ev.damage} HP, +${ev.heal} HP, +${ev.shieldGain} Giáp, Vết Thương Sâu)!`;
  }
  return null;
}

function renderStatusChips(fighter: BattleFighter) {
  const accum = fighter.accumStacks ?? 0;
  const bt = fighter.breakthroughLevel ?? 0;
  if (fighter.statuses.length === 0 && accum <= 0 && bt <= 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
      {bt > 0 && (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 900,
            padding: '1px 5px',
            borderRadius: 4,
            background: 'rgba(88, 28, 135, 0.9)',
            border: '1px solid #f472b6',
            color: '#fef08a',
          }}
        >
          ⚡ĐP+{bt}
        </span>
      )}
      {accum > 0 && (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 900,
            padding: '1px 5px',
            borderRadius: 4,
            background: 'rgba(124, 45, 18, 0.9)',
            border: '1px solid #fbbf24',
            color: '#fde047',
          }}
          title={`Tích Lũy Pokiwar 4.0: +${accum * 4}% Công & Phép (tăng khi nối 4+ ngọc)`}
        >
          🔥Tích Lũy ×{accum}
        </span>
      )}
      {fighter.statuses.map((st, idx) => {
        const meta = STATUS_BADGES[st.kind];
        return (
          <span
            key={`${st.kind}-${idx}`}
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: 4,
              background: 'rgba(2, 6, 23, 0.86)',
              border: `1px solid ${meta?.color ?? '#94a3b8'}`,
              color: meta?.color ?? '#e2e8f0',
            }}
          >
            {meta?.label ?? st.kind} ({st.remainingTurns})
          </span>
        );
      })}
    </div>
  );
}

export function BattleScreen({
  arenaBg,
  modeLabel,
  playerName,
  playerAvatarId = '29',
  isBossStage = false,
  opponentName,
  yourSide,
  battleState,
  displayBoard,
  activeSwipe = null,
  breakingGroup = null,
  collectedGems = [],
  collectedCombo = 0,
  animatingTurn = false,
  capturedNewPet = null,
  alreadyCapturedNote = false,
  lastEvents,
  hintMove,
  turnSecondsLeft,
  boardFaded,
  callout,
  actionCue,
  animCommand = null,
  popups,
  onSwap,
  onCastSkill,
  onInBattleEvolve,
  onFusionStrike,
  onSupportCard,
  onDefaultCast,
  onLeave,
  onRetryPve,
  onOverlayPauseChange,
  mercenaryCount,
  playerGold = 0,
  battleSpeed = 1,
  onToggleSpeed,
  onClaimFlipReward,
}: BattleScreenProps) {
  const enemySide: Side = yourSide === 'P1' ? 'P2' : 'P1';
  const myFighter = battleState.fighters[yourSide];
  const enemyFighter = battleState.fighters[enemySide];
  const isYourTurn = battleState.currentTurn === yourSide && !battleState.winner;

  const [pendingQteSkill, setPendingQteSkill] = useState<SkillDef | null>(null);
  const [pendingBurnSkill, setPendingBurnSkill] = useState<SkillDef | null>(null);
  const [pickedRows, setPickedRows] = useState<number[]>([]);
  const [confirmedBurnRows, setConfirmedBurnRows] = useState<number[] | undefined>(undefined);
  const [koFinished, setKoFinished] = useState(false);

  // Authentic Pokiwar Boss / Pet KO Cinema (1.65s defeat explosion + floating soul + coins before Victory modal!)
  useEffect(() => {
    if (!battleState.winner) {
      setKoFinished(false);
      return;
    }
    setKoFinished(false);
    const t = window.setTimeout(() => setKoFinished(true), 1650);
    return () => window.clearTimeout(t);
  }, [battleState.winner]);

  const defeatedSide: Side | null = battleState.winner
    ? battleState.winner === 'P1'
      ? 'P2'
      : 'P1'
    : null;

  // Emoji picker & speech bubbles
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [myEmoji, setMyEmoji] = useState<EmojiId | null>(null);
  const [enemyEmoji, setEnemyEmoji] = useState<EmojiId | null>(null);
  const emojiTimersRef = useRef<number[]>([]);

  // Post-victory 6-card Lật Thẻ May Mắn state
  interface FlipCardItem {
    id: number;
    kind: 'GOLD' | 'STONE' | 'SHARD';
    amount: number;
    stoneLv?: number;
    petId?: string;
    label: string;
    icon: string;
  }
  const [flipDeck, setFlipDeck] = useState<FlipCardItem[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);

  const overlayPaused = Boolean(pendingBurnSkill || pendingQteSkill);
  useEffect(() => {
    onOverlayPauseChange?.(overlayPaused);
    return () => onOverlayPauseChange?.(false);
  }, [overlayPaused, onOverlayPauseChange]);

  useEffect(() => {
    return () => {
      emojiTimersRef.current.forEach((t) => window.clearTimeout(t));
      emojiTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (battleState.winner === yourSide) {
      const targetPet = getPetById(enemyFighter.petId);
      const shardIcon = getPetSpritePath(targetPet, enemyFighter.tier);
      const rawPool: Omit<FlipCardItem, 'id'>[] = [
        { kind: 'SHARD', amount: 8, petId: targetPet.id, label: `+8 Mảnh ${targetPet.name}`, icon: shardIcon },
        { kind: 'GOLD', amount: 450, label: '+450 Vàng', icon: '/assets/pokiguard/sprites/gold.png' },
        { kind: 'STONE', amount: 2, stoneLv: 2, label: '+2 Đá Cấp 2', icon: '/assets/pokiguard/sprites/stone_f_2.png' },
        { kind: 'SHARD', amount: 5, petId: targetPet.id, label: `+5 Mảnh ${targetPet.name}`, icon: shardIcon },
        { kind: 'STONE', amount: 2, stoneLv: 3, label: '+2 Đá Cấp 3', icon: '/assets/pokiguard/sprites/stone_w_3.png' },
        { kind: 'GOLD', amount: 300, label: '+300 Vàng', icon: '/assets/pokiguard/sprites/gold.png' },
      ];
      // Deterministic Fisher-Yates shuffle based on battle rngState
      let s = Math.abs(battleState.rngState || 12345);
      for (let i = rawPool.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const j = s % (i + 1);
        const tmp = rawPool[i];
        rawPool[i] = rawPool[j];
        rawPool[j] = tmp;
      }
      setFlipDeck(rawPool.map((item, idx) => ({ ...item, id: idx })));
      setFlippedIndices([]);
    } else if (!battleState.winner) {
      setFlipDeck([]);
      setFlippedIndices([]);
    }
  }, [battleState.winner, yourSide, enemyFighter.petId, enemyFighter.tier, battleState.rngState]);

  const handleSendEmoji = (em: EmojiId) => {
    setMyEmoji(em);
    setShowEmojiPicker(false);
    const t1 = window.setTimeout(() => setMyEmoji(null), 3200);
    emojiTimersRef.current.push(t1);
    if (!battleState.winner) {
      const reactPool: EmojiId[] = em === 'angry' || em === 'roar' ? ['roar', 'laugh', 'angry'] : ['happy', 'laugh', 'love'];
      const reply = reactPool[Math.floor(Math.random() * reactPool.length)];
      const t2 = window.setTimeout(() => {
        setEnemyEmoji(reply);
        const t3 = window.setTimeout(() => setEnemyEmoji(null), 2600);
        emojiTimersRef.current.push(t3);
      }, 900);
      emojiTimersRef.current.push(t2);
    }
  };

  const handleFlipCard = (cardIdx: number) => {
    if (flippedIndices.includes(cardIdx)) return;
    if (flippedIndices.length >= 2) return;
    const cost = flippedIndices.length === 1 ? 150 : 0;
    if (cost > 0 && playerGold < cost) return;
    const card = flipDeck[cardIdx];
    if (!card) return;
    setFlippedIndices((prev) => [...prev, cardIdx]);
    onClaimFlipReward?.({
      kind: card.kind,
      amount: card.amount,
      stoneLv: card.stoneLv,
      petId: card.petId,
      label: card.label,
      goldCost: cost,
    });
  };

  const boardInteractive = isYourTurn && !boardFaded && !animatingTurn && !pendingQteSkill && !pendingBurnSkill;

  const [turnSplashKey, setTurnSplashKey] = useState(0);
  const prevTurnRef = useRef<{ turnNumber: number; currentTurn: Side } | null>(null);

  useEffect(() => {
    const prev = prevTurnRef.current;
    if (
      !prev ||
      prev.turnNumber !== battleState.turnNumber ||
      prev.currentTurn !== battleState.currentTurn
    ) {
      setPendingBurnSkill(null);
      setPickedRows([]);
      setConfirmedBurnRows(undefined);
      if (battleState.currentTurn === yourSide && !battleState.winner) {
        setTurnSplashKey((k) => k + 1);
      }
      prevTurnRef.current = {
        turnNumber: battleState.turnNumber,
        currentTurn: battleState.currentTurn,
      };
    }
  }, [battleState.turnNumber, battleState.currentTurn, battleState.winner, yourSide]);

  const myHpPct = Math.max(0, Math.min(100, (myFighter.hp / myFighter.maxHp) * 100));
  const myManaPct = Math.max(0, Math.min(100, (myFighter.mana / myFighter.maxMana) * 100));
  const myRagePct = Math.max(0, Math.min(100, (myFighter.rage / myFighter.maxRage) * 100));

  const enemyHpPct = Math.max(0, Math.min(100, (enemyFighter.hp / enemyFighter.maxHp) * 100));
  const enemyManaPct = Math.max(0, Math.min(100, (enemyFighter.mana / enemyFighter.maxMana) * 100));
  const enemyRagePct = Math.max(0, Math.min(100, (enemyFighter.rage / enemyFighter.maxRage) * 100));

  const parsedCallout: BattleCallout | null =
    typeof callout === 'string' ? { text: callout } : callout;

  const recentLogs = lastEvents
    .map((ev) => formatEventLine(ev, battleState, yourSide))
    .filter((line): line is string => Boolean(line))
    .slice(0, 3);

  const evolveUnlocked = battleState.turnNumber >= 2;
  const canInBattleEvolve =
    boardInteractive &&
    evolveUnlocked &&
    !myFighter.inBattleEvolved &&
    myFighter.mana >= MATCH_CONSTANTS.FUSION_MANA_COST;
  const canDefaultCast =
    boardInteractive && myFighter.mana >= MATCH_CONSTANTS.DEFAULT_CAST_MANA_COST;

  const basePlayerPet = getPetById(myFighter.petId);
  const evoPreviewImg = getPetSpritePath(basePlayerPet, 'MEGA');
  const myCombatPower = Math.round(
    myFighter.maxHp * 0.25 + myFighter.attack * 2.4 + myFighter.magic * 2.1 + myFighter.defense * 1.6 + myFighter.speed * 8,
  );
  const accumPct = (myFighter.accumStacks ?? 0) * 5;
  const starPct = Math.max(0, (myFighter.stars ?? 1) - 1);
  const btPct = myFighter.breakthroughLevel ?? 0;
  const gemBuffBadges = [
    { gem: 'SWORD' as GemType, pct: 2 + starPct + Math.round(accumPct * 0.6) },
    { gem: 'YINYANG' as GemType, pct: 2 + btPct },
    { gem: 'FIRE' as GemType, pct: 2 + Math.floor(starPct / 2) },
    { gem: 'HEART' as GemType, pct: 2 + Math.floor(btPct / 2) },
    { gem: 'LIGHTNING' as GemType, pct: 2 + Math.floor((myFighter.maxMana - 250) / 800) },
    { gem: 'COIN' as GemType, pct: 1 + (myFighter.guardPetId ? 2 : 0) },
  ];
  const hideBoardNow = boardFaded || Boolean(pendingQteSkill);

  const getRowPickLimit = (sk: SkillDef | null): number => {
    if (!sk) return 3;
    if (sk.boardEffect === 'BURN_ROWS') return Math.max(1, Math.min(3, sk.burnRowCount ?? 3));
    if (sk.boardEffect === 'CROSS_EXPLODE') return 2;
    if (sk.boardEffect === 'BOMB_3X3') return 3;
    return 0;
  };

  const handleSkillClick = (sk: SkillDef) => {
    if (!boardInteractive) return;
    if (sk.boardEffect === 'BURN_ROWS' || sk.boardEffect === 'CROSS_EXPLODE' || sk.boardEffect === 'BOMB_3X3') {
      setPendingBurnSkill(sk);
      setPickedRows([]);
      setConfirmedBurnRows(undefined);
      return;
    }
    if (sk.needPerfection) {
      setConfirmedBurnRows(undefined);
      setPendingQteSkill(sk);
    } else {
      onCastSkill(sk.id);
    }
  };

  const toggleBurnRow = (rowIdx: number) => {
    const limit = getRowPickLimit(pendingBurnSkill);
    setPickedRows((prev) => {
      if (prev.includes(rowIdx)) return prev.filter((r) => r !== rowIdx);
      if (prev.length >= limit) return prev;
      return [...prev, rowIdx].sort((a, b) => a - b);
    });
  };

  const confirmBurnRows = () => {
    if (!pendingBurnSkill || pickedRows.length === 0) return;
    const sk = pendingBurnSkill;
    const rows = [...pickedRows];
    setPendingBurnSkill(null);
    setPickedRows([]);
    if (sk.needPerfection) {
      setConfirmedBurnRows(rows);
      setPendingQteSkill(sk);
    } else {
      onCastSkill(sk.id, undefined, rows);
    }
  };

  return (
    <div className="pk-battle-root">
      <img src={arenaBg} alt="Arena Background" className="pk-battle-bg" />
      <div className="pk-battle-vignette" />

      {/* ==================== TOP SYMMETRICAL 3-TIER POKIGUARD BATTLE HUD ==================== */}
      <div className="pk-battle-topbar">
        {/* TOP-LEFT << EXIT BUTTON */}
        <button
          type="button"
          className="pk-pg-exit-btn"
          title="Rời trận"
          onClick={onLeave}
        >
          «
        </button>

        {/* CENTERED 3-TIER CHAMFERED METALLIC HUD CLUSTER */}
        <div className="pk-pg-hud-cluster">
          {/* LEFT WING: PLAYER HP (RED) / RAGE (GOLD) / MANA (CYAN) */}
          <div className="pk-pg-wing pk-pg-wing-left">
            <div className="pk-pg-hp-shell">
              <div className="pk-pg-hp-inner">
                <div className="pk-pg-hp-fill" style={{ width: `${myHpPct}%` }} />
                <div className="pk-pg-hp-text pk-num-font">
                  <span>
                    {myFighter.hp.toLocaleString('vi-VN')}/{myFighter.maxHp.toLocaleString('vi-VN')}
                  </span>
                  {myFighter.shield > 0 && (
                    <span style={{ color: '#bae6fd', fontSize: 11 }}>
                      (+{myFighter.shield.toLocaleString('vi-VN')})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pk-pg-rage-shell" title="Nộ (Tối đa 250 — ≥100 & ≥200 tăng sát thương Kiếm)">
              <div className="pk-pg-hp-inner">
                <div className="pk-subbar-rage" style={{ width: `${myRagePct}%` }} />
                <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.45)' }} />
                <div style={{ position: 'absolute', left: '80%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.45)' }} />
                <span className="pk-pg-sub-text pk-num-font">
                  {myFighter.rage}/{myFighter.maxRage}
                </span>
              </div>
            </div>

            <div className="pk-pg-mana-shell" title="Năng lượng dùng Thẻ Tiến Hóa (120) / Chưởng (160) / Tuyệt Kỹ">
              <div className="pk-pg-hp-inner">
                <div className="pk-subbar-mana" style={{ width: `${myManaPct}%` }} />
                <span className="pk-pg-sub-text pk-num-font" style={{ color: '#e0f2fe' }}>
                  {myFighter.mana}/{myFighter.maxMana}
                </span>
              </div>
            </div>
          </div>

          {/* CENTER METALLIC COUNTDOWN MEDAL */}
          <div className="pk-turn-orb">
            <div className={`pk-pg-timer-medal ${!isYourTurn && !battleState.winner ? 'enemy' : ''}`}>
              <span
                className="pk-num-font"
                style={{
                  fontSize: overlayPaused ? 12 : 25,
                  lineHeight: 1,
                  color: overlayPaused
                    ? '#e0f2fe'
                    : turnSecondsLeft !== null && turnSecondsLeft <= 5
                      ? '#fef08a'
                      : '#ffedd5',
                  textShadow: '0 2px 0 #7c2d12, 0 3px 6px rgba(0,0,0,0.9)',
                }}
              >
                {overlayPaused
                  ? '⏸'
                  : turnSecondsLeft !== null
                    ? `${turnSecondsLeft}`
                    : battleState.turnNumber}
              </span>
            </div>
          </div>

          {/* RIGHT WING: ENEMY HP (GREEN) / RAGE (GOLD) / MANA (CYAN) */}
          <div className="pk-pg-wing pk-pg-wing-right">
            <div className="pk-pg-hp-shell">
              <div className="pk-pg-hp-inner">
                <div
                  className="pk-pg-enemy-hp-fill"
                  style={{ width: `${enemyHpPct}%`, marginLeft: 'auto' }}
                />
                <div className="pk-pg-hp-text pk-num-font">
                  {enemyFighter.shield > 0 && (
                    <span style={{ color: '#bae6fd', fontSize: 11 }}>
                      (+{enemyFighter.shield.toLocaleString('vi-VN')})
                    </span>
                  )}
                  <span>
                    {enemyFighter.hp.toLocaleString('vi-VN')}/{enemyFighter.maxHp.toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="pk-pg-rage-shell">
              <div className="pk-pg-hp-inner">
                <div
                  className="pk-subbar-rage"
                  style={{ width: `${enemyRagePct}%`, marginLeft: 'auto' }}
                />
                <span className="pk-pg-sub-text pk-num-font">
                  {enemyFighter.rage}/{enemyFighter.maxRage}
                </span>
              </div>
            </div>

            <div className="pk-pg-mana-shell">
              <div className="pk-pg-hp-inner">
                <div
                  className="pk-subbar-mana"
                  style={{ width: `${enemyManaPct}%`, marginLeft: 'auto' }}
                />
                <span className="pk-pg-sub-text pk-num-font" style={{ color: '#e0f2fe' }}>
                  {enemyFighter.mana}/{enemyFighter.maxMana}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== FULL-ARENA POKIGUARD BATTLEFIELD ==================== */}
      <div className="pk-battle-main">
        {/* FAR-LEFT MINI-PORTRAIT CARD (frameAvatar.png) */}
        <div className="pk-pg-mini-avatar pk-pg-mini-avatar-left" title={`${playerName} — ${myFighter.name}`}>
          <img
            src={`/assets/pokiguard/avatars/${playerAvatarId}.png`}
            alt={playerName}
            style={{
              width: 66,
              height: 60,
              objectFit: 'cover',
              objectPosition: 'top center',
              borderRadius: 6,
              border: '1.5px solid #fde047',
              background: 'rgba(2, 6, 23, 0.75)',
            }}
          />
          <div className="pk-pg-mini-bar">
            <div style={{ width: `${myHpPct}%`, height: '100%', background: '#ef4444' }} />
          </div>
          <div style={{ fontSize: 8.5, fontWeight: 900, color: '#fef08a', lineHeight: 1 }}>
            {myFighter.hp}/{myFighter.maxHp}
          </div>
          <div className="pk-pg-mini-bar">
            <div style={{ width: `${myManaPct}%`, height: '100%', background: '#38bdf8' }} />
          </div>
          <div className="pk-pg-mini-bar">
            <div style={{ width: `${myRagePct}%`, height: '100%', background: '#f59e0b' }} />
          </div>
        </div>

        {/* FAR-RIGHT MINI-PORTRAIT CARD (frameAvatar.png) */}
        <div className="pk-pg-mini-avatar pk-pg-mini-avatar-right" title={`${opponentName} — ${enemyFighter.name}`}>
          <img
            src={
              isBossStage
                ? getPetSpritePath(getPetById(enemyFighter.petId))
                : '/assets/pokiguard/avatars/34.png'
            }
            alt={opponentName}
            style={{
              width: 66,
              height: 60,
              objectFit: isBossStage ? 'contain' : 'cover',
              objectPosition: 'top center',
              borderRadius: 6,
              border: '1.5px solid #f87171',
              background: 'radial-gradient(circle, rgba(127,29,29,0.75), rgba(2,6,23,0.9))',
            }}
          />
          <div className="pk-pg-mini-bar">
            <div style={{ width: `${enemyHpPct}%`, height: '100%', background: '#22c55e' }} />
          </div>
          <div style={{ fontSize: 8.5, fontWeight: 900, color: '#fef08a', lineHeight: 1 }}>
            {enemyFighter.hp}/{enemyFighter.maxHp}
          </div>
          <div className="pk-pg-mini-bar">
            <div style={{ width: `${enemyManaPct}%`, height: '100%', background: '#38bdf8' }} />
          </div>
          <div className="pk-pg-mini-bar">
            <div style={{ width: `${enemyRagePct}%`, height: '100%', background: '#f59e0b' }} />
          </div>
        </div>

        {/* ABOVE-PET POKIGUARD POWER ORB + +5% HỢP THỂ + 7-GEM BUFF PILL */}
        <div className="pk-pg-buff-cluster">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #e0f2fe, #0284c7 65%, #1e3a8a)',
                border: '2px solid #bae6fd',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: '#fff',
              }}
            >
              ⚡
            </div>
            <span
              className="pk-num-font"
              style={{ fontSize: 15, color: '#f8fafc', textShadow: '0 2px 4px #000' }}
            >
              {myCombatPower.toLocaleString('vi-VN')}
            </span>
            {myFighter.fusionPetId && (
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 900,
                  color: '#fde047',
                  textShadow: '0 2px 3px #000, 0 0 10px rgba(250, 204, 21, 0.7)',
                }}
              >
                +5% HỢP THỂ
              </span>
            )}
          </div>

          <div className="pk-pg-gem-buffs">
            {gemBuffBadges.map((b) => (
              <span key={b.gem} className="pk-pg-gem-buff-item">
                <img
                  src={GEM_META[b.gem].spritePath}
                  alt={b.gem}
                  style={{ width: 14, height: 14, objectFit: 'contain' }}
                />
                +{b.pct}%
              </span>
            ))}
          </div>

          {renderStatusChips(myFighter)}
        </div>

        {/* ENEMY STATUS CHIPS UNDER TOP-RIGHT */}
        {enemyFighter.statuses.length > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 104,
              top: 20,
              zIndex: 18,
              display: 'flex',
              justifyContent: 'flex-end',
              maxWidth: 230,
              pointerEvents: 'none',
            }}
          >
            {renderStatusChips(enemyFighter)}
          </div>
        )}

        {/* CO-OP 3V1 TEAMMATE MINI-CARDS WHEN MERCENARIES HIRED */}
        {(mercenaryCount ?? myFighter.allyCount ?? 0) > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: 144,
              zIndex: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              pointerEvents: 'none',
            }}
          >
            <div className="pk-coop-ally-badge">
              <img
                src="/assets/pokiguard/pets/1440.png"
                alt="Kiếm Thánh"
                style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: '50%', background: '#0b1b44' }}
              />
              <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fef08a' }}>
                Kiếm Thánh <span style={{ color: '#7dd3fc' }}>+15%</span>
              </span>
            </div>
            {(mercenaryCount ?? myFighter.allyCount ?? 0) >= 2 && (
              <div className="pk-coop-ally-badge" style={{ borderColor: 'rgba(251, 146, 60, 0.8)' }}>
                <img
                  src="/assets/pokiguard/pets/1498.png"
                  alt="Hỏa Vương"
                  style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: '50%', background: '#2a0f08' }}
                />
                <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fed7aa' }}>
                  Hỏa Vương <span style={{ color: '#fde047' }}>+15%</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* IN-BATTLE EMOJI SPEECH BUBBLES OVER PLAYER & ENEMY PET */}
        {myEmoji && (
          <div
            className="pk-emoji-bubble"
            style={{
              left: '17%',
              top: 112,
              backgroundImage: "url('/assets/pokiguard/sprites/bubble_l.png')",
              paddingBottom: 6,
            }}
          >
            <img
              src={`/assets/pokiguard/sprites/${myEmoji}.png`}
              alt={myEmoji}
              style={{ width: 34, height: 34, objectFit: 'contain' }}
            />
          </div>
        )}
        {enemyEmoji && (
          <div
            className="pk-emoji-bubble"
            style={{
              left: '77%',
              top: 112,
              backgroundImage: "url('/assets/pokiguard/sprites/bubble_r.png')",
              paddingBottom: 6,
            }}
          >
            <img
              src={`/assets/pokiguard/sprites/${enemyEmoji}.png`}
              alt={enemyEmoji}
              style={{ width: 34, height: 34, objectFit: 'contain' }}
            />
          </div>
        )}

        {/* PET HỘ VỆ (SUPPORT PET) COMPACT MEDALLION */}
        {myFighter.guardPetSpriteId && (
          <div
            style={{
              position: 'absolute',
              left: 104,
              top: 108,
              zIndex: 17,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px 2px 4px',
              borderRadius: 999,
              background: 'rgba(6, 20, 56, 0.86)',
              border: '1.5px solid #fde047',
              boxShadow: '0 4px 12px rgba(0,0,0,0.75)',
              pointerEvents: 'none',
            }}
          >
            <img
              src={`/assets/pokiguard/pets/${myFighter.guardPetSpriteId}.png`}
              alt={myFighter.guardPetName ?? 'Hộ Vệ'}
              style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: '50%', background: '#0f172a' }}
            />
            <span style={{ fontSize: 9.5, fontWeight: 900, color: '#fde047' }}>
              🛡️ {myFighter.guardPetName} <span style={{ color: '#4ade80' }}>+16%</span>
            </span>
          </div>
        )}

        {/* FLOATING LEFT BLUE HEXAGON CHAT/EMOJI BUTTON (POKIGUARD STYLE) */}
        <button
          type="button"
          className="pk-pg-hex-btn"
          style={pendingQteSkill ? { opacity: 0, pointerEvents: 'none' } : undefined}
          title="Biểu cảm trong trận"
          onClick={() => setShowEmojiPicker((v) => !v)}
        >
          💬
        </button>

        {showEmojiPicker && (
          <div
            style={{
              position: 'absolute',
              left: 76,
              top: 170,
              width: 236,
              padding: '10px 10px 8px',
              backgroundImage: "url('/assets/pokiguard/sprites/frame_emoji.png')",
              backgroundSize: '100% 100%',
              backgroundColor: 'rgba(6, 20, 56, 0.96)',
              borderRadius: 12,
              border: '2px solid #38bdf8',
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.85)',
              zIndex: 45,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 900, color: '#fde047', marginBottom: 6, textAlign: 'center' }}>
              BIỂU CẢM TRONG TRẬN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {EMOJI_IDS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className="pk-btn-blue"
                  style={{ padding: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  onClick={() => handleSendEmoji(em)}
                >
                  <img
                    src={`/assets/pokiguard/sprites/${em}.png`}
                    alt={em}
                    style={{ width: 32, height: 32, objectFit: 'contain' }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FLOATING RIGHT SPEED TOGGLE (>> x1 / x2) — CLEAN POKIGUARD RAIL */}
        <div
          className="pk-pg-right-tools"
          style={pendingQteSkill ? { opacity: 0, pointerEvents: 'none' } : undefined}
        >
          <button
            type="button"
            className={`pk-pg-circle-tool ${battleSpeed === 2 ? 'active' : ''}`}
            title={battleSpeed === 2 ? 'Đang tăng tốc x2 (nhấn để về x1)' : 'Bật tăng tốc đánh x2'}
            onClick={onToggleSpeed}
          >
            <span style={{ fontSize: 10, opacity: 0.85 }}>»</span>
            <span style={{ fontSize: 14 }}>x{battleSpeed}</span>
          </button>
        </div>

        {/* FULL ARENA PIXI MONSTER STAGE (PETS FACING ACROSS THE CENTER BOARD) */}
        <div className="pk-battle-stage-layer">
          <SpineStageCanvas
            width={1280}
            height={580}
            mode="DUEL"
            mySpriteId={myFighter.spriteId}
            enemySpriteId={enemyFighter.spriteId}
            myElement={myFighter.element}
            enemyElement={enemyFighter.element}
            myAuraColorHex={getAuraById(myFighter.auraId)?.colorHex}
            isBoss={isBossStage}
            mySide={yourSide}
            activeTurn={battleState.currentTurn}
            defeatedSide={defeatedSide}
            actionCue={actionCue}
            animCommand={animCommand}
            scaleMultiplier={1.08}
            speedMultiplier={battleSpeed}
          />
        </div>

        {/* RATING STARS (UP TO 6★) & REVIVAL HEARTS UNDER EACH PET */}
        {!pendingQteSkill && [
          { left: '17.5%', stars: myFighter.stars, tier: myFighter.tier, revives: myFighter.reviveCharges ?? 0 },
          { left: '82.5%', stars: enemyFighter.stars, tier: enemyFighter.tier, revives: enemyFighter.reviveCharges ?? 0 },
        ].map((rInfo, sideIdx) => {
          const lit =
            rInfo.stars && rInfo.stars >= 1
              ? Math.min(6, rInfo.stars)
              : rInfo.tier === 'BASE'
                ? 2
                : rInfo.tier === 'S'
                  ? 3
                  : rInfo.tier === 'MEGA' || rInfo.tier === 'LEGEND'
                    ? 4
                    : rInfo.tier === 'TITAN'
                      ? 6
                      : 5;
          return (
            <div
              key={sideIdx}
              style={{
                position: 'absolute',
                left: rInfo.left,
                top: 470,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                zIndex: 8,
                pointerEvents: 'none',
              }}
            >
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <img
                    key={i}
                    src={
                      i < lit
                        ? '/assets/pokiguard/sprites/gold_star.png'
                        : '/assets/pokiguard/sprites/62_1208_0.png'
                    }
                    alt="*"
                    style={{
                      width: 16,
                      height: 16,
                      objectFit: 'contain',
                      filter: i === 5 && lit >= 6 ? 'hue-rotate(250deg) saturate(1.9)' : undefined,
                    }}
                  />
                ))}
              </div>
              {rInfo.revives > 0 && (
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 900,
                    color: '#fb7185',
                    textShadow: '0 1px 3px #000',
                    background: 'rgba(15, 23, 42, 0.88)',
                    padding: '1px 7px',
                    borderRadius: 999,
                    border: '1px solid #f43f5e',
                  }}
                >
                  {'❤️'.repeat(Math.min(3, rInfo.revives))} Hồi Sinh
                </div>
              )}
            </div>
          );
        })}

        {/* FLOATING DAMAGE / HEAL NUMBERS & POKIGUARD COMIC STARBURST DAMAGE */}
        {popups.map((p, idx) =>
          p.isBurst ? (
            <div
              key={p.id}
              className="pk-dmg-starburst"
              style={{
                left: p.side === yourSide ? '18%' : '82%',
                top: `${175 + (idx % 3) * 28}px`,
              }}
            >
              <svg
                viewBox="0 0 220 150"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.85))',
                }}
              >
                <polygon
                  points="110,4 134,34 176,12 166,52 214,56 178,86 208,124 158,116 146,146 112,122 76,146 66,116 14,124 44,86 8,56 56,52 46,12 88,34"
                  fill="#ef4444"
                  stroke="#fde047"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                <polygon
                  points="110,18 130,44 162,28 154,58 192,62 162,84 184,112 146,106 136,130 110,110 84,130 74,106 36,112 58,84 28,62 66,58 58,28 90,44"
                  fill="#f97316"
                />
              </svg>
              <span className="pk-dmg-starburst-num pk-num-font" style={{ color: p.color }}>
                {p.text}
              </span>
            </div>
          ) : (
            <div
              key={p.id}
              className="pk-floating-dmg"
              style={{
                left: p.side === yourSide ? '18%' : '82%',
                top: `${210 + (idx % 4) * 32}px`,
                color: p.color,
              }}
            >
              {p.text}
            </div>
          ),
        )}

        {/* CENTERED 8x8 MATCH-3 BOARD + FULL-ART POKIGUARD CARD DOCK UNDERNEATH */}
        <div className="pk-battle-center">
          {/* BOARD WRAPPER */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className={`pk-board-shell ${hideBoardNow ? 'faded' : ''}`}>
              <BoardCanvas
                board={displayBoard ?? battleState.board}
                events={lastEvents}
                canInteract={boardInteractive}
                hintMove={hintMove}
                activeSwipe={activeSwipe}
                breakingGroup={breakingGroup}
                onSwap={onSwap}
              />

              {/* INTERACTIVE 3-ROW SELECTOR OVERLAY FOR PHONG HỎA */}
              {pendingBurnSkill && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 11,
                    zIndex: 28,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    borderRadius: 10,
                    background: 'rgba(2, 6, 23, 0.25)',
                    overflow: 'visible',
                  }}
                >
                  {Array.from({ length: battleState.rows }, (_, rowIdx) => {
                    const isPicked = pickedRows.includes(rowIdx);
                    return (
                      <button
                        key={rowIdx}
                        type="button"
                        className={`pk-row-picker-band ${isPicked ? 'selected' : ''}`}
                        style={{ paddingLeft: 0, justifyContent: 'flex-start', gap: 10, overflow: 'visible' }}
                        onClick={() => toggleBurnRow(rowIdx)}
                      >
                        <span
                          style={{
                            marginLeft: -62,
                            width: 54,
                            textAlign: 'center',
                            fontSize: 10,
                            fontWeight: 900,
                            color: isPicked ? '#fef08a' : '#fed7aa',
                            background: isPicked ? '#ea580c' : 'rgba(15, 23, 42, 0.92)',
                            padding: '2px 4px',
                            borderRadius: 5,
                            border: '1.5px solid #fb923c',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
                            flexShrink: 0,
                          }}
                        >
                          HÀNG {rowIdx + 1}
                        </span>
                        {isPicked && (
                          <span style={{ fontSize: 11, fontWeight: 900, color: '#fef08a', textShadow: '0 1px 2px #000', marginLeft: 'auto', marginRight: 8 }}>
                            {pendingBurnSkill.boardEffect === 'CROSS_EXPLODE'
                              ? '✚ NỔ CHỮ THẬP (+)'
                              : pendingBurnSkill.boardEffect === 'BOMB_3X3'
                                ? '💣 ĐẶT BOM 3×3'
                                : '🔥 THIÊU ĐỐT x2 KIẾM'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SPECIAL SKILL FLOATING CONFIRM BANNER OVER BOARD */}
            {pendingBurnSkill && (() => {
              const limit = getRowPickLimit(pendingBurnSkill);
              const promptLabel =
                pendingBurnSkill.boardEffect === 'CROSS_EXPLODE'
                  ? `Chọn tối đa ${limit} tâm chữ thập (+)`
                  : pendingBurnSkill.boardEffect === 'BOMB_3X3'
                    ? `Chọn tối đa ${limit} hàng đặt bom 3×3`
                    : `Chọn tối đa ${limit} hàng ngang`;
              const actionText =
                pendingBurnSkill.boardEffect === 'CROSS_EXPLODE'
                  ? 'Nổ Chữ Thập!'
                  : pendingBurnSkill.boardEffect === 'BOMB_3X3'
                    ? 'Kích Nổ Bom!'
                    : 'Thiêu Đốt!';
              return (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    left: '50%',
                    transform: 'translate(-50%, 50%)',
                    zIndex: 42,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'linear-gradient(180deg, #431407, #1c0a00)',
                    border: '2px solid #fb923c',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.9)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: 900, color: '#fed7aa' }}>
                    {pendingBurnSkill.name}: {promptLabel} ({pickedRows.length}/{limit})
                  </span>
                  <button
                    type="button"
                    className="pk-btn-gold"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    disabled={pickedRows.length === 0}
                    onClick={confirmBurnRows}
                  >
                    {actionText}
                  </button>
                  <button
                    type="button"
                    className="pk-btn-red"
                    style={{ padding: '4px 9px', fontSize: 11 }}
                    onClick={() => {
                      setPendingBurnSkill(null);
                      setPickedRows([]);
                    }}
                  >
                    Hủy
                  </button>
                </div>
              );
            })()}

            {/* COLLECTED GEMS TRAY (KHAY NGỌC ĐÃ ĂN CHUẨN POKIWAR GỐC) */}
            {collectedGems.length > 0 && !pendingQteSkill && (
              <div
                style={{
                  position: 'absolute',
                  top: boardFaded ? 22 : -18,
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  maxWidth: 416,
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 16,
                  background: 'linear-gradient(180deg, rgba(15, 34, 78, 0.96), rgba(6, 15, 40, 0.96))',
                  border: '2px solid #fde047',
                  boxShadow: '0 8px 26px rgba(0, 0, 0, 0.85), 0 0 18px rgba(250, 204, 21, 0.55)',
                  pointerEvents: 'none',
                  transition: 'top 0.22s ease',
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 900, color: '#93c5fd', letterSpacing: 0.4 }}>
                  NGỌC ĐÃ ĂN:
                </span>
                {collectedGems.map((item) => (
                  <div
                    key={item.gemType}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: 'rgba(2, 6, 23, 0.85)',
                      border: `1.5px solid ${GEM_META[item.gemType].color}`,
                      boxShadow: `0 0 8px ${GEM_META[item.gemType].color}88`,
                    }}
                  >
                    <img
                      src={GEM_META[item.gemType].spritePath}
                      alt={GEM_META[item.gemType].label}
                      style={{ width: 20, height: 20, objectFit: 'contain' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#fef08a', textShadow: '0 1px 2px #000' }}>
                      ×{item.count}
                    </span>
                  </div>
                ))}
                {collectedCombo >= 2 && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'linear-gradient(90deg, #ea580c, #dc2626)',
                      border: '1px solid #fde047',
                      color: '#fef08a',
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    COMBO ×{collectedCombo}!
                  </span>
                )}
              </div>
            )}

            {/* MATCHED GEM xN / SKILL CARD CALLOUT OVER HIDDEN BOARD */}
            {parsedCallout && !pendingQteSkill && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 35,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  maxWidth: 400,
                  padding: '12px 18px',
                  borderRadius: 18,
                  background: 'radial-gradient(circle, rgba(14, 42, 98, 0.94), rgba(5, 14, 38, 0.96))',
                  border: '2.5px solid #fde047',
                  boxShadow: '0 0 36px rgba(250, 204, 21, 0.72), 0 12px 28px rgba(0,0,0,0.85)',
                }}
              >
                {parsedCallout.gemType && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img
                      src={GEM_META[parsedCallout.gemType].spritePath}
                      alt={GEM_META[parsedCallout.gemType].label}
                      style={{ width: 64, height: 64, objectFit: 'contain', filter: 'drop-shadow(0 0 10px #fff)' }}
                    />
                    {parsedCallout.count && (
                      <span
                        style={{
                          fontSize: 34,
                          fontWeight: 900,
                          color: '#fde047',
                          textShadow: '0 3px 0 #7c2d12',
                        }}
                      >
                        x{parsedCallout.count}
                      </span>
                    )}
                  </div>
                )}

                {parsedCallout.skillCardImage && (
                  <img
                    src={parsedCallout.skillCardImage}
                    alt={parsedCallout.text}
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: 10,
                      border: '2px solid #fde047',
                      objectFit: 'cover',
                    }}
                  />
                )}

                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 900,
                    color: '#fef08a',
                    textShadow: '0 2px 4px #000',
                    textAlign: 'center',
                    lineHeight: 1.25,
                  }}
                >
                  {parsedCallout.text}
                </div>
              </div>
            )}

            {/* WINGED POKIGUARD "LƯỢT CỦA BẠN" BANNER */}
            {turnSplashKey > 0 && isYourTurn && !hideBoardNow && !parsedCallout && !pendingQteSkill && !pendingBurnSkill && (
              <div key={turnSplashKey} className="pk-pg-turn-banner">
                LƯỢT CỦA BẠN
              </div>
            )}
          </div>

          {/* FULL-ART POKIGUARD CARD DOCK DIRECTLY UNDERNEATH THE 432PX BOARD */}
          <div className="pk-card-dock" style={pendingQteSkill ? { opacity: 0, pointerEvents: 'none' } : undefined}>
            {/* 1. Pet Special Skill Card(s) — Full-Art PokiGuard Card with Mana Top / Rage Bottom / Gem Counter */}
            {myFighter.skills.map((sk) => {
              const cd = myFighter.cooldowns[sk.id] ?? 0;
              const manaReq = sk.manaCost ?? 0;
              const gemProg = getSkillGemProgress(myFighter, sk);
              const enoughRes = myFighter.rage >= sk.rageCost && myFighter.mana >= manaReq && gemProg.met;
              const canCast = boardInteractive && cd === 0 && enoughRes;
              const triggerTag = sk.needPerfection
                ? 'QTE ▲▼◀▶'
                : sk.gemRequirement
                  ? `${sk.gemRequirement.gemType ? GEM_META[sk.gemRequirement.gemType].icon : '💎'}${Math.min(gemProg.current, gemProg.required)}/${gemProg.required}`
                  : null;
              const fullTooltip = `${sk.isSpecialCard ? '★ THẺ KỸ NĂNG ĐẶC BIỆT POKIWAR 4.0 ★\n' : ''}${sk.name} (${sk.rageCost} Nộ / ${manaReq} Mana)${sk.gemRequirement ? `\n• Điều kiện ngọc: ${gemProg.label} (${gemProg.current}/${gemProg.required})` : ''}${sk.needPerfection ? '\n• Kích hoạt: Audition QTE 4 phím ▲▼◀▶' : '\n• Kích hoạt: Tung trực tiếp (không cần QTE)'}\n${sk.description}${sk.specialPassiveNote ? `\n• Bị động: ${sk.specialPassiveNote}` : ''}`;
              return (
                <button
                  key={sk.id}
                  type="button"
                  title={fullTooltip}
                  className={`pk-pg-card special ${canCast ? 'ready' : ''}`}
                  disabled={!canCast}
                  onClick={() => handleSkillClick(sk)}
                >
                  <div className="pk-pg-card-img-wrap">
                    <img
                      src={sk.cardImage}
                      alt={sk.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div className="pk-pg-card-top-cost">
                      <span>⚡{manaReq}</span>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: sk.needPerfection
                            ? 'linear-gradient(180deg, #f0abfc, #9333ea)'
                            : 'linear-gradient(180deg, #fef08a, #ca8a04)',
                          color: sk.needPerfection ? '#ffffff' : '#451a03',
                          fontSize: 8.5,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                        }}
                      >
                        {sk.needPerfection ? '★' : '1'}
                      </span>
                    </div>
                    {triggerTag && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 20,
                          left: 2,
                          right: 2,
                          padding: '1px 3px',
                          borderRadius: 4,
                          background: gemProg.met
                            ? 'rgba(22, 101, 52, 0.92)'
                            : 'rgba(15, 23, 42, 0.9)',
                          border: `1px solid ${gemProg.met ? '#4ade80' : '#f59e0b'}`,
                          color: gemProg.met ? '#bbf7d0' : '#fde047',
                          fontSize: 8,
                          fontWeight: 900,
                          textAlign: 'center',
                          lineHeight: 1.15,
                        }}
                      >
                        {triggerTag}
                      </div>
                    )}
                    <div className="pk-pg-card-bot-cost">
                      <span>🔥{sk.rageCost}</span>
                    </div>
                    {cd > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(2, 6, 23, 0.78)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 900,
                          color: '#fde047',
                        }}
                      >
                        {cd}L
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            {/* 2. Thẻ Hóa Thần (120 Mana, Turn 2+, Free Action, +5% badge inside top-right) */}
            <button
              type="button"
              className={`pk-pg-card ${canInBattleEvolve ? 'ready' : ''}`}
              disabled={!canInBattleEvolve}
              onClick={onInBattleEvolve}
              title={
                !evolveUnlocked
                  ? 'Thẻ Hóa Thần mở khóa từ Lượt 2 trở đi (Lượt đầu tiên phải đi trên bàn cờ)'
                  : 'Hóa Thần trong trận: tốn 120 Mana, KHÔNG mất lượt (+70% HP, +200 Max Mana, +20% Công/Phép)'
              }
            >
              <div className="pk-pg-card-img-wrap" style={{ background: 'radial-gradient(circle, #1e3a8a, #020617)' }}>
                <img
                  src={evoPreviewImg}
                  alt="Hóa Thần"
                  style={{ width: '92%', height: '80%', objectFit: 'contain' }}
                />
                <div className="pk-pg-card-top-cost">
                  <span>{myFighter.inBattleEvolved ? '✓' : !evolveUnlocked ? 'L2+' : '⚡120'}</span>
                  {!myFighter.inBattleEvolved && (
                    <span style={{ color: '#fde047', fontSize: 8.5 }}>+5%</span>
                  )}
                </div>
                <div
                  className="pk-pg-card-bot-cost"
                  style={{ background: 'linear-gradient(180deg, rgba(180,83,9,0.92), rgba(120,53,15,0.96))' }}
                >
                  <span>{myFighter.inBattleEvolved ? 'ĐÃ HÓA' : 'HÓA THẦN'}</span>
                </div>
              </div>
            </button>

            {/* 3. Thẻ Chưởng Ngũ Hành (Full-Art PokiGuard card4.png — 160 Mana) */}
            <button
              type="button"
              className={`pk-pg-card ${canDefaultCast ? 'ready' : ''}`}
              disabled={!canDefaultCast}
              onClick={onDefaultCast}
              title="Thẻ Chưởng Ngũ Hành: tốn 160 Mana, bắn chưởng 2.15x Phép (Kết thúc lượt)"
            >
              <div className="pk-pg-card-img-wrap">
                <img
                  src="/assets/pokiguard/cards/card4.png"
                  alt="Thẻ Chưởng 160M"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  className="pk-pg-card-bot-cost"
                  style={{ background: 'linear-gradient(180deg, rgba(2,132,199,0.9), rgba(3,105,161,0.96))' }}
                >
                  <span>CHƯỞNG</span>
                </div>
              </div>
            </button>

            {/* 4. Thẻ Hợp Thể (if Fusion Pet equipped & allowed) */}
            {myFighter.fusionPetId && onFusionStrike && !battleState.restrictedRules && (() => {
              const canFusion =
                boardInteractive &&
                !myFighter.fusionStrikeUsed &&
                myFighter.rage >= 50 &&
                myFighter.mana >= 60;
              return (
                <button
                  type="button"
                  className={`pk-pg-card ${canFusion ? 'ready' : ''}`}
                  disabled={!canFusion}
                  onClick={onFusionStrike}
                  title={`Thẻ Hợp Thể (${myFighter.fusionPetName}): 50 Nộ + 60 Mana, Liên Kích 1.95x + Vết Thương Sâu + Hồi Máu & Giáp`}
                >
                  <div
                    className="pk-pg-card-img-wrap"
                    style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.65), #0f172a)' }}
                  >
                    <img
                      src={getPetSpritePath(getPetById(myFighter.fusionPetId))}
                      alt="Hợp Thể"
                      style={{ width: '90%', height: '78%', objectFit: 'contain' }}
                    />
                    <div
                      className="pk-pg-card-top-cost"
                      style={{ background: 'linear-gradient(180deg, rgba(147,51,234,0.95), rgba(88,28,135,0.95))' }}
                    >
                      <span>{myFighter.fusionStrikeUsed ? 'XONG' : '🔥50'}</span>
                    </div>
                    <div className="pk-pg-card-bot-cost">
                      <span>HỢP THỂ</span>
                    </div>
                  </div>
                </button>
              );
            })()}

            {/* 5. 3 Thẻ Hỗ Trợ Full-Art PokiGuard (card1.png +100M, card2.png +50N, card3/6/8 +HP...) */}
            {(myFighter.equippedSupportCards && myFighter.equippedSupportCards.length > 0
              ? myFighter.equippedSupportCards
              : (['MANA_100', 'RAGE_50', 'HP_350'] as SupportCardId[])
            ).map((cId) => {
              const card = SUPPORT_CARDS[cId] ?? SUPPORT_CARDS.MANA_100;
              const cLv = Math.max(1, Math.min(5, myFighter.supportCardLevels?.[cId] ?? 1));
              const scaledLabel = getSupportCardScaledLabel(cId, cLv);
              const used = Boolean(myFighter.supportUsed?.[cId]);
              const usable = boardInteractive && !used;
              return (
                <button
                  key={cId}
                  type="button"
                  className="pk-pg-card"
                  style={{ width: 66, height: 94 }}
                  disabled={!usable}
                  onClick={() => onSupportCard(cId)}
                  title={`${card.name} Lv.${cLv} (${scaledLabel}): ${card.description} — Dùng 1 lần/trận, không mất lượt`}
                >
                  <div className="pk-pg-card-img-wrap">
                    <img
                      src={card.image}
                      alt={card.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        fontSize: 8,
                        fontWeight: 900,
                        padding: '0 4px',
                        borderRadius: 999,
                        background: used ? '#334155' : 'rgba(2, 6, 23, 0.85)',
                        border: '1px solid #38bdf8',
                        color: used ? '#94a3b8' : '#fef08a',
                      }}
                    >
                      {used ? 'HẾT' : `Lv${cLv}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* BOTTOM-LEFT SLEEK POKIGUARD NAMEPLATE */}
        <div className="pk-corner-anchor-left">
          <div className="pk-pg-plate-name" title={`${playerName} • ${myFighter.name}`}>
            {playerName} — {myFighter.name}
          </div>
          <div className="pk-pg-nameplate">
            <img
              src={ELEMENT_META[myFighter.element].iconPath}
              alt={myFighter.element}
              style={{ width: 26, height: 26, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px #000)' }}
            />
            <span className="pk-num-font" style={{ fontSize: 13.5, color: '#fde047' }}>
              Lv.{myFighter.level}
            </span>
            <span className="pk-num-font" style={{ fontSize: 12, color: '#4ade80' }}>
              +{myFighter.attack} Công
            </span>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#bae6fd', marginLeft: 'auto' }}>
              Thủ {myFighter.defense}
            </span>
          </div>
        </div>

        {/* BOTTOM-RIGHT SLEEK POKIGUARD NAMEPLATE */}
        <div className="pk-corner-anchor-right">
          <div className="pk-pg-plate-name" style={{ textAlign: 'right' }} title={`${opponentName} • ${enemyFighter.name}`}>
            {enemyFighter.name}
          </div>
          <div className="pk-pg-nameplate right">
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#fef08a',
                marginRight: 'auto',
                minWidth: 0,
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={recentLogs[0] ?? 'Sẵn sàng giao chiến'}
            >
              {recentLogs[0] ?? `Thủ ${enemyFighter.defense}`}
            </span>
            <span className="pk-num-font" style={{ fontSize: 13.5, color: '#fde047' }}>
              Lv.{enemyFighter.level}
            </span>
            <span className="pk-num-font" style={{ fontSize: 11.5, color: '#fca5a5' }}>
              {isBossStage ? 'BOSS' : enemyFighter.tier}
            </span>
            <img
              src={ELEMENT_META[enemyFighter.element].iconPath}
              alt={enemyFighter.element}
              style={{ width: 26, height: 26, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px #000)' }}
            />
          </div>
        </div>
      </div>

      {/* ==================== QTE AUDITION OVERLAY ==================== */}
      {pendingQteSkill && (
        <QteAuditionModal
          skillName={pendingQteSkill.name}
          cardImage={pendingQteSkill.cardImage}
          onComplete={(grade) => {
            const skId = pendingQteSkill.id;
            const rows = confirmedBurnRows;
            setPendingQteSkill(null);
            setConfirmedBurnRows(undefined);
            onCastSkill(skId, grade, rows);
          }}
        />
      )}

      {/* ==================== AUTHENTIC POKIWAR BOSS / PET DEFEAT (KO) BANNER ==================== */}
      {battleState.winner && !koFinished && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 75,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              padding: '14px 36px',
              borderRadius: 999,
              background:
                battleState.winner === yourSide
                  ? 'linear-gradient(90deg, rgba(180,83,9,0.96), rgba(234,179,8,0.98), rgba(180,83,9,0.96))'
                  : 'linear-gradient(90deg, rgba(127,29,29,0.96), rgba(185,28,28,0.98), rgba(127,29,29,0.96))',
              border: '3px solid #fef08a',
              boxShadow: '0 0 42px rgba(250, 204, 21, 0.9), 0 12px 32px rgba(0, 0, 0, 0.85)',
              color: '#ffffff',
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 1.2,
              textShadow: '0 3px 6px rgba(0,0,0,0.85)',
              animation: 'pkBannerPop 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {battleState.winner === yourSide
              ? isBossStage
                ? `👑 ĐÃ HẠ GỤC BOSS ${enemyFighter.name.toUpperCase()}!`
                : `⚔️ K.O.! VƯỢT ẢI THÀNH CÔNG!`
              : '💀 THẤT BẠI!'}
          </div>
          <button
            type="button"
            className="pk-btn-blue"
            style={{ pointerEvents: 'auto', padding: '5px 14px', fontSize: 11, opacity: 0.88 }}
            onClick={() => setKoFinished(true)}
          >
            Xem Phần Thưởng Ngay ▸
          </button>
        </div>
      )}

      {/* ==================== VICTORY / DEFEAT OVERLAY (ResultPanel + Lật Thẻ) ==================== */}
      {battleState.winner && koFinished && (
        <div className="stage-modal-backdrop" style={{ zIndex: 80 }}>
          <div
            className="pk-modal"
            style={{
              maxWidth: battleState.winner === yourSide ? 590 : 480,
              backgroundImage: "url('/assets/pokiguard/sprites/bgGift_l.png_0.png')",
              backgroundSize: '100% 100%',
              border: 'none',
              padding: '24px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {battleState.winner === yourSide ? (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img
                  src="/assets/pokiguard/sprites/sunburst_gold.png"
                  alt=""
                  style={{ width: 84, height: 84, objectFit: 'contain', marginBottom: -26 }}
                />
                <img
                  src="/assets/pokiguard/sprites/banner_win.png"
                  alt="CHIẾN THẮNG"
                  style={{ width: 270, objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div className="pk-ribbon-title" style={{ filter: 'hue-rotate(-30deg)' }}>
                THẤT BẠI — CẦN RÈN LUYỆN THÊM
              </div>
            )}

            <p style={{ margin: 0, fontSize: 13.5, color: '#e2e8f0' }}>
              {battleState.winner === yourSide
                ? `${myFighter.name} đã đánh bại ${enemyFighter.name} trong ${battleState.turnNumber} lượt!`
                : `${enemyFighter.name} đã giành chiến thắng. Hãy nâng cấp Pet hoặc trang bị Avatar mạnh hơn!`}
            </p>

            {/* AUTHENTIC POKIWAR FIRST-CLEAR PET CAPTURE BANNER */}
            {battleState.winner === yourSide && capturedNewPet && (
              <div
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(22, 101, 52, 0.94), rgba(15, 23, 42, 0.96))',
                  border: '2px solid #4ade80',
                  boxShadow: '0 0 20px rgba(74, 222, 128, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                }}
              >
                <img
                  src={getPetSpritePath(capturedNewPet)}
                  alt={capturedNewPet.name}
                  style={{ width: 64, height: 64, objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.75))' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#4ade80' }}>
                    🎉 THU PHỤC THÀNH CÔNG PET MỚI!
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 900, color: '#fef08a' }}>
                    {capturedNewPet.name} ({capturedNewPet.tier})
                  </div>
                  <div style={{ fontSize: 10.8, color: '#e2e8f0' }}>
                    Đã sở hữu vĩnh viễn trong <strong>Kho Pet</strong>! Đánh lại ải này lần sau chỉ nhận Vàng &amp; Đá.
                  </div>
                </div>
              </div>
            )}

            {battleState.winner === yourSide && !capturedNewPet && alreadyCapturedNote && (
              <div
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  borderRadius: 10,
                  background: 'rgba(15, 23, 42, 0.84)',
                  border: '1px solid #38bdf8',
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: '#bae6fd',
                }}
              >
                ✅ Pet ải này đã được thu phục trước đó — Đánh lại chỉ nhận Vàng, EXP &amp; Đá!
              </div>
            )}

            {/* POST-VICTORY 6-CARD LUCKY FLIP MINI-GAME */}
            {battleState.winner === yourSide && flipDeck.length > 0 && (
              <div
                style={{
                  width: '100%',
                  background: 'rgba(2, 10, 32, 0.74)',
                  border: '1.5px solid rgba(250, 204, 21, 0.55)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
                  <span style={{ fontWeight: 900, color: '#fde047' }}>
                    🃏 LẬT THẺ MAY MẮN ({flippedIndices.length}/2)
                  </span>
                  <span style={{ fontWeight: 800, color: flippedIndices.length === 0 ? '#4ade80' : flippedIndices.length === 1 ? '#fbbf24' : '#94a3b8' }}>
                    {flippedIndices.length === 0
                      ? 'Lần 1: MIỄN PHÍ!'
                      : flippedIndices.length === 1
                        ? playerGold >= 150
                          ? 'Lần 2: 150 Vàng'
                          : 'Lần 2: Cần 150 Vàng'
                        : 'Đã nhận tối đa thẻ thưởng!'}
                  </span>
                </div>

                <div className="pk-flip-grid">
                  {flipDeck.map((card, idx) => {
                    const isFlipped = flippedIndices.includes(idx);
                    const done = flippedIndices.length >= 2;
                    const revealPreview = !isFlipped && done;
                    const canFlip = !isFlipped && !done && (flippedIndices.length === 0 || playerGold >= 150);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        className={`pk-flip-card ${isFlipped ? 'flipped' : revealPreview ? 'dimmed' : ''}`}
                        disabled={!canFlip}
                        onClick={() => handleFlipCard(idx)}
                      >
                        {isFlipped || revealPreview ? (
                          <>
                            <img
                              src={card.icon}
                              alt={card.label}
                              style={{ width: 34, height: 34, objectFit: 'contain' }}
                            />
                            <span style={{ fontSize: 10.5, fontWeight: 900, color: isFlipped ? '#fde047' : '#94a3b8', marginTop: 2 }}>
                              {card.label}
                            </span>
                          </>
                        ) : (
                          <>
                            <img
                              src="/assets/pokiguard/sprites/eventFlipCard.png"
                              alt="Lật Thẻ"
                              style={{ width: 42, height: 42, objectFit: 'contain' }}
                            />
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#7dd3fc' }}>
                              {flippedIndices.length === 0 ? 'Lật Miễn Phí' : 'Lật (150V)'}
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              {onRetryPve && (
                <button type="button" className="pk-btn-gold" onClick={onRetryPve}>
                  Đánh lại ải này
                </button>
              )}
              <button type="button" className="pk-btn-blue" onClick={onLeave}>
                Về Đảo Chính
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
