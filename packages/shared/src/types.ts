export type ElementType = 'KIM' | 'MOC' | 'THUY' | 'HOA' | 'THO';

/**
 * 6 Classic Pokiwar / PokiGuard Match-3 Gems:
 * - SWORD: Physical damage (Kiếm - boosted at 100/200 Nộ)
 * - LIGHTNING: Mana charge (Mana - dùng Thẻ Tiến Hóa / Chưởng / Skill)
 * - FIRE: Rage / Power charge + flame splash (Nộ - max 250)
 * - HEART: Instant HP heal (Máu)
 * - YINYANG: Shield / Armor (Giáp)
 * - COIN: Drain Mana & Rage from enemy + bonus Gold (Hút)
 */
export type GemType = 'SWORD' | 'LIGHTNING' | 'FIRE' | 'HEART' | 'YINYANG' | 'COIN';

export type EvolutionTier =
  | 'BASE'
  | 'S'
  | 'LEGEND'
  | 'MEGA'
  | 'GALAXY'
  | 'FANTASY'
  | 'ANCIENT'
  | 'TITAN'
  | 'MECH';

export type PassiveSkillKind =
  | 'CUONG_HUYET'
  | 'HOI_SINH'
  | 'PHAN_DON'
  | 'XUYEN_GIAP'
  | 'HAP_HUYET'
  | 'HO_GIAP'
  | 'CUONG_NO';

export interface PetPassiveDef {
  name: string;
  description: string;
  kind: PassiveSkillKind;
  value: number;
}

export type BotDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export type Side = 'P1' | 'P2';

export type QteGrade = 'PERFECT' | 'GOOD' | 'BAD';

export type SupportCardId =
  | 'MANA_100'
  | 'RAGE_50'
  | 'HP_350'
  | 'SHIELD_300'
  | 'ATK_BUFF'
  | 'FREEZE_1'
  | 'PURIFY_HEAL'
  | 'DRAIN_60';

export interface Pos {
  row: number;
  col: number;
}

export interface GemCell {
  id: number;
  type: GemType;
  /** Dot.multiplier: 1, 2, 3, or 4 (x2/x3/x4 badges in PokiGuard) */
  multiplier?: 1 | 2 | 3 | 4;
}

export type BoardGrid = GemCell[][];

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  rageCost: number;
  manaCost?: number;
  cooldown: number;
  powerRatio: number;
  damageKind: 'PHYSICAL' | 'MAGIC' | 'NONE';
  cardImage?: string;
  /** Ultimate Pet Skill triggers Pokiwar QTE Audition arrows + Spacebar timing */
  needPerfection?: boolean;
  /** Marks authentic Pokiwar 4.0 Zing Me Special Skill Card (Thẻ Kỹ Năng Đặc Biệt) */
  isSpecialCard?: boolean;
  /** Vietnamese summary of the Special Card's Bị Động / Nội Tại effect shown in tooltip */
  specialPassiveNote?: string;
  healPercentMaxHp?: number;
  shieldAmount?: number;
  /** Boosts caster maxHp by % (e.g. Mega Elpidios / Mega Twin Flame / Galaxy Chess Master) */
  maxHpBoostPercent?: number;
  /**
   * Authentic Pokiwar 4.0 Zing Me Special Skill Card board effects:
   * - BURN_ROWS: Mega Zidarose (3 hàng), Mega Elpidios (3 hàng), Mega Hyon Tử Phiến (1 hàng)
   * - SEAL_REGION: Mega Icarus Kết Ấn / Primal Orithyia Băng Ngục (phong ấn vùng 5x5 + x2/x3/x4 rồi bộc hỏa)
   * - CROSS_EXPLODE: Mega Fireware (chọn 2 tâm điểm nổ chữ thập +)
   * - BOMB_3X3: Mega Issylt (chọn 3 viên nổ bom 3x3 + x2)
   * - CONSUME_GEMS: Mega Ahrina (Kiếm), Galaxy Aquar (Mana+Giáp), Chess Master (Nộ+Giáp), Fairy (Mana+Hút), Glank (Giáp), God (Nộ+Giáp), Fantasy Joker (Đa hệ)
   * - FATE_CARD: Galaxy Risky (rút 1 trong 3 lá Bài Đỏ/Vàng/Xanh)
   * - SPAWN_MULTIPLIERS: Mega Twin Flame / Twin Frost / Priest / Zero / Prysma / Galaxy Blume
   */
  boardEffect?:
    | 'BURN_ROWS'
    | 'SPAWN_MULTIPLIERS'
    | 'SEAL_REGION'
    | 'CROSS_EXPLODE'
    | 'BOMB_3X3'
    | 'CONSUME_GEMS'
    | 'FATE_CARD';
  /** Number of rows burned for BURN_ROWS (defaults to 3; Mega Hyon Tử Phiến = 1) */
  burnRowCount?: number;
  /** Gem types swept across the board for CONSUME_GEMS */
  consumeGemTypes?: GemType[];
  /** Also spawn x2/x3 multiplier tiles after clearing board cells */
  spawnMultipliersAfter?: boolean;
  /** Mana refunded after casting (e.g. Galaxy Glank +100 Mana, Mega Prysma +140 Mana) */
  manaRefund?: number;
  /** Bonus execute burst when defender HP ratio <= threshold (e.g. Galaxy Aquar 0.35) */
  executeThresholdPercent?: number;
  /** Lifesteal ratio [0..1] of skill damage dealt */
  lifestealRatio?: number;
  /** Ignore target defense ratio [0..1] (e.g. Ancient Arceus / Titan Thanos xuyên giáp) */
  armorPierceRatio?: number;
  /** Cleanse caster debuffs (BURN/POISON) on cast */
  cleanseDebuffs?: boolean;
  /** Probability [0..1] for statusEffect to trigger; defaults to 1 */
  statusChance?: number;
  statusEffect?: {
    kind: 'BURN' | 'POISON' | 'STUN' | 'ATK_UP' | 'SHIELD_REGEN' | 'DEEP_WOUND' | 'SILENCE' | 'REFLECT';
    value: number;
    durationTurns: number;
  };
}

