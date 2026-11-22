import { SeededRandom } from './prng.js';
import type { BoardGrid, GemCell, GemMultiplier, GemType, GravityDrop, MatchGroup, Pos } from './types.js';

export const GEM_TYPES: readonly GemType[] = [
  'SWORD',
  'LIGHTNING',
  'FIRE',
  'HEART',
  'YINYANG',
  'COIN',
];

export const GEM_META: Record<
  GemType,
  {
    label: string;
    color: string;
    stroke: string;
    shape: 'SQUARE' | 'CIRCLE';
    icon: string;
    spritePath: string;
    effectHint: string;
  }
> = {
  SWORD: {
    label: 'Kiếm',
    color: '#eab308',
    stroke: '#fef08a',
    shape: 'SQUARE',
    icon: '⚔',
    spritePath: '/assets/pokiguard/sprites/gem_attack.png',
    effectHint: 'Tấn công vật lý vào địch (Nộ ≥100 tăng mạnh lực đánh)',
  },
  LIGHTNING: {
    label: 'Mana',
    color: '#38bdf8',
    stroke: '#93c5fd',
    shape: 'SQUARE',
    icon: '⚡',
    spritePath: '/assets/pokiguard/sprites/gem_mana.png',
    effectHint: 'Chỉ nạp Mana để dùng Hóa Thần, Thẻ Chưởng & Kỹ Năng',
  },
  FIRE: {
    label: 'Lửa Nộ',
    color: '#ef4444',
    stroke: '#fca5a5',
    shape: 'SQUARE',
    icon: '🔥',
    spritePath: '/assets/pokiguard/sprites/gem_rage.png',
    effectHint: 'Chỉ tích thanh Nộ (Max 250) cường hóa đòn Kiếm & Tuyệt Kỹ — không tấn công',
  },
  HEART: {
    label: 'Máu',
    color: '#22c55e',
    stroke: '#86efac',
    shape: 'SQUARE',
    icon: '♥',
    spritePath: '/assets/pokiguard/sprites/gem_heal.png',
    effectHint: 'Chỉ hồi phục Sinh Lực HP cho bản thân',
  },
  YINYANG: {
    label: 'Khiên Giáp',
    color: '#a855f7',
    stroke: '#d8b4fe',
    shape: 'SQUARE',
    icon: '🛡️',
    spritePath: '/assets/pokiguard/sprites/gem_armor.png',
    effectHint: 'Dựng Khiên Giáp bảo vệ bản thân hấp thụ sát thương & trừ Mana địch',
  },
  COIN: {
    label: 'Âm Dương',
    color: '#e2e8f0',
    stroke: '#cbd5e1',
    shape: 'SQUARE',
    icon: '☯',
    spritePath: '/assets/pokiguard/sprites/gem_steal.png',
    effectHint: 'Hút Mana, Nộ & Sinh Lực từ đối thủ sang bản thân + Thưởng Vàng',
  },
};

export function rollGemMultiplier(rng: SeededRandom): GemMultiplier {
  const roll = rng.next();
  if (roll < 0.015) return 5;
  if (roll < 0.06) return 4;
  if (roll < 0.14) return 3;
  if (roll < 0.30) return 2;
  return 1;
}

export function areAdjacent(a: Pos, b: Pos): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr + dc === 1;
}

export function isInsideBoard(board: BoardGrid, pos: Pos): boolean {
  return pos.row >= 0 && pos.row < board.length && pos.col >= 0 && pos.col < (board[0]?.length ?? 0);
}

export function cloneBoard(board: BoardGrid): BoardGrid {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

export function swapCellsInPlace(board: BoardGrid, a: Pos, b: Pos): void {
  const temp = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = temp;
}

interface RawRun {
  gemType: GemType;
  cells: Pos[];
}

export function findMatches(board: BoardGrid): MatchGroup[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const runs: RawRun[] = [];

  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const gemType = board[r][c].type;
      let end = c + 1;
      while (end < cols && board[r][end].type === gemType) {
        end++;
      }
      if (end - c >= 3) {
        const cells: Pos[] = [];
        for (let k = c; k < end; k++) {
          cells.push({ row: r, col: k });
        }
        runs.push({ gemType, cells });
      }
      c = end;
    }
  }

  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const gemType = board[r][c].type;
      let end = r + 1;
      while (end < rows && board[end][c].type === gemType) {
        end++;
      }
      if (end - r >= 3) {
        const cells: Pos[] = [];
        for (let k = r; k < end; k++) {
          cells.push({ row: k, col: c });
        }
        runs.push({ gemType, cells });
      }
      r = end;
    }
  }

  if (runs.length === 0) return [];

  const key = (p: Pos) => `${p.row},${p.col}`;
  const runCellSets = runs.map((run) => new Set(run.cells.map(key)));
  const visited = new Array(runs.length).fill(false);
  const groups: MatchGroup[] = [];

  for (let i = 0; i < runs.length; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const queue = [i];
    const mergedMap = new Map<string, Pos>();
    const gemType = runs[i].gemType;

    while (queue.length > 0) {
      const idx = queue.shift()!;
      for (const p of runs[idx].cells) {
        mergedMap.set(key(p), p);
      }
      for (let j = 0; j < runs.length; j++) {
        if (visited[j] || runs[j].gemType !== gemType) continue;
        let sharesCell = false;
        for (const k of runCellSets[j]) {
          if (mergedMap.has(k) || runCellSets[idx].has(k)) {
            sharesCell = true;
            break;
          }
        }
        if (sharesCell) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }

    const positions = Array.from(mergedMap.values());
    const effectiveValue = positions.reduce(
      (sum, p) => sum + (board[p.row]?.[p.col]?.multiplier ?? 1),
      0,
    );

    groups.push({
      positions,
      gemType,
      length: positions.length,
      effectiveValue,
      isExtraTurn: positions.length >= 4,
    });
  }

  return groups;
}

