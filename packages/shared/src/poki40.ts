import type {
  AuraDef,
  ChestDef,
  EquipmentItemDef,
  EquipmentSlot,
  GloryShopItemDef,
  GuildBossDef,
  MailItemDef,
  SpaceShipDef,
} from './types.js';

// ==================== 1. NHÀ PET — VÒNG SÁNG (AURA) ====================
// Chuẩn Pokiwar 4.0 Zing Me: Sở hữu Vòng Sáng sẽ CỘNG DỒN VĨNH VIỄN chỉ số, và trang bị để hiện hào quang dưới chân Pet!
export const PET_AURAS: readonly AuraDef[] = [
  {
    id: 'aura-gold',
    name: 'Vòng Sáng Hoàng Kim',
    description: 'Hào quang ánh sáng hoàng kim cổ điển của Đấu Sĩ Pokiwar.',
    colorHex: '#fde047',
    ringColorHex: '#f59e0b',
    icon: '/assets/pokiguard/sprites/haoquang.png',
    hpBonus: 420,
    atkBonus: 45,
    defenseBonus: 30,
    costGold: 1500,
    sourceLabel: 'Cửa hàng Vàng',
  },
  {
    id: 'aura-hackim',
    name: 'Vòng Sáng Hắc Kim',
    description: 'Hào quang Hắc Kim huyền thoại chuẩn Pokiwar 4.0 Zing Me (Máu & Kiếm cực đại).',
    colorHex: '#a855f7',
    ringColorHex: '#facc15',
    icon: '/assets/pokiguard/sprites/effects-01_0.png',
    hpBonus: 1200,
    atkBonus: 115,
    defenseBonus: 85,
    costGlory: 450,
    sourceLabel: 'Shop Vinh Quang / Boss Vô Cực',
  },
  {
    id: 'aura-galaxy',
    name: 'Vòng Sáng Thiên Hà',
    description: 'Xoáy tinh vân Ngân Hà xoay quanh chân Thần Thú Galaxy.',
    colorHex: '#38bdf8',
    ringColorHex: '#818cf8',
    icon: '/assets/pokiguard/sprites/effects-02_0.png',
    hpBonus: 900,
    atkBonus: 88,
    defenseBonus: 65,
    costGlory: 320,
    sourceLabel: 'Đấu Trường Bá Vương',
  },
  {
    id: 'aura-phoenix',
    name: 'Vòng Sáng Phượng Hoàng Lửa',
    description: 'Ngọn lửa Niết Bàn bất diệt gia tăng công kích Hỏa diệm.',
    colorHex: '#fb923c',
    ringColorHex: '#ef4444',
    icon: '/assets/pokiguard/sprites/sunburst_gold.png',
    hpBonus: 800,
    atkBonus: 105,
    defenseBonus: 55,
    costGold: 3200,
    sourceLabel: 'Phó bản Hỏa Diệm / Shop',
  },
  {
    id: 'aura-taichi',
    name: 'Vòng Sáng Thái Cực Âm Dương',
    description: 'Bát quái cân bằng công thủ, tăng giáp và kháng sát thương.',
    colorHex: '#2dd4bf',
    ringColorHex: '#f8fafc',
    icon: '/assets/pokiguard/sprites/glow_soft_0.png',
    hpBonus: 1100,
    atkBonus: 92,
    defenseBonus: 110,
    costGlory: 520,
    sourceLabel: 'Hội Quán / Shop Vinh Quang',
  },
  {
    id: 'aura-titan',
    name: 'Vòng Sáng Bá Vương Hủy Diệt',
    description: 'Hào quang tối thượng dành cho Bá Chủ Đấu Trường 4.0.',
    colorHex: '#f43f5e',
    ringColorHex: '#fde047',
    icon: '/assets/pokiguard/sprites/effects-03_0.png',
    hpBonus: 1650,
    atkBonus: 155,
    defenseBonus: 120,
    costGlory: 850,
    sourceLabel: 'Shop Vinh Quang / Mùa Bá Vương',
  },
];

export function getAuraById(id?: string): AuraDef | null {
  if (!id) return null;
  return PET_AURAS.find((a) => a.id === id) ?? null;
}

