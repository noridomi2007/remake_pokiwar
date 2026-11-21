import type { QteGrade } from '@pokiwar/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ArrowDir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface QteAuditionModalProps {
  skillName: string;
  cardImage?: string;
  onComplete: (grade: QteGrade) => void;
}

const DIRS: readonly ArrowDir[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const DIR_SYMBOL: Record<ArrowDir, string> = {
  UP: '▲',
  DOWN: '▼',
  LEFT: '◀',
  RIGHT: '▶',
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

const TOTAL_DURATION_MS = 5200;

export function QteAuditionModal({ skillName, cardImage, onComplete }: QteAuditionModalProps) {
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
      }, 420);
    },
    [onComplete],
  );

  // Beat bar animation loop (moves 0 -> 100%, Perfect window ~ 62..82%)
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
        setTimeout(() => setShakeIdx(null), 260);
      }
    },
    [sequence],
  );

  const handleSpaceBeat = useCallback(() => {
    if (doneRef.current) return;
    if (stepRef.current < sequence.length) {
      finishWithGrade('BAD');
      return;
    }
    const pct = Math.min(100, ((performance.now() - startRef.current) / TOTAL_DURATION_MS) * 100);
    if (pct >= 62 && pct <= 84) {
      finishWithGrade('PERFECT');
    } else if (pct >= 46 && pct <= 94) {
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
        handleSpaceBeat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDirInput, handleSpaceBeat]);

  const arrowsDone = step >= sequence.length;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 75,
        background: 'rgba(2, 8, 24, 0.72)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="pk-stone-panel"
        style={{
          width: 560,
          padding: '16px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          borderColor: resolvedGrade === 'PERFECT' ? '#4ade80' : '#fde047',
          boxShadow: '0 0 42px rgba(250, 204, 21, 0.55)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {cardImage && (
            <img
              src={cardImage}
              alt={skillName}
              style={{ width: 42, height: 42, borderRadius: 8, border: '2px solid #fde047', objectFit: 'cover' }}
            />
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fef08a' }}>
              QTE TUYỆT KỸ AUDITION — {skillName.toUpperCase()}
            </div>
            <div style={{ fontSize: 11.5, color: '#cbd5e1' }}>
              Bấm đúng 7 phím mũi tên (hoặc WASD / nút dưới) rồi nhấn <strong>SPACE</strong> vào vùng vàng!
            </div>
          </div>
        </div>

        {/* 7 Directional Arrows Sequence */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          {sequence.map((dir, idx) => {
            const done = idx < step;
            const current = idx === step;
            const wrong = shakeIdx === idx;
            return (
              <div
                key={idx}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 900,
                  background: done
                    ? 'linear-gradient(180deg, #22c55e, #15803d)'
                    : wrong
                      ? '#dc2626'
                      : current
                        ? 'linear-gradient(180deg, #f59e0b, #b45309)'
                        : '#0b1e49',
                  border: current
                    ? '2.5px solid #fef08a'
                    : done
                      ? '2px solid #86efac'
                      : '2px solid #334155',
                  color: '#fff',
                  boxShadow: current ? '0 0 14px rgba(250,204,21,0.85)' : undefined,
                  transform: current ? 'scale(1.08)' : undefined,
                }}
              >
                {DIR_SYMBOL[dir]}
              </div>
            );
          })}
        </div>

        {/* Pukiwo-style Rainbow QTE Timing Gauge */}
        <div style={{ width: '100%' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 26,
              borderRadius: 999,
              background:
                'linear-gradient(90deg, #ef4444 0%, #ef4444 30%, #22c55e 30%, #22c55e 60%, #fde047 60%, #4ade80 65%, #facc15 84%, #cbd5e1 84%, #1d4ed8 92%, #1e40af 100%)',
              border: '2.5px solid #e2e8f0',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.45), 0 0 14px rgba(56, 189, 248, 0.45)',
              overflow: 'visible',
            }}
          >
            {/* Perfect Highlight Glow Window (62%..84%) */}
            <div
              style={{
                position: 'absolute',
                left: '62%',
                width: '22%',
                top: -2,
                bottom: -2,
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.25)',
                border: '2px solid #ffffff',
                boxShadow: '0 0 12px rgba(250, 204, 21, 0.95)',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '73%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 10,
                fontWeight: 900,
                color: '#1e1b4b',
                textShadow: '0 1px 0 rgba(255,255,255,0.8)',
              }}
            >
              PERFECT
            </span>

            {/* Moving Glowing Red Pukiwo Orb Slider */}
            <div
              style={{
                position: 'absolute',
                left: `${cursorPct}%`,
                top: '50%',
                width: 28,
                height: 28,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #fecaca, #ef4444 55%, #7f1d1d 100%)',
                border: '2.5px solid #ffffff',
                boxShadow: '0 0 14px #f87171, 0 2px 6px rgba(0,0,0,0.8)',
              }}
            />
          </div>
          <div
            style={{
              marginTop: 5,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 900,
              color: '#7dd3fc',
              textShadow: '0 1px 2px #000',
            }}
          >
            {arrowsDone ? 'Nhấn SPACE để ra chiêu ngay!' : 'Hoàn thành mũi tên rồi canh vùng PERFECT'}
          </div>
        </div>

        {/* Clickable Pads + Space Button for Mouse/Touch Players */}
        {!resolvedGrade ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' }}>
            {DIRS.map((dir) => (
              <button
                key={dir}
                type="button"
                className="pk-btn-blue"
                style={{ minWidth: 48, padding: '8px 12px', fontSize: 16 }}
                onClick={() => handleDirInput(dir)}
              >
                {DIR_SYMBOL[dir]}
              </button>
            ))}
            <button
              type="button"
              className={arrowsDone ? 'pk-btn-gold' : 'pk-btn-red'}
              style={{ minWidth: 140, padding: '9px 16px' }}
              onClick={handleSpaceBeat}
            >
              {arrowsDone ? 'NHẤN SPACE!' : `Còn ${sequence.length - step} phím`}
            </button>
          </div>
        ) : (
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color:
                resolvedGrade === 'PERFECT'
                  ? '#4ade80'
                  : resolvedGrade === 'GOOD'
                    ? '#38bdf8'
                    : '#f87171',
              textShadow: '0 2px 6px #000',
            }}
          >
            {resolvedGrade === 'PERFECT'
              ? 'PERFECT! (1.5x Sát Thương +50 Vàng)'
              : resolvedGrade === 'GOOD'
                ? 'GOOD! (1.15x Sát Thương)'
                : 'MISS / BAD (0.8x Sát Thương)'}
          </div>
        )}
      </div>
    </div>
  );
}
