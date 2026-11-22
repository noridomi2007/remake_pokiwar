import type { QteGrade } from '@pokiwar/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ArrowDir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface QteAuditionModalProps {
  skillName: string;
  cardImage?: string;
  onComplete: (grade: QteGrade) => void;
}

const DIRS: readonly ArrowDir[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

const DIR_META: Record<ArrowDir, { symbol: string; bg: string; label: string }> = {
  UP: {
    symbol: '⬆',
    bg: 'radial-gradient(circle at 35% 30%, #bbf7d0, #22c55e 55%, #15803d 100%)',
    label: 'Lên',
  },
  DOWN: {
    symbol: '⬇',
    bg: 'radial-gradient(circle at 35% 30%, #fef08a, #f59e0b 55%, #b45309 100%)',
    label: 'Xuống',
  },
  LEFT: {
    symbol: '⬅',
    bg: 'radial-gradient(circle at 35% 30%, #fbcfe8, #ec4899 55%, #9d174d 100%)',
    label: 'Trái',
  },
  RIGHT: {
    symbol: '➡',
    bg: 'radial-gradient(circle at 35% 30%, #bae6fd, #0ea5e9 55%, #0369a1 100%)',
    label: 'Phải',
  },
};

const KEY_TO_DIR: Record<string, ArrowDir> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  w: 'UP',
  W: 'UP',
  s: 'DOWN',
  S: 'DOWN',
  a: 'LEFT',
  A: 'LEFT',
  d: 'RIGHT',
  D: 'RIGHT',
};

const TOTAL_DURATION_MS = 5600;