export function computeAuraTotalBonuses(ownedAuraIds: string[] = []): {
  hpBonus: number;
  atkBonus: number;
  defenseBonus: number;
} {
  let hpBonus = 0;
  let atkBonus = 0;
  let defenseBonus = 0;
  for (const id of new Set(ownedAuraIds)) {
    const a = getAuraById(id);
    if (a) {
      hpBonus += a.hpBonus;
      atkBonus += a.atkBonus;
      defenseBonus += a.defenseBonus;
    }
  }
  return { hpBonus, atkBonus, defenseBonus };
}

// ==================== 2. TRANG BỊ NHÂN VẬT ĐA Ô (6 Ô × 3 CẤP = 18 MÓN) & XUNG PHÁ ====================
export const EQUIPMENT_SLOT_META: Record<EquipmentSlot, { label: string; icon: string }> = {
  NON: { label: 'Nón', icon: '/assets/pokiguard/sprites/hud_crown.png' },
  VU_KHI: { label: 'Vũ Khí', icon: '/assets/pokiguard/sprites/ico_sword.png' },
  CANH: { label: 'Cánh', icon: '/assets/pokiguard/sprites/banner_header_wing.png' },
  AO: { label: 'Áo Giáp', icon: '/assets/pokiguard/sprites/ico_shield.png' },
  GIAY: { label: 'Giày', icon: '/assets/pokiguard/sprites/ico_bolt.png' },
  HIEU_UNG: { label: 'Hiệu Ứng', icon: '/assets/pokiguard/sprites/sparkle_star.png' },
};