export interface SynthesisRecipeDef {
  requiredPetId: string;
  requiredPetLevel: number;
  stoneLevel: number;
  stoneCount: number;
  goldCost: number;
}

export interface PetDef {
  id: string;
  /** Primary numeric Pokiwar sprite ID in /assets/pokiguard/pets/<spriteId>.png */
  spriteId: string;
  /** Standalone fixed sprite map (every tier maps to this Pet's own fixed spriteId) */
  evolutionSprites: Partial<Record<EvolutionTier, string>>;
  name: string;
  title: string;
  element: ElementType;
  tier: EvolutionTier;
  maxHp: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
  maxRage: number;
  colorPrimary: string;
  colorSecondary: string;
  skills: SkillDef[];
  /** Authentic Pokiwar Zing Me (4.0) Synthesis Recipe at Tế Đàn Hợp Pet */
  synthesisRecipe?: SynthesisRecipeDef;
  /** Authentic Pokiwar 4.0 Passive Skill (active in 1v1 & Đấu Trường Bá Vương 5v5) */
  passiveSkill?: PetPassiveDef;
  /** Current Star Rating (1★..6★ Siêu Tiến Hóa) */
  stars?: number;
  /** Gen Level (0..5 Nâng Cấp Gen Pokiwar 4.0) */
  genLevel?: number;
}

export interface TrainerAvatarDef {
  id: string;
  name: string;
  path: string;
  costGold: number;
  hpBonus: number;
  atkBonus: number;
  manaBonus: number;
}

export interface ActiveStatus {
  kind: 'BURN' | 'POISON' | 'STUN' | 'ATK_UP' | 'SHIELD_REGEN' | 'DEEP_WOUND' | 'SILENCE' | 'REFLECT';
  value: number;
  remainingTurns: number;
}

export interface BattleFighter {
  side: Side;
  petId: string;
  spriteId: string;
  evolutionSprites: Partial<Record<EvolutionTier, string>>;
  name: string;
  level: number;
  element: ElementType;
  tier: EvolutionTier;
  hp: number;
  maxHp: number;
  shield: number;
  mana: number;
  maxMana: number;
  rage: number;
  maxRage: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
  consecutivePasses: number;
  inBattleEvolved: boolean;
  colorPrimary: string;
  colorSecondary: string;
  skills: SkillDef[];
  cooldowns: Record<string, number>;
  statuses: ActiveStatus[];
  supportUsed?: Partial<Record<SupportCardId, boolean>>;
  equippedSupportCards?: SupportCardId[];
  supportCardLevels?: Partial<Record<SupportCardId, number>>;
  stars?: number;
  genLevel?: number;
  reviveCharges?: number;
  maxReviveCharges?: number;
  /** Mega Twin Frost passive: once-per-battle heal to 70% max HP when dropping <= 20% HP */
  emergencyHealUsed?: boolean;
  passiveSkill?: PetPassiveDef;
  auraId?: string;
  guardPetId?: string;
  guardPetName?: string;
  guardPetSpriteId?: string;
  /** Authentic Pokiwar 4.0 Pet Hợp Thể (Secondary Fusion Partner) */
  fusionPetId?: string;
  fusionPetName?: string;
  fusionPetSpriteId?: string;
  fusionStrikeUsed?: boolean;
  /** Pokiwar 4.0 Tích Lũy Stacks (0..10): +1 on 4+ gem match, +4% ATK/MAG per stack */
  accumStacks?: number;
  /** Pokiwar 4.0 Đột Phá Pet Level (0..5) */
  breakthroughLevel?: number;
  allyCount?: number;
}

