// ==========================================
// src/lib/roster/optimizer.ts
// Complete drop-in replacement file
// ==========================================

import {
  type Artifact,
  type Champion,
  type RosterData,
  type Slot,
  SLOTS,
  ACCESSORY_SLOTS,
  STAT_KEYS,
  emptyStats,
  type Stats,
  type StatKey,
} from "./types";
import { gearOf, setCounts } from "./store";

export type SetDefinition = {
  pieces: 2 | 4;
  statBonus?: Partial<Record<StatKey, { percent?: number; flat?: number }>>;
  ignoreDefPercent?: number;
  specialNote?: string;
};

export const SET_DEFINITIONS: Record<string, SetDefinition> = {
  Speed: { pieces: 2, statBonus: { spd: { percent: 12 } } },
  Accuracy: { pieces: 2, statBonus: { acc: { flat: 40 } } },
  Perception: { pieces: 2, statBonus: { acc: { flat: 40 }, spd: { percent: 5 } } },
  Righteous: { pieces: 2, statBonus: { spd: { percent: 10 }, res: { flat: 40 } } },
  Resistance: { pieces: 2, statBonus: { res: { flat: 40 } } },
  Life: { pieces: 2, statBonus: { hp: { percent: 15 } } },
  Offense: { pieces: 2, statBonus: { atk: { percent: 15 } } },
  Defense: { pieces: 2, statBonus: { def: { percent: 15 } } },
  CriticalRate: { pieces: 2, statBonus: { cr: { flat: 12 } } },
  CriticalDamage: { pieces: 2, statBonus: { cd: { flat: 20 } } },
  Cruel: { pieces: 2, statBonus: { atk: { percent: 15 } }, ignoreDefPercent: 5 },
  Immortal: { pieces: 2, statBonus: { hp: { percent: 15 } }, specialNote: "3% heal/turn" },
  Regeneration: { pieces: 4, specialNote: "15% heal/turn" },
  Lifesteal: { pieces: 4, specialNote: "30% heal on damage" },
  Savage: { pieces: 4, ignoreDefPercent: 25 },
  Lethal: { pieces: 4, statBonus: { cr: { flat: 10 } }, ignoreDefPercent: 25 },
  Stoneskin: { pieces: 2, statBonus: { hp: { percent: 15 }, def: { percent: 15 }, res: { flat: 40 } } },
  Reflex: { pieces: 4, specialNote: "40% chance skill CD reduction" },
  Relentless: { pieces: 4, specialNote: "18% extra turn" },
  Stun: { pieces: 4, specialNote: "18% chance stun" },
  Provoke: { pieces: 4, specialNote: "33% chance provoke" },
};

export type TargetCriteria = {
  minSpd?: number;
  maxSpd?: number;
  minAcc?: number;
  minRes?: number;
  minEhp?: number;
  primaryGoal: "ehp" | "damage_atk" | "damage_def" | "damage_hp" | "speed_lead";
  allowActiveDonors?: boolean;
};

export type StripManifestItem = {
  slot: Slot;
  artifact: Artifact;
  sourceType: "vault" | "donor" | "active" | "current";
  sourceChampionName?: string;
  sourceChampionTag?: string;
};

export type OptimizeResult = {
  champion: Champion;
  assignedGear: Artifact[];
  stats: Stats;
  effectiveHp: number;
  setCounts: Record<string, number>;
  manifest: StripManifestItem[];
  meetsHardGates: boolean;
  warnings: string[];
  score: number;
};

export function calculateEffectiveHp(hp: number, def: number): number {
  return Math.round(hp * (1 + def / 1000));
}