export const CHARACTER_EQUIPMENT: readonly EquipmentItemDef[] = [
  // NÓN
  { id: 'eq-non-1', slot: 'NON', name: 'Mũ Pháp Sư Tân Thủ', stars: 3, icon: '/assets/pokiguard/sprites/hud_crown.png', hpBonus: 120, atkBonus: 14, magicBonus: 18, defenseBonus: 12, speedBonus: 3, costGold: 0, rarity: 'RARE' },
  { id: 'eq-non-2', slot: 'NON', name: 'Vương Miện Tinh Tú', stars: 5, icon: '/assets/pokiguard/sprites/rank_1.png', hpBonus: 360, atkBonus: 38, magicBonus: 46, defenseBonus: 32, speedBonus: 8, costGold: 1800, rarity: 'EPIC' },
  { id: 'eq-non-3', slot: 'NON', name: 'Mũ Hóa Trang Bá Vương', stars: 6, icon: '/assets/pokiguard/sprites/hud_crown.png', hpBonus: 720, atkBonus: 78, magicBonus: 88, defenseBonus: 62, speedBonus: 14, costGlory: 380, rarity: 'MYTHIC' },
  // VŨ KHÍ
  { id: 'eq-vk-1', slot: 'VU_KHI', name: 'Kiếm Sắt Khởi Nguyên', stars: 3, icon: '/assets/pokiguard/sprites/ico_sword.png', hpBonus: 80, atkBonus: 28, magicBonus: 20, defenseBonus: 8, speedBonus: 4, costGold: 0, rarity: 'RARE' },
  { id: 'eq-vk-2', slot: 'VU_KHI', name: 'Thánh Kiếm Quang Minh', stars: 5, icon: '/assets/pokiguard/sprites/gem_attack.png', hpBonus: 240, atkBonus: 72, magicBonus: 58, defenseBonus: 20, speedBonus: 10, costGold: 2200, rarity: 'LEGENDARY' },
  { id: 'eq-vk-3', slot: 'VU_KHI', name: 'Găng Tay Vô Cực Titan', stars: 6, icon: '/assets/pokiguard/sprites/ico_fire_scroll.png', hpBonus: 540, atkBonus: 138, magicBonus: 125, defenseBonus: 44, speedBonus: 16, costGlory: 520, rarity: 'MYTHIC' },
  // CÁNH
  { id: 'eq-canh-1', slot: 'CANH', name: 'Cánh Bạc Nhỏ', stars: 3, icon: '/assets/pokiguard/sprites/banner_header_wing.png', hpBonus: 110, atkBonus: 16, magicBonus: 16, defenseBonus: 14, speedBonus: 6, costGold: 600, rarity: 'RARE' },
  { id: 'eq-canh-2', slot: 'CANH', name: 'Cánh Aquar Đại Dương', stars: 5, icon: '/assets/pokiguard/sprites/ico_water.png', hpBonus: 420, atkBonus: 48, magicBonus: 64, defenseBonus: 38, speedBonus: 14, costGlory: 300, rarity: 'LEGENDARY' },
  { id: 'eq-canh-3', slot: 'CANH', name: 'Cánh Thiên Sứ Vinh Quang', stars: 6, icon: '/assets/pokiguard/sprites/banner_header_wing.png', hpBonus: 860, atkBonus: 95, magicBonus: 105, defenseBonus: 72, speedBonus: 22, costGlory: 620, rarity: 'MYTHIC' },
  // ÁO GIÁP
  { id: 'eq-ao-1', slot: 'AO', name: 'Áo Choàng Học Viện', stars: 3, icon: '/assets/pokiguard/sprites/ico_shield.png', hpBonus: 180, atkBonus: 10, magicBonus: 12, defenseBonus: 22, speedBonus: 2, costGold: 0, rarity: 'RARE' },
  { id: 'eq-ao-2', slot: 'AO', name: 'Hóa Trang Hyon Chiến Thần', stars: 5, icon: '/assets/pokiguard/sprites/ico_ice_shield.png', hpBonus: 580, atkBonus: 44, magicBonus: 42, defenseBonus: 62, speedBonus: 8, costGold: 2400, rarity: 'LEGENDARY' },
  { id: 'eq-ao-3', slot: 'AO', name: 'Chiến Giáp Vinh Quang 4.0', stars: 6, icon: '/assets/pokiguard/sprites/ico_shield.png', hpBonus: 1150, atkBonus: 86, magicBonus: 86, defenseBonus: 112, speedBonus: 14, costGlory: 580, rarity: 'MYTHIC' },
  // GIÀY
  { id: 'eq-giay-1', slot: 'GIAY', name: 'Giày Tốc Hành', stars: 3, icon: '/assets/pokiguard/sprites/ico_bolt.png', hpBonus: 90, atkBonus: 12, magicBonus: 12, defenseBonus: 10, speedBonus: 8, costGold: 500, rarity: 'RARE' },
  { id: 'eq-giay-2', slot: 'GIAY', name: 'Hài Đạp Mây Tề Thiên', stars: 5, icon: '/assets/pokiguard/sprites/gem_mana.png', hpBonus: 310, atkBonus: 36, magicBonus: 36, defenseBonus: 28, speedBonus: 18, costGold: 1600, rarity: 'EPIC' },
  { id: 'eq-giay-3', slot: 'GIAY', name: 'Chiến Ngoa Ngân Hà', stars: 6, icon: '/assets/pokiguard/sprites/ico_bolt.png', hpBonus: 640, atkBonus: 68, magicBonus: 68, defenseBonus: 54, speedBonus: 28, costGlory: 360, rarity: 'MYTHIC' },
  // HIỆU ỨNG
  { id: 'eq-fx-1', slot: 'HIEU_UNG', name: 'Ánh Sao Lấp Lánh', stars: 3, icon: '/assets/pokiguard/sprites/sparkle_star.png', hpBonus: 140, atkBonus: 16, magicBonus: 16, defenseBonus: 12, speedBonus: 4, costGold: 800, rarity: 'RARE' },
  { id: 'eq-fx-2', slot: 'HIEU_UNG', name: 'Lôi Điện Quấn Thân', stars: 5, icon: '/assets/pokiguard/sprites/twinkle.png', hpBonus: 440, atkBonus: 54, magicBonus: 54, defenseBonus: 36, speedBonus: 10, costGold: 2100, rarity: 'LEGENDARY' },
  { id: 'eq-fx-3', slot: 'HIEU_UNG', name: 'Hiệu Ứng Giả Lập Bá Vương', stars: 6, icon: '/assets/pokiguard/sprites/sunburst_gold.png', hpBonus: 920, atkBonus: 108, magicBonus: 108, defenseBonus: 74, speedBonus: 18, costGlory: 540, rarity: 'MYTHIC' },
];