export function findValidMoves(board: BoardGrid): Array<{ from: Pos; to: Pos }> {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const copy = cloneBoard(board);
  const moves: Array<{ from: Pos; to: Pos }> = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && copy[r][c].type !== copy[r][c + 1].type) {
        swapCellsInPlace(copy, { row: r, col: c }, { row: r, col: c + 1 });
        if (findMatches(copy).length > 0) {
          moves.push({ from: { row: r, col: c }, to: { row: r, col: c + 1 } });
        }
        swapCellsInPlace(copy, { row: r, col: c }, { row: r, col: c + 1 });
      }
      if (r + 1 < rows && copy[r][c].type !== copy[r + 1][c].type) {
        swapCellsInPlace(copy, { row: r, col: c }, { row: r + 1, col: c });
        if (findMatches(copy).length > 0) {
          moves.push({ from: { row: r, col: c }, to: { row: r + 1, col: c } });
        }
        swapCellsInPlace(copy, { row: r, col: c }, { row: r + 1, col: c });
      }
    }
  }

  return moves;
}

export function createBoard(
  rows: number,
  cols: number,
  rng: SeededRandom,
  startGemId = 1,
): { board: BoardGrid; nextGemId: number } {
  let nextGemId = startGemId;
  const board: BoardGrid = [];

  for (let r = 0; r < rows; r++) {
    const rowCells: GemCell[] = [];
    for (let c = 0; c < cols; c++) {
      const forbidden = new Set<GemType>();
      if (c >= 2 && rowCells[c - 1].type === rowCells[c - 2].type) {
        forbidden.add(rowCells[c - 1].type);
      }
      if (r >= 2 && board[r - 1][c].type === board[r - 2][c].type) {
        forbidden.add(board[r - 1][c].type);
      }
      const candidates = GEM_TYPES.filter((t) => !forbidden.has(t));
      const type = rng.pick(candidates);
      rowCells.push({
        id: nextGemId++,
        type,
        multiplier: rollGemMultiplier(rng),
      });
    }
    board.push(rowCells);
  }

  if (findValidMoves(board).length === 0) {
    return shuffleBoard(board, rng, nextGemId);
  }

  return { board, nextGemId };
}

export function shuffleBoard(
  board: BoardGrid,
  rng: SeededRandom,
  startGemId: number,
): { board: BoardGrid; nextGemId: number } {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  for (let attempt = 0; attempt < 25; attempt++) {
    const pool = board.flat().map((cell) => ({ ...cell }));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    const candidate: BoardGrid = [];
    for (let r = 0; r < rows; r++) {
      candidate.push(pool.slice(r * cols, (r + 1) * cols));
    }

    if (findMatches(candidate).length === 0 && findValidMoves(candidate).length > 0) {
      return { board: candidate, nextGemId: startGemId };
    }
  }

  return createBoard(rows, cols, rng, startGemId);
}

export function clearAndRefill(
  board: BoardGrid,
  matches: MatchGroup[],
  rng: SeededRandom,
  startGemId: number,
): { board: BoardGrid; drops: GravityDrop[]; nextGemId: number } {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  let nextGemId = startGemId;

  const cleared = new Set<string>();
  for (const group of matches) {
    for (const p of group.positions) {
      cleared.add(`${p.row},${p.col}`);
    }
  }

  const nextBoard: BoardGrid = Array.from({ length: rows }, () => new Array<GemCell>(cols));
  const drops: GravityDrop[] = [];

  for (let c = 0; c < cols; c++) {
    let writeRow = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (!cleared.has(`${r},${c}`)) {
        const cell = board[r][c];
        nextBoard[writeRow][c] = cell;
        if (writeRow !== r) {
          drops.push({
            gemId: cell.id,
            type: cell.type,
            multiplier: cell.multiplier ?? 1,
            fromRow: r,
            toRow: writeRow,
            col: c,
            isNew: false,
          });
        }
        writeRow--;
      }
    }

    const emptyCount = writeRow + 1;
    for (let r = writeRow; r >= 0; r--) {
      const mult = rollGemMultiplier(rng);
      const newCell: GemCell = {
        id: nextGemId++,
        type: rng.pick(GEM_TYPES),
        multiplier: mult,
      };
      nextBoard[r][c] = newCell;
      drops.push({
        gemId: newCell.id,
        type: newCell.type,
        multiplier: mult,
        fromRow: r - emptyCount,
        toRow: r,
        col: c,
        isNew: true,
      });
    }
  }

  return { board: nextBoard, drops, nextGemId };
}
