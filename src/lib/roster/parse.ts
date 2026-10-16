import {
  SLOTS,
  emptyStats,
  type Artifact,
  type Bonus,
  type Champion,
  type ChampionTag,
  type RosterData,
  type Slot,
  type StatKey,
  type Stats,
} from "./types";

type Obj = Record<string, unknown>;

/** Case-insensitive key lookup across several aliases. */
function pick(o: unknown, ...keys: string[]): unknown {
  if (!o || typeof o !== "object") return undefined;
  const rec = o as Obj;
  const map = new Map(Object.keys(rec).map((k) => [k.toLowerCase(), k]));
  for (const k of keys) {
    const real = map.get(k.toLowerCase());
    if (real !== undefined && rec[real] !== undefined && rec[real] !== null) return rec[real];
  }
  return undefined;
}
const str = (v: unknown, d = "") => (v === undefined || v === null ? d : String(v));
const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const RANK_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
function parseRank(v: unknown): number {
  if (typeof v === "number") return Math.max(1, Math.min(6, v));
  const s = str(v).toLowerCase();
  if (RANK_WORDS[s]) return RANK_WORDS[s]!;
  const m = s.match(/(\d)/);
  return m ? Number(m[1]) : 1;
}

const STAT_ALIASES: Record<string, StatKey> = {
  health: "hp", hp: "hp", attack: "atk", atk: "atk", defense: "def", defence: "def", def: "def",
  speed: "spd", spd: "spd", resistance: "res", res: "res", accuracy: "acc", acc: "acc",
  criticalchance: "cr", critchance: "cr", critrate: "cr", "c.rate": "cr", cr: "cr", crate: "cr",
  criticaldamage: "cd", critdamage: "cd", criticalheal: "cd", "c.dmg": "cd", cd: "cd", cdmg: "cd",
};
function parseStat(v: unknown): StatKey | undefined {
  const s = str(v).toLowerCase().replace(/[\s_%-]/g, "");
  return STAT_ALIASES[s];
}

function parseBonus(b: unknown): Bonus | null {
  const stat = parseStat(pick(b, "kind", "stat", "type", "name", "Stat"));
  if (!stat) return null;
  let value = num(pick(b, "value", "Value", "amount"));
  const enh = num(pick(b, "enhancement", "glyph", "glyphValue"));
  const absRaw = pick(b, "isAbsolute", "absolute", "flat", "isFlat");
  let flat = absRaw === undefined ? !["cr", "cd"].includes(stat) && value > 1 && !(value <= 100 && ["hp", "atk", "def"].includes(stat) && value < 70) : Boolean(absRaw);
  if (["spd", "acc", "res"].includes(stat)) flat = true;
  // HellHades stores percents as fractions (0.16 = 16%)
  if (!flat && value > 0 && value < 1.5) value = value * 100;
  value += enh && !flat && enh < 1.5 ? enh * 100 : enh;
  return { stat, value: Math.round(value * 10) / 10, flat };
}

function parseSlot(v: unknown): Slot {
  const s = str(v).toLowerCase();
  const found = SLOTS.find((x) => s.includes(x.toLowerCase()));
  if (found) return found;
  if (s.includes("cloak") || s.includes("chest") || s.includes("armor")) return "Chest";
  if (s.includes("ring")) return "Ring";
  return "Weapon";
}

function prettify(s: string) {
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim();
}

function parseArtifact(a: unknown, ownerId?: string): Artifact {
  const primary = parseBonus(pick(a, "primaryBonus", "primary", "mainStat", "main")) ?? { stat: "hp", value: 0, flat: true };
  return {
    id: str(pick(a, "id", "Id", "artifactId"), crypto.randomUUID()),
    slot: parseSlot(pick(a, "kind", "slot", "type", "artifactType")),
    set: prettify(str(pick(a, "setKind", "set", "setName"), "None")),
    rank: parseRank(pick(a, "rank", "stars", "grade")),
    rarity: prettify(str(pick(a, "rarity"), "Common")),
    level: num(pick(a, "level", "lvl")),
    faction: str(pick(a, "faction", "requiredFraction", "fraction")) || undefined,
    primary,
    subs: arr(pick(a, "secondaryBonuses", "substats", "subStats", "secondary", "subs"))
      .map(parseBonus)
      .filter((x): x is Bonus => !!x),
    ownerId: ownerId ?? (str(pick(a, "ownerId", "heroId", "championId", "wearer")) || undefined),
  };
}