export function computeEquipmentBonuses(
  equippedBySlot: Partial<Record<EquipmentSlot, string>> = {},
  breakthroughLv = 0,
): { hpBonus: number; atkBonus: number; magicBonus: number; defenseBonus: number; speedBonus: number } {
  let hpBonus = breakthroughLv * 180;
  let atkBonus = breakthroughLv * 24;
  let magicBonus = breakthroughLv * 24;
  let defenseBonus = breakthroughLv * 16;
  let speedBonus = breakthroughLv * 3;
  for (const eqId of Object.values(equippedBySlot)) {
    const item = CHARACTER_EQUIPMENT.find((e) => e.id === eqId);
    if (item) {
      hpBonus += item.hpBonus;
      atkBonus += item.atkBonus;
      magicBonus += item.magicBonus;
      defenseBonus += item.defenseBonus;
      speedBonus += item.speedBonus;
    }
  }
  return { hpBonus, atkBonus, magicBonus, defenseBonus, speedBonus };
}

// ==================== 3. SHOP VINH QUANG (XU ĐẤU TRƯỜNG) & SHOP RƯƠNG ====================
export const GLORY_SHOP_ITEMS: readonly GloryShopItemDef[] = [
  { id: 'gs-1', kind: 'SHARD', name: '+15 Mảnh Fantasy Joker', icon: '/assets/pokiguard/pets/pw_fantasy_joker.png', refId: 'pet-fantasy-joker', amount: 15, baseCostGlory: 360, salePercent: 20, rarity: 'LEGENDARY' },
  { id: 'gs-2', kind: 'SHARD', name: '+15 Mảnh Primal Orithyia', icon: '/assets/pokiguard/pets/pw_primal_orithyia.png', refId: 'pet-primal-orithyia', amount: 15, baseCostGlory: 350, salePercent: 20, rarity: 'LEGENDARY' },
  { id: 'gs-3', kind: 'SHARD', name: '+15 Mảnh Galaxy Chess Master', icon: '/assets/pokiguard/pets/pw_galaxy_chess_master.png', refId: 'pet-3090', amount: 15, baseCostGlory: 280, salePercent: 30, rarity: 'EPIC' },
  { id: 'gs-4', kind: 'SHARD', name: '+15 Mảnh Galaxy Shadow Sword', icon: '/assets/pokiguard/pets/pw_galaxy_shadow_sword.png', refId: 'pet-galaxy-shadow-sword', amount: 15, baseCostGlory: 310, salePercent: 25, rarity: 'LEGENDARY' },
  { id: 'gs-5', kind: 'SHARD', name: '+15 Mảnh Galaxy Dragon Knight', icon: '/assets/pokiguard/pets/pw_galaxy_dragon_knight.png', refId: 'pet-galaxy-dragon-knight', amount: 15, baseCostGlory: 300, salePercent: 20, rarity: 'LEGENDARY' },
  { id: 'gs-6', kind: 'GEN_CORE', name: '+5 Tinh Thể Gen T2', icon: '/assets/pokiguard/sprites/crystal.png', amount: 5, baseCostGlory: 180, salePercent: 30, rarity: 'EPIC' },
  { id: 'gs-7', kind: 'STONE_LV5', name: '+3 Đá Cấp 5', icon: '/assets/pokiguard/sprites/stone_m_5.png', amount: 3, baseCostGlory: 200, salePercent: 50, rarity: 'EPIC' },
  { id: 'gs-8', kind: 'CHARM', name: '+3 Bùa May Mắn & Bình An', icon: '/assets/pokiguard/sprites/charm_may_man.png', amount: 3, baseCostGlory: 160, salePercent: 25, rarity: 'RARE' },
];