export function QteAuditionModal({ skillName, onComplete }: QteAuditionModalProps) {
  const sequence = useMemo<ArrowDir[]>(
    () => Array.from({ length: 7 }, () => DIRS[Math.floor(Math.random() * DIRS.length)]),
    [],
  );

  const [step, setStep] = useState(0);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [cursorPct, setCursorPct] = useState(0);
  const [resolvedGrade, setResolvedGrade] = useState<QteGrade | null>(null);

  const doneRef = useRef(false);
  const startRef = useRef(performance.now());
  const stepRef = useRef(0);
  stepRef.current = step;

  const finishWithGrade = useCallback(
    (grade: QteGrade) => {
      if (doneRef.current) return;
      doneRef.current = true;
      setResolvedGrade(grade);
      setTimeout(() => {
        onComplete(grade);
      }, 650);
    },
    [onComplete],
  );

  // Smooth PokiGuard timing slider (0 -> 100%, golden star sweet-spot 58%..82%)
  useEffect(() => {
    let rafId = 0;
    const tick = (now: number) => {
      if (doneRef.current) return;
      const elapsed = now - startRef.current;
      const pct = Math.min(100, (elapsed / TOTAL_DURATION_MS) * 100);
      setCursorPct(pct);
      if (elapsed >= TOTAL_DURATION_MS) {
        finishWithGrade(stepRef.current >= sequence.length ? 'GOOD' : 'BAD');
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [finishWithGrade, sequence.length]);

  const handleDirInput = useCallback(
    (dir: ArrowDir) => {
      if (doneRef.current) return;
      const cur = stepRef.current;
      if (cur >= sequence.length) return;
      if (sequence[cur] === dir) {
        setStep(cur + 1);
      } else {
        setShakeIdx(cur);
        setStep(0);
        setTimeout(() => setShakeIdx(null), 240);
      }
    },
    [sequence],
  );

  const handleTouchBeat = useCallback(() => {
    if (doneRef.current) return;
    if (stepRef.current < sequence.length) {
      finishWithGrade('BAD');
      return;
    }
    const pct = Math.min(100, ((performance.now() - startRef.current) / TOTAL_DURATION_MS) * 100);
    if (pct >= 58 && pct <= 82) {
      finishWithGrade('PERFECT');
    } else if (pct >= 42 && pct <= 93) {
      finishWithGrade('GOOD');
    } else {
      finishWithGrade('BAD');
    }
  }, [finishWithGrade, sequence.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (doneRef.current) return;
      const mapped = KEY_TO_DIR[e.key];
      if (mapped) {
        e.preventDefault();
        handleDirInput(mapped);
        return;
      }
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleTouchBeat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDirInput, handleTouchBeat]);

  const arrowsDone = step >= sequence.length;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 75,
        background: 'rgba(2, 6, 20, 0.3)',
        pointerEvents: 'auto',
      }}
    >
      {/* CENTER 4-DIRECTION AUDITION SEQUENCE OR PERFECT 7-STAR SPLASH */}
      {!resolvedGrade ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '36%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                fontStyle: 'italic',
                letterSpacing: 1.5,
                color: '#f472b6',
                textShadow: '0 2px 0 #4a044e, 0 0 12px rgba(236, 72, 153, 0.9)',
              }}
            >
              AUDITION
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 900,
                color: '#fef08a',
                textShadow: '0 1.5px 3px #000',
              }}
            >
              — {skillName.toUpperCase()} (▲ ▼ ◀ ▶ + SPACE)
            </span>
          </div>

          {/* Glowing Magenta/Purple Pill with 7 Circular 4-Direction Arrows */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 22px',
              borderRadius: 999,
              background: 'linear-gradient(180deg, rgba(147, 51, 234, 0.8) 0%, rgba(76, 29, 149, 0.92) 100%)',
              border: '3px solid #f0abfc',
              boxShadow: '0 0 28px rgba(217, 70, 239, 0.72), inset 0 2px 10px rgba(255, 255, 255, 0.35)',
            }}
          >
            {sequence.map((dir, idx) => {
              const done = idx < step;
              const current = idx === step;
              const wrong = shakeIdx === idx;
              const meta = DIR_META[dir];
              return (
                <div
                  key={idx}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done
                      ? 'radial-gradient(circle at 35% 30%, #dcfce7, #4ade80 55%, #15803d 100%)'
                      : wrong
                        ? 'radial-gradient(circle at 35% 30%, #fca5a5, #dc2626 60%, #7f1d1d 100%)'
                        : meta.bg,
                    border: current ? '3.5px solid #fef08a' : '3px solid #ffffff',
                    opacity: done ? 0.5 : 1,
                    transform: current ? 'scale(1.14)' : done ? 'scale(0.92)' : 'scale(1)',
                    boxShadow: current
                      ? '0 0 18px #fde047, 0 4px 10px rgba(0,0,0,0.65)'
                      : '0 4px 10px rgba(0,0,0,0.55)',
                    transition: 'transform 0.1s ease, opacity 0.12s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      color: '#ffffff',
                      lineHeight: 1,
                      textShadow: '0 2px 3px rgba(0,0,0,0.65)',
                    }}
                  >
                    {meta.symbol}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* AUTHENTIC POKIGUARD RESULT SPLASH (PERFECT + 7 GOLD STARS + SÁT THƯƠNG ×1.5) */
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '31%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            animation: 'pkBannerPop 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div
            style={{
              fontSize: 54,
              fontWeight: 900,
              letterSpacing: 2,
              lineHeight: 1,
              background:
                resolvedGrade === 'PERFECT'
                  ? 'linear-gradient(180deg, #fffbeb 0%, #fde047 48%, #f59e0b 100%)'
                  : resolvedGrade === 'GOOD'
                    ? 'linear-gradient(180deg, #e0f2fe 0%, #38bdf8 55%, #0284c7 100%)'
                    : 'linear-gradient(180deg, #fecaca 0%, #ef4444 60%, #991b1b 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 4px 0 #1e1b4b) drop-shadow(0 0 22px rgba(250, 204, 21, 0.85))',
            }}
          >
            {resolvedGrade === 'BAD' ? 'MISS' : resolvedGrade}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            {Array.from({ length: resolvedGrade === 'PERFECT' ? 7 : resolvedGrade === 'GOOD' ? 4 : 1 }).map((_, idx) => (
              <img
                key={idx}
                src="/assets/pokiguard/sprites/gold_star.png"
                alt="★"
                style={{
                  width: 30,
                  height: 30,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 6px rgba(250, 204, 21, 0.9))',
                }}
              />
            ))}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 21,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: 0.8,
              textShadow: '0 2px 0 #0f172a, 0 0 12px rgba(0, 0, 0, 0.9)',
            }}
          >
            {resolvedGrade === 'PERFECT'
              ? 'SÁT THƯƠNG ×1.5'
              : resolvedGrade === 'GOOD'
                ? 'SÁT THƯƠNG ×1.15'
                : 'SÁT THƯƠNG ×0.8'}
          </div>
        </div>
      )}

      {/* BOTTOM CONTROL CLUSTER: ORANGE "TOUCH HERE!" SLIDER + 4-DIRECTION TOUCH BUTTONS (▲ ▼ ◀ ▶) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 58,
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        {/* ORANGE "TOUCH HERE!" TIMING SLIDER BAR */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleTouchBeat}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleTouchBeat();
          }}
          style={{
            width: 470,
            height: 68,
            padding: '12px 18px',
            borderRadius: 999,
            background: arrowsDone
              ? 'linear-gradient(180deg, #fbbf24 0%, #f97316 55%, #ea580c 100%)'
              : 'linear-gradient(180deg, #f59e0b 0%, #d97706 60%, #b45309 100%)',
            border: arrowsDone ? '3px solid #fef08a' : '3px solid #fed7aa',
            boxShadow: arrowsDone
              ? '0 0 32px rgba(251, 191, 36, 0.95), 0 8px 24px rgba(0,0,0,0.85)'
              : '0 8px 24px rgba(0,0,0,0.82)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 40,
              borderRadius: 999,
              background: 'linear-gradient(180deg, #270e02 0%, #431407 100%)',
              border: '2px solid rgba(0, 0, 0, 0.75)',
              boxShadow: 'inset 0 4px 10px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden',
            }}
          >
            {/* Gold Sweet-Spot Zone (58%..82%) */}
            <div
              style={{
                position: 'absolute',
                left: '58%',
                width: '24%',
                top: 0,
                bottom: 0,
                background: 'linear-gradient(180deg, rgba(253, 224, 71, 0.65), rgba(217, 119, 6, 0.78))',
                borderLeft: '2px solid #fef08a',
                borderRight: '2px solid #fef08a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: '100%',
                  background: 'linear-gradient(180deg, #fef9c3, #facc15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 12px rgba(254, 240, 138, 0.95)',
                }}
              >
                <span style={{ fontSize: 18, color: '#92400e', fontWeight: 900 }}>★</span>
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                left: 18,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: 0.6,
                color: arrowsDone ? '#fef08a' : 'rgba(254, 215, 170, 0.75)',
                textShadow: '0 2px 0 #451a03',
                opacity: cursorPct < 45 ? 0.35 : 0.95,
                transition: 'opacity 0.14s ease',
                pointerEvents: 'none',
              }}
            >
              {arrowsDone ? 'TOUCH HERE! (SPACE)' : 'TOUCH HERE!'}
            </div>

            <div
              style={{
                position: 'absolute',
                left: `${cursorPct}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'radial-gradient(circle, #ef4444 0%, #ef4444 26%, #ffffff 28%, #ffffff 52%, #f97316 56%, #7c2d12 100%)',
                border: '2.5px solid #fef08a',
                boxShadow: '0 0 14px rgba(254, 240, 138, 0.95), 0 2px 6px rgba(0,0,0,0.85)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* 4 RESPONSIVE ARCADE DIRECTIONAL TOUCH BUTTONS (◀ ▲ ▼ ▶) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {(['LEFT', 'UP', 'DOWN', 'RIGHT'] as const).map((dir) => {
            const meta = DIR_META[dir];
            return (
              <button
                key={dir}
                type="button"
                onClick={() => handleDirInput(dir)}
                disabled={Boolean(resolvedGrade)}
                aria-label={`Mũi tên ${meta.label}`}
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: '50%',
                  border: '4px solid #334155',
                  background: meta.bg,
                  boxShadow:
                    '0 0 0 3px #e2e8f0, 0 8px 18px rgba(0,0,0,0.82), inset 0 4px 10px rgba(255,255,255,0.42)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.08s ease',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.92)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1,
                    textShadow: '0 2px 5px rgba(0,0,0,0.55)',
                  }}
                >
                  {meta.symbol}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
