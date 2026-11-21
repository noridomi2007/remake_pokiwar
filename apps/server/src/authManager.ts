import { MAX_PET_LEVEL } from '@pokiwar/shared';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

export interface AccountRecord {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  progress: Record<string, unknown>;
}

export interface PublicAccount {
  id: string;
  username: string;
  displayName: string;
  serverId: string;
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString('hex');
}

function verifyPassword(password: string, salt: string, storedHex: string): boolean {
  const derived = scryptSync(password, salt, 32);
  const expected = Buffer.from(storedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function clampProgressPetLevels(progress: Record<string, unknown>): boolean {
  const rawLevels = progress.petLevels;
  if (!rawLevels || typeof rawLevels !== 'object') return false;
  const levels = rawLevels as Record<string, unknown>;
  let changed = false;
  for (const [petId, rawVal] of Object.entries(levels)) {
    const num = typeof rawVal === 'number' && Number.isFinite(rawVal) ? Math.floor(rawVal) : 1;
    const clamped = Math.max(1, Math.min(MAX_PET_LEVEL, num));
    if (levels[petId] !== clamped) {
      levels[petId] = clamped;
      changed = true;
    }
  }
  return changed;
}

export function createStarterProgress(displayName: string, starterPetId = 'pet-583'): Record<string, unknown> {
  const initialUnlocked = Array.from(new Set([starterPetId, 'pet-583', 'pet-1431', 'pet-725']));
  return {
    name: displayName,
    avatarId: '29',
    unlockedAvatars: ['29'],
    unlockedPets: initialUnlocked,
    petShards: {
      'pet-1204': 20,
      'pet-807': 15,
      'pet-mega-zidarose': 15,
    },
    equippedSupportCards: ['MANA_100', 'RAGE_50', 'HP_350'],
    level: 1,
    exp: 0,
    gold: 1500,
    stones: 25,
    stoneBag: [8, 4, 2, 1, 0],
    charms: { binhAn: 2, mayMan: 2 },
    wins: 0,
    worldBossBestDamage: 0,
    wheelSpunCount: 0,
    eggSmashCount: 0,
    claimedEggMilestones: [],
    selectedPetId: starterPetId,
    petLevels: { [starterPetId]: 1 },
    petTiers: {},
    clearedStages: [],
    claimedMissions: [],
  };
}

export class AuthManager {
  private accounts = new Map<string, AccountRecord>();
  private tokens = new Map<string, { username: string; serverId: string }>();

  constructor() {
    this.loadFromDisk();
    this.ensureDemoAccount();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(ACCOUNTS_FILE)) return;
      const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as AccountRecord[];
      for (const acc of parsed) {
        if (acc?.username) {
          this.accounts.set(acc.username.toLowerCase(), acc);
        }
      }
    } catch {
      // ignore corrupted file fallback
    }
  }

  private saveToDisk(): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(Array.from(this.accounts.values()), null, 2));
    } catch {
      // non-fatal disk write error
    }
  }

  private ensureDemoAccount(): void {
    if (!this.accounts.has('pokiwar')) {
      const salt = randomBytes(16).toString('hex');
      this.accounts.set('pokiwar', {
        id: 'acc-demo-1',
        username: 'pokiwar',
        displayName: 'Potter',
        salt,
        passwordHash: hashPassword('123456', salt),
        createdAt: new Date().toISOString(),
        progress: createStarterProgress('ZingMeHero', 'pet-583'),
      });
    }

    const baseVip = this.accounts.get('pokiwar');
    if (!baseVip) return;

    const vipClones: ReadonlyArray<{
      id: string;
      username: string;
      displayName: string;
      avatarId: string;
      selectedPetId: string;
    }> = [
      { id: 'acc-vip-1', username: 'vip1', displayName: 'LongVươngZida', avatarId: '29', selectedPetId: 'pet-mega-zidarose' },
      { id: 'acc-vip-2', username: 'vip2', displayName: 'ThánhKỵElpi', avatarId: '32', selectedPetId: 'pet-mega-elpidios' },
      { id: 'acc-vip-3', username: 'vip3', displayName: 'HỏaĐếTwin', avatarId: '27', selectedPetId: 'pet-mega-twinflame' },
      { id: 'acc-vip-4', username: 'vip4', displayName: 'LôiThầnIcarus', avatarId: '26', selectedPetId: 'pet-mega-icarus' },
      { id: 'acc-vip-5', username: 'vip5', displayName: 'BăngĐếOrithyia', avatarId: '28', selectedPetId: 'pet-primal-orithyia' },
      { id: 'acc-pw-1', username: 'pokiwar1', displayName: 'LongVươngZida', avatarId: '29', selectedPetId: 'pet-mega-zidarose' },
      { id: 'acc-pw-2', username: 'pokiwar2', displayName: 'ThánhKỵElpi', avatarId: '32', selectedPetId: 'pet-mega-elpidios' },
      { id: 'acc-pw-3', username: 'pokiwar3', displayName: 'HỏaĐếTwin', avatarId: '27', selectedPetId: 'pet-mega-twinflame' },
      { id: 'acc-pw-4', username: 'pokiwar4', displayName: 'LôiThầnIcarus', avatarId: '26', selectedPetId: 'pet-mega-icarus' },
      { id: 'acc-pw-5', username: 'pokiwar5', displayName: 'BăngĐếOrithyia', avatarId: '28', selectedPetId: 'pet-primal-orithyia' },
    ];

    let changed = false;
    for (const acc of this.accounts.values()) {
      if (clampProgressPetLevels(acc.progress)) {
        changed = true;
      }
    }
    for (const v of vipClones) {
      if (!this.accounts.has(v.username)) {
        const clonedProgress = JSON.parse(JSON.stringify(baseVip.progress)) as Record<string, unknown>;
        clampProgressPetLevels(clonedProgress);
        clonedProgress.name = v.displayName;
        clonedProgress.avatarId = v.avatarId;
        clonedProgress.selectedPetId = v.selectedPetId;
        clonedProgress.gold = 9999999;
        clonedProgress.stones = 100000;
        clonedProgress.gloryCoins = 99999;
        clonedProgress.genCores = 999;
        clonedProgress.vipLevel = 10;
        clonedProgress.expeditionCleared = [];
        clonedProgress.expeditionClaimedChests = [];
        clonedProgress.expeditionLockedPets = [];
        clonedProgress.treasureIslandAttempts = 0;
        clonedProgress.ancientArenaTurns = 0;

        this.accounts.set(v.username, {
          id: v.id,
          username: v.username,
          displayName: v.displayName,
          salt: baseVip.salt,
          passwordHash: baseVip.passwordHash,
          createdAt: new Date().toISOString(),
          progress: clonedProgress,
        });
        changed = true;
      }
    }
    if (changed) {
      this.saveToDisk();
    }
  }

  register(input: {
    username: string;
    displayName: string;
    password: string;
    starterPetId?: string;
    serverId?: string;
  }): { ok: true; token: string; user: PublicAccount; progress: Record<string, unknown> } | { ok: false; message: string } {
    const cleanUser = input.username.trim().toLowerCase();
    const cleanName = input.displayName.trim().slice(0, 20) || cleanUser;
    const pass = input.password;

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUser)) {
      return { ok: false, message: 'Tên đăng nhập gồm 3–20 ký tự chữ thường, số hoặc dấu _.' };
    }
    if (pass.length < 4) {
      return { ok: false, message: 'Mật khẩu cần ít nhất 4 ký tự.' };
    }
    if (this.accounts.has(cleanUser)) {
      return { ok: false, message: 'Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.' };
    }

    const salt = randomBytes(16).toString('hex');
    const starter = input.starterPetId || 'pet-583';
    const record: AccountRecord = {
      id: `acc-${Date.now()}-${randomBytes(3).toString('hex')}`,
      username: cleanUser,
      displayName: cleanName,
      salt,
      passwordHash: hashPassword(pass, salt),
      createdAt: new Date().toISOString(),
      progress: createStarterProgress(cleanName, starter),
    };

    this.accounts.set(cleanUser, record);
    this.saveToDisk();

    const serverId = input.serverId || 'S1';
    const token = randomBytes(24).toString('hex');
    this.tokens.set(token, { username: cleanUser, serverId });

    return {
      ok: true,
      token,
      user: { id: record.id, username: record.username, displayName: record.displayName, serverId },
      progress: record.progress,
    };
  }

  login(input: {
    username: string;
    password: string;
    serverId?: string;
  }): { ok: true; token: string; user: PublicAccount; progress: Record<string, unknown> } | { ok: false; message: string } {
    const cleanUser = input.username.trim().toLowerCase();
    const record = this.accounts.get(cleanUser);
    if (!record || !verifyPassword(input.password, record.salt, record.passwordHash)) {
      return { ok: false, message: 'Sai tên đăng nhập hoặc mật khẩu.' };
    }

    const serverId = input.serverId || 'S1';
    const token = randomBytes(24).toString('hex');
    this.tokens.set(token, { username: cleanUser, serverId });

    return {
      ok: true,
      token,
      user: { id: record.id, username: record.username, displayName: record.displayName, serverId },
      progress: record.progress,
    };
  }

  getByToken(token: string): { user: PublicAccount; progress: Record<string, unknown> } | null {
    const sess = this.tokens.get(token);
    if (!sess) return null;
    const record = this.accounts.get(sess.username);
    if (!record) return null;
    return {
      user: {
        id: record.id,
        username: record.username,
        displayName: record.displayName,
        serverId: sess.serverId,
      },
      progress: record.progress,
    };
  }

  saveProgress(token: string, progress: Record<string, unknown>): boolean {
    const sess = this.tokens.get(token);
    if (!sess) return false;
    const record = this.accounts.get(sess.username);
    if (!record) return false;
    clampProgressPetLevels(progress);
    record.progress = progress;
    if (typeof progress.name === 'string' && progress.name.trim()) {
      record.displayName = progress.name.trim().slice(0, 20);
    }
    this.saveToDisk();
    return true;
  }

  logout(token: string): void {
    this.tokens.delete(token);
  }
}