export const SHOP_CHESTS: readonly ChestDef[] = [
  { id: 'chest-starter', name: 'Rương Tân Thủ', description: 'Mở ra Vàng, Đá C2–C3 & Mảnh Pet S ngẫu nhiên.', icon: '/assets/pokiguard/sprites/chest_big.png', costGold: 500, tier: 'STARTER' },
  { id: 'chest-warrior', name: 'Rương Chiến Binh', description: 'Mở ra Đá C3–C4, Bùa & +12 Mảnh Mega/Huyền Thoại.', icon: '/assets/pokiguard/sprites/chest_big.png', costGold: 1200, tier: 'WARRIOR' },
  { id: 'chest-artifact', name: 'Rương Thần Khí', description: 'Mở ra Tinh Thể Gen, Xu Vinh Quang & +15 Mảnh Galaxy/Fantasy.', icon: '/assets/pokiguard/sprites/chest_big_open.png', costGold: 2200, tier: 'ARTIFACT' },
  { id: 'chest-ancient', name: 'Rương Thượng Cổ', description: 'Cơ hội cao mở Full Pet Ancient / Titan hoặc +20 Mảnh hiếm!', icon: '/assets/pokiguard/sprites/chest_big_open.png', costGold: 0, costGlory: 280, tier: 'ANCIENT' },
];

// ==================== 4. THÁM HIỂM VŨ TRỤ (5 CẤP PHI THUYỀN) ====================
export const SPACE_SHIPS: readonly SpaceShipDef[] = [
  { id: 'ship-80', tierScore: 80, name: 'Phi Thuyền Trinh Sát #80', subtitle: 'Quỹ đạo Trái Đất • Nhanh gọn', durationSec: 8, rewardGold: 450, rewardGlory: 40, rewardStones: 8, rewardGenCores: 1, shardCount: 6, color: '#38bdf8' },
  { id: 'ship-100', tierScore: 100, name: 'Phi Thuyền Hộ Vệ #100', subtitle: 'Vành đai Mặt Trăng • Cân bằng', durationSec: 12, rewardGold: 750, rewardGlory: 70, rewardStones: 14, rewardGenCores: 2, shardCount: 9, color: '#22c55e' },
  { id: 'ship-150', tierScore: 150, name: 'Chiến Hạm Tinh Vân #150', subtitle: 'Tinh hệ Orion • Nhiều Đá & Xu', durationSec: 16, rewardGold: 1250, rewardGlory: 115, rewardStones: 22, rewardGenCores: 3, shardCount: 12, color: '#a855f7' },
  { id: 'ship-200', tierScore: 200, name: 'Kỳ Hạm Ngân Hà #200', subtitle: 'Hố Đen Vũ Trụ • Kho báu Galaxy', durationSec: 22, rewardGold: 1900, rewardGlory: 180, rewardStones: 35, rewardGenCores: 5, shardCount: 16, color: '#f59e0b' },
  { id: 'ship-450', tierScore: 450, name: 'Siêu Chiến Hạm Titan #450', subtitle: 'Đỉnh Cao Vũ Trụ • Rơi Mảnh Titan/Ancient!', durationSec: 30, rewardGold: 3600, rewardGlory: 340, rewardStones: 60, rewardGenCores: 9, shardCount: 24, color: '#ef4444' },
];

// ==================== 5. HỘI QUÁN (BANG HỘI) & BOSS HỘI QUÁN ====================
export const GUILD_BOSSES: readonly GuildBossDef[] = [
  {
    id: 'gboss-gusai',
    name: 'Boss Hội Quán: Gusai Hỏa Ngục',
    subtitle: 'Boss Săn Vùng Nhật • Thiêu Đốt Diện Rộng',
    petId: 'pet-1350',
    spriteId: '1350',
    maxHp: 48000,
    rewardGold: 1500,
    rewardGlory: 150,
    rewardStones: 26,
    rewardShards: 12,
    guildExp: 260,
  },
  {
    id: 'gboss-humex',
    name: 'Boss Hội Quán: Humex Bạo Chúa',
    subtitle: 'Boss Đi Săn Lv.18 • Máu Trâu & Giáp Cực Đại',
    petId: 'pet-boss-humex',
    spriteId: '2367',
    maxHp: 85000,
    rewardGold: 2400,
    rewardGlory: 240,
    rewardStones: 40,
    rewardShards: 16,
    guildExp: 450,
  },
  {
    id: 'gboss-spetra',
    name: 'Boss Hội Quán: Spetra Ma Vương Hư Không',
    subtitle: 'Siêu Boss Đỉnh Cao • Hồi Sinh & Xuyên Giáp',
    petId: 'pet-boss-spetra',
    spriteId: '2440',
    maxHp: 145000,
    rewardGold: 3900,
    rewardGlory: 390,
    rewardStones: 65,
    rewardShards: 22,
    guildExp: 750,
  },
];