function parseBaseStats(h: unknown): Stats {
  const src = pick(h, "baseStats", "stats", "base") ?? h;
  const s = emptyStats();
  s.hp = num(pick(src, "health", "hp"));
  s.atk = num(pick(src, "attack", "atk"));
  s.def = num(pick(src, "defense", "def"));
  s.spd = num(pick(src, "speed", "spd"));
  s.res = num(pick(src, "resistance", "res"));
  s.acc = num(pick(src, "accuracy", "acc"));
  const cr = num(pick(src, "criticalChance", "critRate", "cr"));
  const cd = num(pick(src, "criticalDamage", "critDamage", "cd"));
  s.cr = cr > 0 && cr <= 1.5 ? cr * 100 : cr;
  s.cd = cd > 0 && cd <= 5 ? cd * 100 : cd;
  // Some exports store HP divided by 15 (in-game base unit)
  if (s.hp > 0 && s.hp < 3000) s.hp = s.hp * 15;
  return s;
}

function parseChampion(h: unknown, tag?: ChampionTag): Champion {
  const locked = Boolean(pick(h, "locked", "isLocked"));
  return {
    id: str(pick(h, "id", "Id", "heroId", "championId"), crypto.randomUUID()),
    name: str(pick(h, "name", "Name", "championName"), "Unknown"),
    level: num(pick(h, "level", "lvl"), 1),
    rank: parseRank(pick(h, "grade", "rank", "stars")),
    rarity: prettify(str(pick(h, "rarity"), "Rare")),
    affinity: prettify(str(pick(h, "element", "affinity"), "Magic")),
    faction: prettify(str(pick(h, "fraction", "faction"), "Unknown")),
    role: prettify(str(pick(h, "role", "type"), "Attack")),
    inVault: Boolean(pick(h, "inVault", "inStorage", "vault")),
    tag: tag ?? (locked ? "core" : "active"),
    base: parseBaseStats(h),
  };
}

export type DetectedFormat = "HellHades Artifact Extractor" | "RSL Helper" | "Raid Companion backup" | "Generic JSON";

export function detectFormat(json: unknown): DetectedFormat {
  if (pick(json, "rtcVersion")) return "Raid Companion backup";
  if (Array.isArray(pick(json, "heroes")) && Array.isArray(pick(json, "artifacts"))) {
    const firstHero = arr(pick(json, "heroes"))[0];
    if (firstHero && pick(firstHero, "fraction") !== undefined) return "HellHades Artifact Extractor";
  }
  const keys = json && typeof json === "object" ? Object.keys(json as Obj) : [];
  if (keys.some((k) => /^(Champions|Heroes|Artifacts|Account)$/.test(k))) return "RSL Helper";
  if (Array.isArray(pick(json, "heroes"))) return "HellHades Artifact Extractor";
  return "Generic JSON";
}

export function parseImport(text: string): RosterData & { format: DetectedFormat; warnings: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const format = detectFormat(json);
  const warnings: string[] = [];
  const root = (pick(json, "account", "Account", "data") as Obj | undefined) ?? json;

  if (format === "Raid Companion backup") {
    const d = json as RosterData;
    return { champions: d.champions ?? [], artifacts: d.artifacts ?? [], format, warnings };
  }

  const heroesRaw = arr(pick(root, "heroes", "champions", "Heroes", "Champions"));
  if (!heroesRaw.length && Array.isArray(root)) heroesRaw.push(...root);
  const champions = heroesRaw.map((h) => parseChampion(h));

  const artifacts: Artifact[] = [];
  const seen = new Set<string>();
  const add = (a: Artifact) => {
    if (seen.has(a.id)) {
      const existing = artifacts.find((x) => x.id === a.id);
      if (existing && !existing.ownerId && a.ownerId) existing.ownerId = a.ownerId;
      return;
    }
    seen.add(a.id);
    artifacts.push(a);
  };

  // Top-level inventory (HellHades / RSL Helper)
  const topArts = [...arr(pick(root, "artifacts", "Artifacts", "gear", "items")), ...arr(pick(root, "accessories", "Accessories"))];
  topArts.forEach((a) => add(parseArtifact(a)));

  // Hero -> artifact links (id references or embedded objects)
  heroesRaw.forEach((h, i) => {
    const champId = champions[i]!.id;
    arr(pick(h, "artifacts", "equipped", "gear", "Equipped", "Artifacts")).forEach((ref) => {
      if (ref && typeof ref === "object") add(parseArtifact(ref, champId));
      else {
        const target = artifacts.find((a) => a.id === String(ref));
        if (target) target.ownerId = champId;
      }
    });
  });

  if (!champions.length) warnings.push("No champions found in this file.");
  if (!artifacts.length) warnings.push("No gear found in this file.");
  return { champions, artifacts, format, warnings };
}