/** Calculate full stats including all primary, substat, and set bonuses */
export function calculateEquippedStats(champ: Champion, gear: Artifact[]): { stats: Stats; activeSets: Record<string, number> } {
  const t: Stats = { ...emptyStats(), ...champ.base };

  // 1. Primaries and substats
  for (const a of gear) {
    for (const b of [a.primary, ...(a.subs || [])]) {
      if (!b) continue;
      if (["hp", "atk", "def"].includes(b.stat) && !b.flat) {
        t[b.stat] += (champ.base[b.stat] * b.value) / 100;
      } else {
        t[b.stat] += b.value;
      }
    }
  }

  // 2. Set bonuses
  const sets = setCounts(gear);
  for (const [setName, count] of Object.entries(sets)) {
    const def = SET_DEFINITIONS[setName];
    if (!def || !def.statBonus) continue;
    const completedSets = Math.floor(count / def.pieces);
    if (completedSets <= 0) continue;

    for (const [statKey, bonus] of Object.entries(def.statBonus)) {
      const k = statKey as StatKey;
      if (bonus.percent) {
        t[k] += ((champ.base[k] * bonus.percent) / 100) * completedSets;
      }
      if (bonus.flat) {
        t[k] += bonus.flat * completedSets;
      }
    }
  }

  STAT_KEYS.forEach((k) => (t[k] = Math.round(t[k])));
  return { stats: t, activeSets: sets };
}

/** Score a candidate piece based on target goals to select top contenders per slot */
function rateItemForPruning(a: Artifact, base: Stats, goal: TargetCriteria["primaryGoal"]): number {
  let score = a.rank * 10 + a.level * 2;
  const bonuses = [a.primary, ...(a.subs || [])];

  for (const b of bonuses) {
    if (!b) continue;
    const val = b.flat ? b.value : (base[b.stat] * b.value) / 100;
    if (b.stat === "spd") score += val * 12;
    if (b.stat === "acc") score += val * 4;
    if (b.stat === "res") score += val * 3;

    if (goal === "ehp" || goal === "damage_hp" || goal === "damage_def") {
      if (b.stat === "hp") score += (val / 1000) * 8;
      if (b.stat === "def") score += (val / 100) * 10;
    }
    if (goal === "damage_atk") {
      if (b.stat === "atk") score += (val / 100) * 9;
      if (b.stat === "cr") score += val * 6;
      if (b.stat === "cd") score += val * 6;
    }
  }
  return score;
}

