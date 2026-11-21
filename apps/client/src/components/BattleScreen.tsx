import {
  ELEMENT_META,
  GEM_META,
  GEM_TYPES,
  getAuraById,
  getPetById,
  getPetSpritePath,
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
  onClaimFlipReward?: (reward: {
    kind: 'GOLD' | 'STONE' | 'CHARM' | 'SHARD';
    amount: number;
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
  onPassTurn,
  onHint,
  onLeave,
  onRetryPve,
  onOverlayPauseChange,
  mercenaryCount,
  playerGold = 0,
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
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);

  // Emoji picker & speech bubbles
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [myEmoji, setMyEmoji] = useState<EmojiId | null>(null);
  const [enemyEmoji, setEnemyEmoji] = useState<EmojiId | null>(null);
  const emojiTimersRef = useRef<number[]>([]);

  // Post-victory 6-card Lật Thẻ May Mắn state
  interface FlipCardItem {
    id: number;
    kind: 'GOLD' | 'STONE' | 'CHARM' | 'SHARD';
    amount: number;
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
        { kind: 'STONE', amount: 2, label: '+2 Đá Cấp 2', icon: '/assets/pokiguard/sprites/stone_f_2.png' },
        { kind: 'SHARD', amount: 5, petId: targetPet.id, label: `+5 Mảnh ${targetPet.name}`, icon: shardIcon },
        { kind: 'CHARM', amount: 1, label: '+1 Bùa May Mắn', icon: '/assets/pokiguard/sprites/charm_may_man.png' },
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
  const canPass = boardInteractive && battleState.turnNumber > 1;

  const basePlayerPet = getPetById(myFighter.petId);
  const evoPreviewImg = getPetSpritePath(basePlayerPet, 'MEGA');

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
      {/* 1:1 POKIGUARD HEADER & FOOTER ARCH OVERLAY */}
      <div className="pk-pg-hud-frame" />

      {/* ==================== TOP SYMMETRICAL POKIGUARD BATTLE HUD ==================== */}
      <div className="pk-battle-topbar">
        {/* TOP-LEFT EXIT BUTTON (MatchPanel ExitButton) */}
        <button
          type="button"
          className="pk-pg-exit-btn"
          title="Rời trận"
          onClick={onLeave}
        >
          <img
            src="/assets/pokiguard/sprites/icons-04_0.png"
            alt="Rời"
            style={{ width: 38, height: 38, objectFit: 'contain' }}
          />
        </button>

        {/* LEFT WING: PLAYER HP / MANA / NỘ */}
        <div className="pk-hud-wing">
          <div className="pk-pg-hp-track">
            <div className="pk-pg-hp-inner">
              <div className="pk-pg-hp-fill" style={{ width: `${myHpPct}%` }} />
            </div>
            <div className="pk-bar-label-unskew-left">
              <span className="pk-num-font" style={{ color: '#ffe047' }}>
                {myFighter.hp}/{myFighter.maxHp}
                {myFighter.shield > 0 ? ` (+${myFighter.shield})` : ''}
              </span>
              <span>{myFighter.name}</span>
            </div>
          </div>

          <div className="pk-subbars-row">
            <div className="pk-subbar-track" title="Mana dùng Thẻ Tiến Hóa (120) / Chưởng (160) / Skill">
              <div className="pk-pg-hp-inner">
                <div className="pk-subbar-mana" style={{ width: `${myManaPct}%` }} />
              </div>
              <span
                className="pk-num-font"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#7ef3ff',
                  textShadow: '0 1px 2px #000',
                }}
              >
                Mana: {myFighter.mana}/{myFighter.maxMana}
              </span>
            </div>

            <div className="pk-subbar-rage-track" title="Nộ (Max 250 — ≥100 & ≥200 tăng sát thương Kiếm)">
              <div className="pk-pg-hp-inner">
                <div className="pk-subbar-rage" style={{ width: `${myRagePct}%` }} />
                <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 1.5, background: 'rgba(255,255,255,0.55)' }} />
                <div style={{ position: 'absolute', left: '80%', top: 0, bottom: 0, width: 1.5, background: 'rgba(255,255,255,0.55)' }} />
              </div>
              <span
                className="pk-num-font"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#fff275',
                  textShadow: '0 1px 2px #000',
                }}
              >
                Nộ: {myFighter.rage}/{myFighter.maxRage}
              </span>
            </div>
          </div>
        </div>

        {/* CENTER POKIGUARD SHIELD TURN BADGE */}
        <div className="pk-turn-orb">
          <span
            className="pk-num-font"
            style={{
              fontSize: overlayPaused ? 15 : 24,
              lineHeight: 1,
              color: overlayPaused
                ? '#7ef3ff'
                : turnSecondsLeft !== null && turnSecondsLeft <= 5
                  ? '#fca5a5'
                  : '#ffd84d',
              textShadow: '0 2px 0 #451a03, 0 3px 6px #000',
            }}
          >
            {overlayPaused
              ? '⏸ TẠM DỪNG'
              : turnSecondsLeft !== null
                ? `${turnSecondsLeft}`
                : battleState.turnNumber}
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 900, color: isYourTurn ? '#86efac' : '#fda4af', textShadow: '0 1px 2px #000' }}>
            {battleState.winner
              ? 'KẾT THÚC'
              : overlayPaused
                ? 'ĐANG CHỌN CHIÊU'
                : isYourTurn
                  ? `LƯỢT ${battleState.turnNumber} • BẠN`
                  : `LƯỢT ${battleState.turnNumber} • ĐỊCH`}
          </span>
        </div>

        {/* RIGHT WING: ENEMY HP / RAGE / MANA */}
        <div className="pk-hud-wing pk-hud-wing-right">
          <div className="pk-pg-hp-track">
            <div className="pk-pg-hp-inner">
              <div
                className="pk-pg-enemy-hp-fill"
                style={{ width: `${enemyHpPct}%`, marginLeft: 'auto' }}
              />
            </div>
            <div className="pk-bar-label-unskew-right">
              <span>{enemyFighter.name}</span>
              <span className="pk-num-font" style={{ color: '#ffe047' }}>
                {enemyFighter.shield > 0 ? `(+${enemyFighter.shield}) ` : ''}
                {enemyFighter.hp}/{enemyFighter.maxHp}
              </span>
            </div>
          </div>

          <div className="pk-subbars-row" style={{ justifyContent: 'flex-end' }}>
            <div className="pk-subbar-rage-track">
              <div className="pk-pg-hp-inner">
                <div
                  className="pk-subbar-rage"
                  style={{ width: `${enemyRagePct}%`, marginLeft: 'auto' }}
                />
              </div>
              <span
                className="pk-num-font"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#fff275',
                  textShadow: '0 1px 2px #000',
                }}
              >
                Nộ: {enemyFighter.rage}/{enemyFighter.maxRage}
              </span>
            </div>

            <div className="pk-subbar-track">
              <div className="pk-pg-hp-inner">
                <div
                  className="pk-subbar-mana"
                  style={{ width: `${enemyManaPct}%`, marginLeft: 'auto' }}
                />
              </div>
              <span
                className="pk-num-font"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#7ef3ff',
                  textShadow: '0 1px 2px #000',
                }}
              >
                Mana: {enemyFighter.mana}/{enemyFighter.maxMana}
              </span>
            </div>
          </div>
        </div>

        {/* TOP-RIGHT SOUND/INFO BADGE SPACE */}
        <div
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={ELEMENT_META[enemyFighter.element].iconPath}
            alt={enemyFighter.element}
            style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px #000)' }}
          />
        </div>
      </div>

      {/* ==================== FULL-ARENA PUKIWO BATTLEFIELD ==================== */}
      <div className="pk-battle-main">
        {/* PLAYER SIDE CARD */}
        <div className="pk-side-card pk-side-card-left">
          <img
            src={`/assets/pokiguard/avatars/${playerAvatarId}.png`}
            alt={playerName}
            style={{
              width: 46,
              height: 54,
              objectFit: 'cover',
              objectPosition: 'top center',
              borderRadius: 8,
              border: '1.5px solid #fbbf24',
              background: 'rgba(2, 6, 23, 0.5)',
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 12,
                color: '#fef08a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {playerName}
            </div>
            <div style={{ fontSize: 10, color: '#93c5fd', fontWeight: 700 }}>
              Lv.{myFighter.level} • Công {myFighter.attack}
            </div>
            {renderStatusChips(myFighter)}
          </div>
          {isYourTurn && (
            <img
              src="/assets/pokiguard/sprites/turn.png"
              alt="Lượt của bạn"
              style={{
                position: 'absolute',
                right: -18,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 28,
                height: 36,
                objectFit: 'contain',
              }}
            />
          )}
        </div>

        {/* ENEMY SIDE CARD */}
        <div className="pk-side-card pk-side-card-right">
          <img
            src={
              isBossStage
                ? getPetSpritePath(getPetById(enemyFighter.petId))
                : '/assets/pokiguard/avatars/34.png'
            }
            alt={opponentName}
            style={{
              width: 48,
              height: 54,
              objectFit: isBossStage ? 'contain' : 'cover',
              objectPosition: 'top center',
              borderRadius: 8,
              border: '1.5px solid #f87171',
              background: 'radial-gradient(circle, rgba(127,29,29,0.75), rgba(2,6,23,0.9))',
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 11.5,
                color: '#fecdd3',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={opponentName}
            >
              {enemyFighter.name}
            </div>
            <div style={{ fontSize: 10, color: '#fda4af', fontWeight: 700 }}>
              Lv.{enemyFighter.level} • Công {enemyFighter.attack}
            </div>
            {renderStatusChips(enemyFighter)}
          </div>
          {!isYourTurn && !battleState.winner && (
            <img
              src="/assets/pokiguard/sprites/turn.png"
              alt="Lượt địch"
              style={{
                position: 'absolute',
                left: -18,
                top: '50%',
                transform: 'translateY(-50%) scaleX(-1)',
                width: 28,
                height: 36,
                objectFit: 'contain',
              }}
            />
          )}
        </div>

        {/* CO-OP 3V1 TEAMMATE MINI-CARDS WHEN MERCENARIES HIRED */}
        {(mercenaryCount ?? myFighter.allyCount ?? 0) > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              top: 86,
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
                style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: '50%', background: '#0b1b44' }}
              />
              <span style={{ fontSize: 10, fontWeight: 900, color: '#fef08a' }}>
                Kiếm Thánh <span style={{ color: '#7dd3fc' }}>+15% Công/HP</span>
              </span>
            </div>
            {(mercenaryCount ?? myFighter.allyCount ?? 0) >= 2 && (
              <div className="pk-coop-ally-badge" style={{ borderColor: 'rgba(251, 146, 60, 0.8)' }}>
                <img
                  src="/assets/pokiguard/pets/1498.png"
                  alt="Hỏa Vương"
                  style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: '50%', background: '#2a0f08' }}
                />
                <span style={{ fontSize: 10, fontWeight: 900, color: '#fed7aa' }}>
                  Hỏa Vương <span style={{ color: '#fde047' }}>+15% Phép/+45M</span>
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
              top: 96,
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
              top: 96,
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

        {/* PUKIWO MAGIC HEXAGRAM RUNE BEHIND ACTIVE TURN FIGHTER */}
        {!battleState.winner && (
          <svg
            viewBox="0 0 200 200"
            className="pk-magic-rune"
            style={{
              left: isYourTurn ? '16.5%' : '83.5%',
            }}
          >
            <g
              fill="none"
              stroke={isYourTurn ? '#f472b6' : '#f87171'}
              strokeWidth="2.5"
              opacity="0.9"
            >
              <circle cx="100" cy="100" r="88" />
              <circle cx="100" cy="100" r="76" strokeDasharray="8 6" />
              <circle cx="100" cy="100" r="46" />
              <polygon points="100,14 174,142 26,142" />
              <polygon points="100,186 26,58 174,58" />
            </g>
          </svg>
        )}

        {/* PET HỘ VỆ (SUPPORT PET) MEDALLION CHUẨN POKIWAR 4.0 */}
        {myFighter.guardPetSpriteId && (
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: (mercenaryCount ?? myFighter.allyCount ?? 0) > 0 ? 156 : 86,
              zIndex: 17,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 9px 4px 5px',
              borderRadius: 999,
              background: 'rgba(6, 20, 56, 0.92)',
              border: '1.5px solid #fde047',
              boxShadow: '0 4px 12px rgba(0,0,0,0.75)',
              pointerEvents: 'none',
            }}
          >
            <img
              src={`/assets/pokiguard/pets/${myFighter.guardPetSpriteId}.png`}
              alt={myFighter.guardPetName ?? 'Hộ Vệ'}
              style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: '50%', background: '#0f172a' }}
            />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontSize: 9.5, fontWeight: 900, color: '#fde047' }}>
                🛡️ Hộ Vệ: {myFighter.guardPetName}
              </div>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: '#4ade80' }}>+16% HP/Công/Phép</div>
            </div>
          </div>
        )}

        {/* FULL ARENA PIXI MONSTER STAGE (PETS FACING ACROSS THE CENTER BOARD) */}
        <div className="pk-battle-stage-layer">
          <SpineStageCanvas
            width={1280}
            height={492}
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
            scaleMultiplier={1.06}
          />
        </div>

        {/* RATING STARS (UP TO 6★) & REVIVAL HEARTS UNDER EACH PET */}
        {[
          { left: '16.5%', stars: myFighter.stars, tier: myFighter.tier, revives: myFighter.reviveCharges ?? 0 },
          { left: '83.5%', stars: enemyFighter.stars, tier: enemyFighter.tier, revives: enemyFighter.reviveCharges ?? 0 },
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
                top: 394,
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
                      width: 18,
                      height: 18,
                      objectFit: 'contain',
                      filter: i === 5 && lit >= 6 ? 'hue-rotate(250deg) saturate(1.9)' : undefined,
                    }}
                  />
                ))}
              </div>
              {rInfo.revives > 0 && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: '#fb7185',
                    textShadow: '0 1px 3px #000',
                    background: 'rgba(15, 23, 42, 0.85)',
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

        {/* FLOATING DAMAGE / HEAL NUMBERS ABOVE EACH PET */}
        {popups.map((p, idx) => (
          <div
            key={p.id}
            className="pk-floating-dmg"
            style={{
              left: p.side === yourSide ? '16.5%' : '83.5%',
              top: `${88 + (idx % 4) * 32}px`,
              transform: 'translateX(-50%)',
              color: p.color,
            }}
          >
            {p.text}
          </div>
        ))}

        {/* CENTERED NON-OCCLUDING DRAWER FOR 6 NGỌC & CHIÊU ĐỊCH */}
        {showInfoDrawer && (
          <div
            className="pk-stone-panel"
            style={{
              position: 'absolute',
              left: '50%',
              top: '42%',
              transform: 'translate(-50%, -50%)',
              zIndex: 48,
              width: 344,
              padding: '11px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 16px 38px rgba(0, 0, 0, 0.94)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#fde047' }}>
                6 NGỌC POKIWAR (HỆ SỐ x1–x4)
              </span>
              <button
                type="button"
                className="pk-btn-blue"
                style={{ padding: '2px 8px', fontSize: 10 }}
                onClick={() => setShowInfoDrawer(false)}
              >
                Đóng
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 5 }}>
              {GEM_TYPES.map((gType) => (
                <div
                  key={gType}
                  title={GEM_META[gType].effectHint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 6px',
                    borderRadius: 6,
                    background: 'rgba(6, 18, 46, 0.88)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                  }}
                >
                  <img
                    src={GEM_META[gType].spritePath}
                    alt={GEM_META[gType].label}
                    style={{ width: 18, height: 18, objectFit: 'contain' }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 800, color: GEM_META[gType].color }}>
                    {GEM_META[gType].label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#fda4af', marginBottom: 4 }}>
                CHIÊU THỨC ĐỐI THỦ
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {enemyFighter.skills.length === 0 ? (
                  <div style={{ fontSize: 10.5, color: '#94a3b8', padding: '4px 6px' }}>
                    Pet Thường — chiến đấu bằng 6 Ngọc Match-3 &amp; Thẻ Chưởng.
                  </div>
                ) : (
                  enemyFighter.skills.map((sk) => (
                    <div
                      key={sk.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        padding: '4px 7px',
                        borderRadius: 6,
                        background: 'rgba(69, 10, 10, 0.56)',
                        border: '1px solid rgba(248, 113, 113, 0.35)',
                      }}
                    >
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fecdd3' }}>★ {sk.name}</span>
                      <span style={{ fontSize: 9.5, color: '#fca5a5' }}>{sk.rageCost}N/{sk.manaCost ?? 0}M</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* CENTERED 8x8 MATCH-3 BOARD + HORIZONTAL PUKIWO CARD DOCK UNDERNEATH */}
        <div className="pk-battle-center">
          {/* BOARD WRAPPER */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div
              className="pk-pow-badge"
              title={`Nộ hiện tại: ${myFighter.rage}/${myFighter.maxRage} • Mana: ${myFighter.mana}/${myFighter.maxMana}`}
            >
              <span>POW</span>
            </div>

            <div className={`pk-board-shell ${boardFaded ? 'faded' : ''}`}>
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
            {collectedGems.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: boardFaded ? '30%' : -26,
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 44,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, rgba(15, 34, 78, 0.96), rgba(6, 15, 40, 0.96))',
                  border: '2px solid #fde047',
                  boxShadow: '0 8px 26px rgba(0, 0, 0, 0.85), 0 0 18px rgba(250, 204, 21, 0.55)',
                  pointerEvents: 'none',
                  transition: 'top 0.22s ease',
                  whiteSpace: 'nowrap',
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

            {/* MATCHED GEM xN / SKILL CARD CALLOUT OVER FADED BOARD */}
            {parsedCallout && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '48%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 35,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 22px',
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
                    fontSize: 15,
                    fontWeight: 900,
                    color: '#fef08a',
                    textShadow: '0 2px 4px #000',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {parsedCallout.text}
                </div>
              </div>
            )}

            {/* BRIEF YOUR_TURN SPLASH BANNER */}
            {turnSplashKey > 0 && isYourTurn && !boardFaded && !parsedCallout && !pendingQteSkill && !pendingBurnSkill && (
              <img
                key={turnSplashKey}
                src="/assets/pokiguard/sprites/your_turn.png"
                alt="Lượt của bạn"
                className="pk-your-turn-splash"
                style={{ width: 220, objectFit: 'contain' }}
              />
            )}
          </div>

          {/* CENTERED HORIZONTAL POKIGUARD CARD DOCK (HÓA THẦN | CHƯỞNG | 3 HỖ TRỢ | 3 SKILL PET) */}
          <div className="pk-card-dock">
            {/* Thẻ Hóa Thần (Turn 2+, 120 Mana, Free Action, giữ nguyên ngoại hình Pet độc lập) */}
            <button
              type="button"
              className={`pk-func-card ${canInBattleEvolve ? 'ready' : ''}`}
              disabled={!canInBattleEvolve}
              onClick={onInBattleEvolve}
              title={
                !evolveUnlocked
                  ? 'Thẻ Hóa Thần mở khóa từ Lượt 2 trở đi (Lượt đầu tiên phải đi trên bàn cờ)'
                  : 'Hóa Thần trong trận: tốn 120 Mana, KHÔNG mất lượt (+70% HP, +200 Max Mana, +20% Công/Phép, giữ nguyên ngoại hình Pet)'
              }
            >
              <div
                style={{
                  position: 'relative',
                  width: 60,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img src={evoPreviewImg} alt="Hóa Thần" style={{ width: 42, height: 42, objectFit: 'contain' }} />
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    fontSize: 7.8,
                    fontWeight: 900,
                    padding: '1px 4px',
                    borderRadius: 999,
                    background: myFighter.inBattleEvolved
                      ? '#334155'
                      : !evolveUnlocked
                        ? '#991b1b'
                        : '#b45309',
                    border: '1px solid #fde047',
                    color: '#fef08a',
                  }}
                >
                  {myFighter.inBattleEvolved ? 'XONG' : !evolveUnlocked ? 'L2+' : '120M'}
                </span>
              </div>
              <div
                style={{
                  marginTop: 7,
                  height: 20,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8.8,
                  fontWeight: 900,
                  color: '#ffffff',
                  textShadow: '0 1px 2px #000',
                }}
              >
                {myFighter.inBattleEvolved ? 'Đã Hóa' : 'Hóa Thần'}
              </div>
              <div
                style={{
                  marginTop: 'auto',
                  marginBottom: 1,
                  height: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8.2,
                  fontWeight: 900,
                  color: '#3f1802',
                }}
              >
                {myFighter.inBattleEvolved ? '+70% HP' : 'Free Lượt'}
              </div>
            </button>

            {/* Thẻ Chưởng (160 Mana) */}
            <button
              type="button"
              className={`pk-func-card ${canDefaultCast ? 'ready' : ''}`}
              disabled={!canDefaultCast}
              onClick={onDefaultCast}
              title="Thẻ Chưởng Mặc Định: tốn 160 Mana, bắn chưởng 2.15x Phép (Kết thúc lượt)"
            >
              <div
                style={{
                  position: 'relative',
                  width: 60,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src="/assets/pokiguard/cards/card1.png"
                  alt="Thẻ Chưởng"
                  style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1px solid #38bdf8' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    fontSize: 7.8,
                    fontWeight: 900,
                    padding: '1px 4px',
                    borderRadius: 999,
                    background: canDefaultCast ? '#0284c7' : '#334155',
                    border: '1px solid #7dd3fc',
                    color: '#fff',
                  }}
                >
                  160M
                </span>
              </div>
              <div
                style={{
                  marginTop: 7,
                  height: 20,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8.6,
                  fontWeight: 900,
                  color: '#ffffff',
                  textShadow: '0 1px 2px #000',
                }}
              >
                Thẻ Chưởng
              </div>
              <div
                style={{
                  marginTop: 'auto',
                  marginBottom: 1,
                  height: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8.2,
                  fontWeight: 900,
                  color: '#3f1802',
                }}
              >
                2.15x Phép
              </div>
            </button>

            {/* Thẻ Bài Hợp Thể (Pokiwar 4.0 Pet Hợp Thể Combined Strike — 1x/trận) */}
            {myFighter.fusionPetId && onFusionStrike && !battleState.restrictedRules && (() => {
              const canFusion =
                boardInteractive &&
                !myFighter.fusionStrikeUsed &&
                myFighter.rage >= 50 &&
                myFighter.mana >= 60;
              return (
                <button
                  type="button"
                  className={`pk-func-card ${canFusion ? 'ready' : ''}`}
                  disabled={!canFusion}
                  onClick={onFusionStrike}
                  title={`Thẻ Bài Hợp Thể (${myFighter.fusionPetName}): tốn 50 Nộ + 60 Mana, tung Hợp Thể Liên Kích 1.95x + Vết Thương Sâu + Hồi Máu & Giáp (1 lần/trận)`}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: 60,
                      height: 52,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={getPetSpritePath(getPetById(myFighter.fusionPetId))}
                      alt={myFighter.fusionPetName ?? 'Hợp Thể'}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 6,
                        objectFit: 'contain',
                        background: 'radial-gradient(circle, rgba(168,85,247,0.45), rgba(15,23,42,0.9))',
                        border: '1.5px solid #c084fc',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        fontSize: 7.5,
                        fontWeight: 900,
                        padding: '1px 4px',
                        borderRadius: 999,
                        background: myFighter.fusionStrikeUsed ? '#334155' : canFusion ? '#9333ea' : '#475569',
                        border: '1px solid #e9d5ff',
                        color: '#fff',
                      }}
                    >
                      {myFighter.fusionStrikeUsed ? 'XONG' : '50N'}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 7,
                      height: 20,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8.6,
                      fontWeight: 900,
                      color: '#f5d0fe',
                      textShadow: '0 1px 2px #000',
                    }}
                  >
                    Hợp Thể
                  </div>
                  <div
                    style={{
                      marginTop: 'auto',
                      marginBottom: 1,
                      height: 15,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8,
                      fontWeight: 900,
                      color: '#3f1802',
                    }}
                  >
                    {myFighter.fusionStrikeUsed ? 'Đã Dùng' : 'Liên Kích'}
                  </div>
                </button>
              );
            })()}

            {/* 3 Thẻ Hỗ Trợ Pokiwar (từ bộ thẻ người chơi trang bị, có Luyện Thẻ Lv.1..5) */}
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
                  className="pk-support-card"
                  disabled={!usable}
                  onClick={() => onSupportCard(cId)}
                  title={`${card.name} Lv.${cLv} (${scaledLabel}): ${card.description} — Dùng 1 lần/trận, không mất lượt`}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: 50,
                      height: 48,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={card.image}
                      alt={card.name}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 6,
                        objectFit: 'cover',
                        border: '1px solid #fbbf24',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: -1,
                        right: -2,
                        fontSize: 7.2,
                        fontWeight: 900,
                        padding: '0 3px',
                        borderRadius: 999,
                        background: used ? '#334155' : '#0369a1',
                        border: '1px solid #38bdf8',
                        color: used ? '#94a3b8' : '#fef08a',
                      }}
                    >
                      {used ? 'HẾT' : `Lv.${cLv}`}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      height: 19,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8.1,
                      fontWeight: 900,
                      color: '#ffffff',
                      textShadow: '0 1px 2px #000',
                    }}
                  >
                    {scaledLabel}
                  </div>
                  <div
                    style={{
                      marginTop: 'auto',
                      marginBottom: 1,
                      height: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 7.8,
                      fontWeight: 900,
                      color: '#3f1802',
                    }}
                  >
                    {used ? 'Đã dùng' : 'Hỗ Trợ'}
                  </div>
                </button>
              );
            })}

            <div
              style={{
                width: 1.5,
                height: 102,
                alignSelf: 'center',
                background: 'linear-gradient(180deg, transparent, rgba(250,204,21,0.65), transparent)',
                margin: '0 2px',
              }}
            />

            {/* 3 Pet Signature Skill Cards (including Pokiwar 4.0 Special Skill Card!) */}
            {myFighter.skills.map((sk) => {
              const cd = myFighter.cooldowns[sk.id] ?? 0;
              const manaReq = sk.manaCost ?? 0;
              const enoughRes = myFighter.rage >= sk.rageCost && myFighter.mana >= manaReq;
              const canCast = boardInteractive && cd === 0 && enoughRes;
              const badgeText =
                sk.boardEffect === 'SEAL_REGION'
                  ? 'KẾT ẤN'
                  : sk.boardEffect === 'BURN_ROWS'
                    ? `${sk.burnRowCount ?? 3} HÀNG`
                    : sk.boardEffect === 'CROSS_EXPLODE'
                      ? '2 CHỮ THẬP'
                      : sk.boardEffect === 'BOMB_3X3'
                        ? '3 BOM'
                        : sk.boardEffect === 'CONSUME_GEMS'
                          ? 'ĂN NGỌC'
                          : sk.boardEffect === 'FATE_CARD'
                            ? '3 LÁ BÀI'
                            : sk.isSpecialCard && !sk.needPerfection
                              ? 'NO-QTE'
                              : sk.needPerfection
                                ? 'QTE'
                                : null;
              const footerText =
                sk.boardEffect === 'SEAL_REGION'
                  ? 'Phong Ấn 5×5'
                  : sk.boardEffect === 'BURN_ROWS'
                    ? `Thiêu ${sk.burnRowCount ?? 3} Hàng`
                    : sk.boardEffect === 'CROSS_EXPLODE'
                      ? 'Nổ Chữ Thập'
                      : sk.boardEffect === 'BOMB_3X3'
                        ? 'Bom 3×3'
                        : sk.boardEffect === 'CONSUME_GEMS'
                          ? 'Hút Ngọc Bàn'
                          : sk.boardEffect === 'FATE_CARD'
                            ? 'Rút Thần Bài'
                            : sk.powerRatio > 0
                              ? `${sk.powerRatio}x Công`
                              : 'Hỗ Trợ';
              const fullTooltip = `${sk.isSpecialCard ? '★ THẺ KỸ NĂNG ĐẶC BIỆT POKIWAR 4.0 ★\n' : ''}${sk.name} (${sk.rageCost} Nộ / ${manaReq} Mana)\n${sk.description}${sk.specialPassiveNote ? `\n• Bị động: ${sk.specialPassiveNote}` : ''}`;
              return (
                <button
                  key={sk.id}
                  type="button"
                  title={fullTooltip}
                  className={`pk-skill-card ${canCast ? 'ready' : ''}`}
                  style={
                    sk.isSpecialCard
                      ? {
                          boxShadow: canCast
                            ? '0 0 14px rgba(250, 204, 21, 0.9), inset 0 0 10px rgba(250, 204, 21, 0.4)'
                            : '0 0 6px rgba(250, 204, 21, 0.45)',
                          borderColor: '#fde047',
                        }
                      : undefined
                  }
                  disabled={!canCast}
                  onClick={() => handleSkillClick(sk)}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: 66,
                      height: 52,
                      marginTop: 1,
                      borderRadius: 5,
                      overflow: 'hidden',
                      border: sk.isSpecialCard ? '2px solid #fef08a' : '1.5px solid #fbbf24',
                      background: '#051233',
                    }}
                  >
                    <img
                      src={sk.cardImage}
                      alt={sk.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        padding: '0 3px',
                        borderRadius: 999,
                        background: enoughRes ? '#ea580c' : 'rgba(15,23,42,0.88)',
                        border: '1px solid #fde047',
                        fontSize: 7.5,
                        fontWeight: 900,
                        color: '#fff',
                      }}
                    >
                      {sk.rageCost > 0 ? `${sk.rageCost}N` : '0N'}
                      {manaReq > 0 ? `/${manaReq}M` : ''}
                    </div>
                    {badgeText && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          left: 2,
                          padding: '0 3px',
                          borderRadius: 3,
                          background: sk.isSpecialCard ? '#dc2626' : sk.boardEffect === 'BURN_ROWS' ? '#f97316' : '#facc15',
                          color: sk.isSpecialCard || sk.boardEffect === 'BURN_ROWS' ? '#fef08a' : '#451a03',
                          border: sk.isSpecialCard ? '1px solid #fde047' : 'none',
                          fontSize: 7,
                          fontWeight: 900,
                        }}
                      >
                        {badgeText}
                      </div>
                    )}

                    {cd > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(2, 6, 23, 0.78)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 15,
                          fontWeight: 900,
                          color: '#fde047',
                        }}
                      >
                        {cd}L
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      height: 21,
                      width: '100%',
                      padding: '0 2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8.2,
                      fontWeight: 900,
                      color: sk.isSpecialCard ? '#fef08a' : '#ffffff',
                      textAlign: 'center',
                      lineHeight: 1.04,
                      textShadow: '0 1px 2px #000',
                    }}
                  >
                    {sk.name}
                  </div>

                  <div
                    style={{
                      marginTop: 'auto',
                      marginBottom: 2,
                      height: 15,
                      padding: '0 4px',
                      borderRadius: 4,
                      background: 'rgba(15, 23, 42, 0.78)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8,
                      fontWeight: 900,
                      color: '#fef08a',
                      textShadow: '0 1px 1px #000',
                    }}
                  >
                    {footerText}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* BOTTOM-LEFT WING: PET NAMEPLATE + MATCH CONTROLS */}
        <div className="pk-corner-anchor-left">
          <div className="pk-nameplate-left">
            <img
              src={ELEMENT_META[myFighter.element].iconPath}
              alt={myFighter.element}
              style={{ width: 26, height: 26, objectFit: 'contain' }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 13,
                  color: '#fff',
                  textShadow: '0 1px 2px #000',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {myFighter.name}
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fef08a' }}>
                Lv.{myFighter.level} ({myFighter.tier}) • Thủ {myFighter.defense}
              </div>
            </div>
          </div>

          <div
            className="pk-stone-panel"
            style={{
              width: '100%',
              padding: '6px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
              <span style={{ color: '#7dd3fc', fontWeight: 800 }}>{modeLabel}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#fde047', fontWeight: 800 }}>
                  +{battleState.bonusGold[yourSide] ?? 0} Vàng
                </span>
                <button
                  type="button"
                  className="pk-btn-gold"
                  style={{ padding: '1px 6px', fontSize: 11, lineHeight: 1.2 }}
                  title="Gửi Biểu Cảm Pokiwar"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                >
                  😊
                </button>
              </div>
            </div>
            {showEmojiPicker && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 132,
                  width: 244,
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
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                type="button"
                className="pk-btn-blue"
                style={{ flex: 1, padding: '5px 6px', fontSize: 11 }}
                disabled={!boardInteractive}
                onClick={onHint}
              >
                Gợi ý
              </button>
              <button
                type="button"
                className={myFighter.consecutivePasses >= 2 ? 'pk-btn-red' : 'pk-btn-blue'}
                style={{ flex: 1.2, padding: '5px 6px', fontSize: 11 }}
                disabled={!canPass}
                title="Bỏ lượt (Tối đa 2 lần liên tiếp — Lần 3 sẽ thua trận!)"
                onClick={onPassTurn}
              >
                {myFighter.consecutivePasses >= 2
                  ? 'Cấm Bỏ!'
                  : `Bỏ (${myFighter.consecutivePasses}/2)`}
              </button>
              <button
                type="button"
                className="pk-btn-red"
                style={{ padding: '5px 9px', fontSize: 11 }}
                onClick={onLeave}
              >
                Rời
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM-RIGHT WING: COMPACT LOG + ENEMY NAMEPLATE */}
        <div className="pk-corner-anchor-right">
          <div
            className="pk-stone-panel"
            style={{
              width: '100%',
              padding: '6px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: '#fef08a',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={recentLogs[0] ?? 'Sẵn sàng giao chiến'}
            >
              {recentLogs[0] ? `• ${recentLogs[0]}` : '• Đi 1 lượt bàn cờ để mở Tiến Hóa'}
            </div>
            <button
              type="button"
              className="pk-btn-blue"
              style={{ width: '100%', padding: '5px 8px', fontSize: 11 }}
              onClick={() => setShowInfoDrawer((v) => !v)}
            >
              {showInfoDrawer ? 'Đóng Chiêu & Ngọc ▼' : '6 Ngọc & Chiêu Địch ▲'}
            </button>
          </div>

          <div className="pk-nameplate-right">
            <div style={{ minWidth: 0, textAlign: 'right' }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 13,
                  color: '#3f1802',
                  textShadow: '0 1px 0 rgba(255, 255, 255, 0.65)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {enemyFighter.name}
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#7c2d12' }}>
                Lv.{enemyFighter.level} ({enemyFighter.tier}) • Thủ {enemyFighter.defense}
              </div>
            </div>
            <img
              src={ELEMENT_META[enemyFighter.element].iconPath}
              alt={enemyFighter.element}
              style={{ width: 26, height: 26, objectFit: 'contain' }}
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
