import type { ElementType } from './types.js';

const ADVANTAGE_MAP: Record<ElementType, ElementType> = {
  KIM: 'MOC',
  MOC: 'THO',
  THO: 'THUY',
  THUY: 'HOA',
  HOA: 'KIM',
};

export const ELEMENT_META: Record<
  ElementType,
  { label: string; color: string; bg: string; iconPath: string }
> = {
  KIM: { label: 'Kim', color: '#facc15', bg: '#422006', iconPath: '/assets/pokiguard/sprites/METAL.png' },
  MOC: { label: 'Mộc', color: '#4ade80', bg: '#052e16', iconPath: '/assets/pokiguard/sprites/WOOD.png' },
  THUY: { label: 'Thủy', color: '#38bdf8', bg: '#082f49', iconPath: '/assets/pokiguard/sprites/WATER.png' },
  HOA: { label: 'Hỏa', color: '#fb7185', bg: '#4c0519', iconPath: '/assets/pokiguard/sprites/FIRE.png' },
  THO: { label: 'Thổ', color: '#f59e0b', bg: '#451a03', iconPath: '/assets/pokiguard/sprites/EARTH.png' },
};

/**
 * PokiGuard ElementAdvantage.cs exact rates:
 * - ADVANTAGE_PCT = +50% (1.50x)
 * - DISADVANTAGE_PCT = -25% (0.75x)
 */
export function getElementMultiplier(attacker: ElementType, defender: ElementType): number {
  if (ADVANTAGE_MAP[attacker] === defender) return 1.5;
  if (ADVANTAGE_MAP[defender] === attacker) return 0.75;
  return 1.0;
}

/**
 * Pokiwar 4.0 Hiệu Ứng Ngũ Hành Đấu Trường (Đấu Trường Vinh Quang / Đấu Trường Cổ Đại):
 * - Matching field element: +50% Damage & +20% Max HP
 * - Countered by field element: -50% Damage & -20% Max HP
 */
export function getFieldElementModifier(
  unitElement: ElementType,
  fieldElement?: ElementType,
): { dmgMult: number; hpMult: number; relation: 'BOOST' | 'WEAK' | 'NEUTRAL' } {
  if (!fieldElement) return { dmgMult: 1, hpMult: 1, relation: 'NEUTRAL' };
  if (unitElement === fieldElement) return { dmgMult: 1.5, hpMult: 1.2, relation: 'BOOST' };
  if (ADVANTAGE_MAP[fieldElement] === unitElement) return { dmgMult: 0.5, hpMult: 0.8, relation: 'WEAK' };
  return { dmgMult: 1, hpMult: 1, relation: 'NEUTRAL' };
}