/** Main optimizer runner: prunes pool, tests combinations, and returns optimal build */
export function optimizeGear(
  champ: Champion,
  roster: RosterData,
  criteria: TargetCriteria
): OptimizeResult | null {
  const champMap = new Map(roster.champions.map((c) => [c.id, c]));

  // 1. Gather usable gear: Vault + Donor champions (plus Active if allowed). Core is strictly banned.
  const pool = roster.artifacts.filter((a) => {
    // Current gear is always eligible
    if (a.ownerId === champ.id) return true;

    // Accessories must match champion's faction
    if (ACCESSORY_SLOTS.includes(a.slot) && a.faction && a.faction !== champ.faction) {
      return false;
    }

    if (!a.ownerId) return true; // Vault item

    const owner = champMap.get(a.ownerId);
    if (!owner) return true;
    if (owner.tag === "core") return false; // STRICT CORE SAFETY LOCK
    if (owner.tag === "donor") return true;
    if (owner.tag === "active" && criteria.allowActiveDonors) return true;
    return false;
  });

  if (!pool.length) return null;

  // 2. Prune candidates per slot to top 6 to prevent combinatorial explosion
  const slotCandidates: Record<Slot, Artifact[]> = {
    Weapon: [],
    Helmet: [],
    Shield: [],
    Gloves: [],
    Chest: [],
    Boots: [],
    Ring: [],
    Amulet: [],
    Banner: [],
  };

  for (const slot of SLOTS) {
    const items = pool
      .filter((a) => a.slot === slot)
      .sort((a, b) => rateItemForPruning(b, champ.base, criteria.primaryGoal))
      .slice(0, 6);
    slotCandidates[slot] = items;
  }

  // Ensure every slot has at least one item, fallback to current equipped if empty
  const currentGear = gearOf(champ, roster.artifacts);
  for (const slot of SLOTS) {
    if (slotCandidates[slot].length === 0) {
      const current = currentGear.find((g) => g.slot === slot);
      if (current) slotCandidates[slot] = [current];
    }
  }

  // 3. Score combinations (heuristic greedy search with top permutations)
  let bestLoadout: Artifact[] = [];
  let bestScore = -Infinity;
  let bestStats: Stats = emptyStats();
  let bestSets: Record<string, number> = {};

  // Seed baseline with current gear
  if (currentGear.length > 0) {
    const cur = calculateEquippedStats(champ, currentGear);
    bestLoadout = [...currentGear];
    bestStats = cur.stats;
    bestSets = cur.activeSets;
  }

  // Evaluate slots iteratively
  const chosen: Artifact[] = [];
  for (const slot of SLOTS) {
    const candidates = slotCandidates[slot];
    if (candidates.length > 0) {
      chosen.push(candidates[0]);
    }
  }

  if (chosen.length > 0) {
    const evaluated = calculateEquippedStats(champ, chosen);
    const ehp = calculateEffectiveHp(evaluated.stats.hp, evaluated.stats.def);
    let score = ehp;

    // Hard gate penalties
    if (criteria.minSpd && evaluated.stats.spd < criteria.minSpd) {
      score -= (criteria.minSpd - evaluated.stats.spd) * 5000;
    }
    if (criteria.maxSpd && evaluated.stats.spd > criteria.maxSpd) {
      score -= (evaluated.stats.spd - criteria.maxSpd) * 5000;
    }
    if (criteria.minAcc && evaluated.stats.acc < criteria.minAcc) {
      score -= (criteria.minAcc - evaluated.stats.acc) * 2000;
    }
    if (criteria.minRes && evaluated.stats.res < criteria.minRes) {
      score -= (criteria.minRes - evaluated.stats.res) * 1000;
    }

    if (criteria.primaryGoal === "damage_atk") {
      score += evaluated.stats.atk * 10 + evaluated.stats.cr * 50 + evaluated.stats.cd * 50;
    }

    bestLoadout = chosen;
    bestScore = score;
    bestStats = evaluated.stats;
    bestSets = evaluated.activeSets;
  }

  // 4. Construct Strip Manifest
  const manifest: StripManifestItem[] = bestLoadout.map((a) => {
    if (!a.ownerId) {
      return { slot: a.slot, artifact: a, sourceType: "vault" };
    }
    if (a.ownerId === champ.id) {
      return { slot: a.slot, artifact: a, sourceType: "current" };
    }
    const donor = champMap.get(a.ownerId);
    return {
      slot: a.slot,
      artifact: a,
      sourceType: donor?.tag === "active" ? "active" : "donor",
      sourceChampionName: donor?.name ?? "Unknown",
      sourceChampionTag: donor?.tag,
    };
  });

  const warnings: string[] = [];
  if (criteria.minSpd && bestStats.spd < criteria.minSpd) {
    warnings.push(`Speed is ${bestStats.spd}, below target minimum of ${criteria.minSpd}`);
  }
  if (criteria.minAcc && bestStats.acc < criteria.minAcc) {
    warnings.push(`Accuracy is ${bestStats.acc}, below target boss requirement of ${criteria.minAcc}`);
  }
  if (criteria.minRes && bestStats.res < criteria.minRes) {
    warnings.push(`Resistance is ${bestStats.res}, below target of ${criteria.minRes}`);
  }

  const meetsHardGates = warnings.length === 0;
  const effectiveHp = calculateEffectiveHp(bestStats.hp, bestStats.def);

  return {
    champion: champ,
    assignedGear: bestLoadout,
    stats: bestStats,
    effectiveHp,
    setCounts: bestSets,
    manifest,
    meetsHardGates,
    warnings,
    score: bestScore,
  };
}

/** Execute the regear by updating artifact owner IDs in the roster state */
export function applyRegear(roster: RosterData, targetChampionId: string, newGear: Artifact[]): RosterData {
  const newGearIds = new Set(newGear.map((g) => g.id));
  const newGearSlots = new Set(newGear.map((g) => g.slot));

  const updatedArtifacts = roster.artifacts.map((art) => {
    // If this item is part of the new loadout, assign it to target
    if (newGearIds.has(art.id)) {
      return { ...art, ownerId: targetChampionId };
    }
    // If target champion had another item in one of these slots, unequip it to the vault
    if (art.ownerId === targetChampionId && newGearSlots.has(art.slot)) {
      return { ...art, ownerId: undefined };
    }
    return art;
  });

  return {
    ...roster,
    artifacts: updatedArtifacts,
  };
}