export type DungeonIslandId =
  | 'ISLAND_1'
  | 'ISLAND_2'
  | 'ISLAND_3'
  | 'ISLAND_4'
  | 'ISLAND_5'
  | 'ISLAND_6';

export interface DungeonIslandDef {
  id: DungeonIslandId;
  order: number;
  name: string;
  subtitle: string;
  element: ElementType;
  bgSprite: string;
  iconSprite: string;
  bossPetId: string;
  xPercent: number;
  yPercent: number;
  colorHex: string;
}

export interface StageDef {
  id: string;
  name: string;
  subtitle: string;
  islandName: string;
  islandSprite: string;
  islandId?: DungeonIslandId;
  stageOrder?: number;
  isBoss?: boolean;
  /** Pokiwar authentic rule: winning for the FIRST time grants ownership of enemyPetId; replaying does NOT grant it again */
  captureOnFirstClear?: boolean;
  mode: 'STORY' | 'ZODIAC_TOMB' | 'BOSS' | 'MEGA_ARENA' | 'ENDLESS_TOWER';
  difficulty: BotDifficulty;
  enemyPetId: string;
  enemyTier?: EvolutionTier;
  enemyScale: number;
  arenaBg: string;
  recommendedPower: number;
  rewards: {
    gold: number;
    exp: number;
    stones: number;
  };
}

export interface MatchGroup {
  positions: Pos[];
  gemType: GemType;
  length: number;
  /** Sum of cell multipliers (x1/x2/x3/x4) cleared in this group */
  effectiveValue: number;
  isExtraTurn: boolean;
}

export interface GravityDrop {
  gemId: number;
  type: GemType;
  multiplier: 1 | 2 | 3 | 4;
  fromRow: number;
  toRow: number;
  col: number;
  isNew: boolean;
}

export type BattleEvent =
  | {
      type: 'SWAP';
      side: Side;
      from: Pos;
      to: Pos;
    }
  | {
      type: 'MATCH_CLEAR';
      cascadeIndex: number;
      groups: MatchGroup[];
      comboMultiplier: number;
    }
  | {
      type: 'BOARD_REFILL';
      drops: GravityDrop[];
      boardAfter: BoardGrid;
    }
  | {
      type: 'BOARD_SHUFFLE';
      boardAfter: BoardGrid;
    }
  | {
      type: 'RESOURCE_DELTA';
      side: Side;
      target: Side;
      gemType: GemType;
      count: number;
      damage?: number;
      shieldAbsorbed?: number;
      heal?: number;
      shieldGain?: number;
      manaGain?: number;
      rageGain?: number;
      purpleGain?: number;
      manaDrained?: number;
      rageDrained?: number;
      goldGain?: number;
      elementMultiplier?: number;
      isCrit?: boolean;
    }
  | {
      type: 'SKILL_CAST';
      side: Side;
      skillId: string;
      skillName: string;
      damage?: number;
      shieldAbsorbed?: number;
      heal?: number;
      shieldGain?: number;
      elementMultiplier?: number;
      appliedStatus?: ActiveStatus['kind'];
      qteGrade?: QteGrade;
      specialNote?: string;
    }
  | {
      type: 'DEFAULT_CAST';
      side: Side;
      skillName: string;
      manaCost: number;
      damage: number;
      shieldAbsorbed: number;
      elementMultiplier: number;
    }
  | {
      type: 'IN_BATTLE_EVOLVE';
      side: Side;
      newTier: EvolutionTier;
      newSpriteId: string;
      hpBonus: number;
      manaBonus: number;
    }
  | {
      type: 'SUPPORT_CARD_CAST';
      side: Side;
      cardId: SupportCardId;
      cardName: string;
      manaGain?: number;
      rageGain?: number;
      heal?: number;
      shieldGain?: number;
      damage?: number;
      manaDrained?: number;
      rageDrained?: number;
      appliedStatus?: ActiveStatus['kind'];
    }
  | {
      type: 'PASS_TURN';
      side: Side;
      consecutivePasses: number;
      autoLost?: boolean;
    }
  | {
      type: 'STATUS_TICK';
      side: Side;
      kind: ActiveStatus['kind'];
      damage?: number;
      heal?: number;
      skippedTurn?: boolean;
    }
  | {
      type: 'EXTRA_TURN';
      side: Side;
      reason: string;
    }
  | {
      type: 'TURN_CHANGE';
      nextTurn: Side;
      turnNumber: number;
    }
  | {
      type: 'REVIVE';
      side: Side;
      hpRestored: number;
      remainingCharges: number;
    }
  | {
      type: 'FUSION_STRIKE';
      side: Side;
      partnerName: string;
      damage: number;
      shieldAbsorbed: number;
      heal: number;
      shieldGain: number;
      elementMultiplier: number;
    }
  | {
      type: 'BATTLE_END';
      winner: Side;
      reason: 'KO' | 'SURRENDER' | 'DISCONNECT' | 'PASS_LIMIT';
    };

