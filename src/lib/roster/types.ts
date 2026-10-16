export type StatKey = "hp" | "atk" | "def" | "spd" | "res" | "acc" | "cr" | "cd";

export const STAT_LABEL: Record<StatKey, string> = {
  hp: "HP",
  atk: "ATK",
  def: "DEF",
  spd: "SPD",
  res: "RES",
  acc: "ACC",
  cr: "C.RATE",
  cd: "C.DMG",
};

export const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spd", "res", "acc", "cr", "cd"];

export type Stats = Record<StatKey, number>;

export type ChampionTag = "core" | "active" | "donor";

export const TAG_LABEL: Record<ChampionTag, string> = {
  core: "Core / Locked",
  active: "Active",
  donor: "Safe Donor",
};

export const SLOTS = ["Weapon", "Helmet", "Shield", "Gloves", "Chest", "Boots", "Ring", "Amulet", "Banner"] as const;
export type Slot = (typeof SLOTS)[number];
export const ACCESSORY_SLOTS: Slot[] = ["Ring", "Amulet", "Banner"];

export type Bonus = { stat: StatKey; value: number; flat: boolean };

export type Artifact = {
  id: string;
  slot: Slot;
  set: string;
  rank: number;
  rarity: string;
  level: number;
  faction?: string;
  primary: Bonus;
  subs: Bonus[];
  ownerId?: string;
};

export type Champion = {
  id: string;
  name: string;
  level: number;
  rank: number;
  rarity: string;
  affinity: string;
  faction: string;
  role: string;
  tag: ChampionTag;
  inVault?: boolean;
  base: Stats;
};

export type RosterData = {
  champions: Champion[];
  artifacts: Artifact[];
  source?: string;
  importedAt?: string;
};

export const emptyStats = (): Stats => ({ hp: 0, atk: 0, def: 0, spd: 0, res: 0, acc: 0, cr: 0, cd: 0 });