// ==================== 6. QUÀ ONLINE ĐẾM NGƯỢC & HỘP THƯ ====================
export const ONLINE_REWARDS = [
  { id: 'onl-1', minutes: 1, label: '1 Phút: +500 Vàng', gold: 500, stones: 5, gloryCoins: 30, genCores: 0 },
  { id: 'onl-2', minutes: 3, label: '3 Phút: +15 Đá & 60 Xu', gold: 400, stones: 15, gloryCoins: 60, genCores: 1 },
  { id: 'onl-3', minutes: 5, label: '5 Phút: +1,200 Vàng & 2 Gen', gold: 1200, stones: 10, gloryCoins: 90, genCores: 2 },
  { id: 'onl-4', minutes: 10, label: '10 Phút: +150 Xu Vinh Quang', gold: 1500, stones: 25, gloryCoins: 150, genCores: 3 },
  { id: 'onl-5', minutes: 15, label: '15 Phút: +2,500V & 5 Gen T2', gold: 2500, stones: 40, gloryCoins: 240, genCores: 5 },
] as const;

export const DEFAULT_MAILS: readonly MailItemDef[] = [
  {
    id: 'mail-welcome-40',
    title: 'Chào mừng trở lại Pokiwar 4.0 Zing Me!',
    sender: 'Ban Điều Hành Pokiwar 4.0',
    body: 'Chào mừng Chiến Binh đến với bản đồ Phó Bản 6 Đảo Ải Viễn Chinh chuẩn Zing Me: Đánh thắng lần đầu sở hữu ngay Pet Phó Bản, Vượt Ải Tháp 10 Tầng, Đi Săn Boss Humex / Spetra và toàn bộ Thẻ Kỹ Năng Đặc Biệt Mega / Galaxy / Fantasy!',
    createdAt: 'Hôm nay',
    rewards: { gold: 2000, gloryCoins: 200, genCores: 4, stamina: 40, petId: 'pet-kassadin', shards: 15 },
  },
  {
    id: 'mail-king-season',
    title: 'Quà Khai Mùa Đấu Trường Bá Vương 5v5',
    sender: 'Hội Đồng Bá Vương',
    body: 'Hãy xếp đội hình 5 Thần Thú (2 Tiền Tuyến + 3 Hậu Tuyến) tham gia Đấu Trường Bá Vương để tích lũy Xu Vinh Quang đổi Cánh, Vòng Sáng Hắc Kim và Mảnh Titan!',
    createdAt: 'Hôm nay',
    rewards: { gold: 1200, gloryCoins: 150, stones: 20 },
  },
];

// ==================== 7. NÂNG CẤP PET 4.0: TÍCH LŨY MAY MẮN, XẾP NHANH & NÂNG GEN ====================
export const GEN_UPGRADE_CORE_COSTS = [2, 4, 7, 11, 16] as const;
export const GEN_UPGRADE_GOLD_COSTS = [600, 1200, 2200, 3600, 5500] as const;

/**
 * Tính tỉ lệ đập Level chuẩn Pokiwar 4.0 Zing Me:
 * - Hỗ trợ Xếp Nhanh nhiều viên đá cùng lúc (stonesUsed = [c1, c2, c3, c4, c5])
 * - Cộng dồn % Tích Lũy May Mắn từ những lần xịt trước (accumulatedLuck)
 * - Cộng +15% khi dùng Bùa May Mắn
 */
export function calcMultiStoneUpgradeRate(
  currentLv: number,
  selectedStones: [number, number, number, number, number],
  accumulatedLuck = 0,
  useMayMan = false,
): number {
  if (currentLv <= 2) return 100;
  const weights = [8, 14, 22, 34, 52];
  let stonePower = 0;
  for (let i = 0; i < 5; i++) {
    stonePower += (selectedStones[i] ?? 0) * weights[i];
  }
  if (stonePower <= 0) return 0;
  const lvPenalty = Math.max(0, currentLv - 3) * 5;
  const base = 36 + stonePower - lvPenalty + accumulatedLuck + (useMayMan ? 15 : 0);
  return Math.max(5, Math.min(100, Math.round(base)));
}