export type EquipmentSlot = 'NON' | 'VU_KHI' | 'CANH' | 'AO' | 'GIAY' | 'HIEU_UNG';

export interface EquipmentItemDef {
  id: string;
  slot: EquipmentSlot;
  name: string;
  stars: number;
  icon: string;
  hpBonus: number;
  atkBonus: number;
  magicBonus: number;
  defenseBonus: number;
  speedBonus: number;
  costGold?: number;
  costGlory?: number;
  rarity: 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
}

export interface AuraDef {
  id: string;
  name: string;
  description: string;
  colorHex: string;
  ringColorHex: string;
  icon: string;
  hpBonus: number;
  atkBonus: number;
  defenseBonus: number;
  costGold?: number;
  costGlory?: number;
  sourceLabel: string;
}

export interface GloryShopItemDef {
  id: string;
  kind: 'SHARD' | 'EQUIPMENT' | 'AURA' | 'STONE_LV5' | 'GEN_CORE' | 'CHARM';
  name: string;
  icon: string;
  refId?: string;
  amount: number;
  baseCostGlory: number;
  salePercent: number;
  rarity: 'RARE' | 'EPIC' | 'LEGENDARY';
}

export interface ChestDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  costGold: number;
  costGlory?: number;
  tier: 'STARTER' | 'WARRIOR' | 'ARTIFACT' | 'ANCIENT' | 'GUARD';
}

export interface SpaceShipDef {
  id: string;
  tierScore: number;
  name: string;
  subtitle: string;
  durationSec: number;
  rewardGold: number;
  rewardGlory: number;
  rewardStones: number;
  rewardGenCores: number;
  shardCount: number;
  color: string;
}

export interface GuildBossDef {
  id: string;
  name: string;
  subtitle: string;
  petId: string;
  spriteId: string;
  maxHp: number;
  rewardGold: number;
  rewardGlory: number;
  rewardStones: number;
  rewardShards: number;
  guildExp: number;
}

export interface MailItemDef {
  id: string;
  title: string;
  sender: string;
  body: string;
  createdAt: string;
  rewards: {
    gold?: number;
    stones?: number;
    gloryCoins?: number;
    genCores?: number;
    stamina?: number;
    petId?: string;
    shards?: number;
  };
  claimed?: boolean;
}

export interface ChatMessage {
  id: string;
  channel: 'WORLD' | 'SERVER' | 'GUILD' | 'SYSTEM';
  sender: string;
  vip?: number;
  text: string;
  ts: number;
}

export interface KingArenaUnitInput {
  slot: number; // 0,1 = Tiền tuyến; 2,3,4 = Hậu tuyến
  pet: PetDef;
  level: number;
  stars: number;
  genLevel: number;
}

export interface KingArenaUnitState {
  id: string;
  side: Side;
  slot: number;
  petId: string;
  spriteId: string;
  name: string;
  element: ElementType;
  tier: EvolutionTier;
  level: number;
  stars: number;
  hp: number;
  maxHp: number;
  shield: number;
  rage: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
  reviveCharges: number;
  passiveSkill?: PetPassiveDef;
  alive: boolean;
}

export interface KingArenaAction {
  step: number;
  round: number;
  actorId: string;
  actorSide: Side;
  actorName: string;
  targetIds: string[];
  skillName: string;
  isUltimate: boolean;
  damages: Record<string, number>;
  heals?: Record<string, number>;
  reflected?: number;
  revivedIds?: string[];
  summary: string;
  snapshot: Record<string, { hp: number; maxHp: number; shield: number; rage: number; alive: boolean; reviveCharges: number }>;
}

export interface KingArenaResult {
  winner: Side;
  rounds: number;
  initialUnits: KingArenaUnitState[];
  actions: KingArenaAction[];
  playerSurvivors: number;
  enemySurvivors: number;
}

export interface BattleState {
  rows: number;
  cols: number;
  board: BoardGrid;
  fighters: Record<Side, BattleFighter>;
  currentTurn: Side;
  turnNumber: number;
  winner: Side | null;
  rngState: number;
  nextGemId: number;
  bonusGold: Record<Side, number>;
  /** Pokiwar 4.0 Hiệu Ứng Ngũ Hành Đấu Trường (+50% DMG/+20% HP matching, -50%/-20% countered) */
  fieldElement?: ElementType;
  /** Pokiwar 4.0 Đảo Châu Báu Equalizer Rules (bans Mega/Galaxy/Fantasy special cards, Guard, Fusion) */
  restrictedRules?: boolean;
}
