import {
  type Artifact,
  type Champion,
  type RosterData,
  type Slot,
  type StatKey,
  emptyStats,
} from "@/lib/roster/types";
import { gearOf, totalStats } from "@/lib/roster/store";
import type { Encounter } from "@/data/encounters";

export type ChampionRole = "speed_booster" | "debuffer" | "sustain" | "nuker";

export const ROLE_PRIORITY: Record<ChampionRole, number> = {
  speed_booster: 1,
  debuffer: 2,
  sustain: 3,
  nuker: 4,
};

export const ROLE_TITLE: Record<ChampionRole, string> = {
  speed_booster: "Speed Booster / Turn Meter",
  debuffer: "Debuffer / Crowd Control",
  sustain: "Sustain / Reviver / Tank",
  nuker: "Damage Dealer / Nuker",
};

export type TargetThresholds = {
  speed: number;
  acc: number;
  res: number;
  ehp: number;
};

export type SwapAction = {
  id: string;
  artifactId: string;
  slot: Slot;
  setName: string;
  rank: number;
  rarity: string;
  sourceType: "unequipped" | "donor";
  donorChampionName?: string;
  targetChampionId: string;
  targetChampionName: string;
  statImpact: string;
  silverCost: number;
};

export type GlyphOpportunity = {
  championId: string;
  championName: string;
  slot: Slot;
  stat: StatKey;
  gap: number;
  recommendation: string;
};

export type SolverResult = {
  buildOrder: {
    champion: Champion;
    role: ChampionRole;
    priority: number;
    currentSpeed: number;
    currentAcc: number;
    currentRes: number;
    speedDeficit: number;
    accDeficit: number;
  }[];
  swaps: SwapAction[];
  glyphOpportunities: GlyphOpportunity[];
  donorWarnings: string[];
  totalSilverCost: number;
};

/** Parse numeric thresholds from encounter string descriptions */
export function parseStageThresholds(e: Encounter): TargetThresholds {
  const parseNum = (str?: string): number => {
    if (!str) return 0;
    const match = str.match(/(\d{2,3})/);
    return match ? parseInt(match[1], 10) : 0;
  };

  return {
    speed: parseNum(e.stats.speed) || 200,
    acc: parseNum(e.stats.acc) || 220,
    res: parseNum(e.stats.res) || 0,
    ehp: parseNum(e.stats.ehp) || 45000,
  };
}

/** Silver cost to unequip an artifact by rank */
export function calculateUnequipCost(rank: number): number {
  switch (rank) {
    case 6:
      return 100000;
    case 5:
      return 50000;
    case 4:
      return 25000;
    default:
      return 10000;
  }
}

/** Assign tactical role based on champion properties */
export function inferChampionRole(c: Champion): ChampionRole {
  const roleLower = (c.role || "").toLowerCase();
  const nameLower = c.name.toLowerCase();

  if (
    roleLower.includes("speed") ||
    nameLower.includes("kymar") ||
    nameLower.includes("arbiter") ||
    nameLower.includes("siphi") ||
    nameLower.includes("apothecary") ||
    nameLower.includes("deacon")
  ) {
    return "speed_booster";
  }

  if (
    roleLower.includes("debuff") ||
    roleLower.includes("control") ||
    nameLower.includes("stag") ||
    nameLower.includes("madame") ||
    nameLower.includes("geomancer") ||
    nameLower.includes("armiger")
  ) {
    return "debuffer";
  }

  if (
    roleLower.includes("support") ||
    roleLower.includes("defense") ||
    roleLower.includes("hp") ||
    nameLower.includes("duchess") ||
    nameLower.includes("scyl") ||
    nameLower.includes("demytha") ||
    nameLower.includes("wythir")
  ) {
    return "sustain";
  }

  return "nuker";
}

/**
 * Main gear harvesting solver:
 * 1. Checks current stats against stage thresholds
 * 2. Checks if glyphs on existing equipment can close the gap
 * 3. Harvests gear only from unequipped items and "donor" champions (NEVER "core")
 * 4. Optimizes in strict build order (Speed Booster -> Debuffer -> Sustain -> Nuker)
 */
export function solveGearForTeam(
  roster: RosterData,
  teamChampionIds: string[],
  encounter: Encounter
): SolverResult {
  const targets = parseStageThresholds(encounter);
  const champions = teamChampionIds
    .map((id) => roster.champions.find((c) => c.id === id))
    .filter((c): c is Champion => Boolean(c));

  // Determine build order
  const buildOrder = champions
    .map((c) => {
      const role = inferChampionRole(c);
      const gear = gearOf(c, roster.artifacts);
      const stats = totalStats(c, gear);
      return {
        champion: c,
        role,
        priority: ROLE_PRIORITY[role],
        currentSpeed: stats.spd,
        currentAcc: stats.acc,
        currentRes: stats.res,
        speedDeficit: Math.max(0, targets.speed - stats.spd),
        accDeficit: Math.max(0, targets.acc - stats.acc),
      };
    })
    .sort((a, b) => a.priority - b.priority);

  const swaps: SwapAction[] = [];
  const glyphOpportunities: GlyphOpportunity[] = [];
  const donorWarnings: string[] = [];

  // Donor pool: Unequipped artifacts + Artifacts on "donor" tagged champions
  // Strictly EXCLUDE artifacts on "core" champions and active team members
  const teamIdSet = new Set(teamChampionIds);
  const donorChampionsMap = new Map(
    roster.champions.filter((c) => c.tag === "donor").map((c) => [c.id, c])
  );

  const availableArtifacts: Artifact[] = roster.artifacts.filter((a) => {
    if (!a.ownerId) return true; // Unequipped
    if (teamIdSet.has(a.ownerId)) return false; // Already on team
    return donorChampionsMap.has(a.ownerId); // Only from donors
  });

  const claimedArtifactIds = new Set<string>();

  for (const item of buildOrder) {
    const c = item.champion;
    const currentGear = gearOf(c, roster.artifacts);
    const stats = totalStats(c, currentGear);

    // 1. Check glyph opportunities first
    if (item.speedDeficit > 0 && item.speedDeficit <= 6) {
      const speedGear = currentGear.find((g) =>
        g.subs.some((s) => s.stat === "spd")
      );
      if (speedGear) {
        glyphOpportunities.push({
          championId: c.id,
          championName: c.name,
          slot: speedGear.slot,
          stat: "spd",
          gap: item.speedDeficit,
          recommendation: `Apply a +${item.speedDeficit} Speed glyph to ${speedGear.slot} (${speedGear.set || "Piece"}) instead of swapping gear.`,
        });
      }
    }

    if (item.accDeficit > 0 && item.accDeficit <= 12) {
      const accGear = currentGear.find((g) =>
        g.subs.some((s) => s.stat === "acc")
      );
      if (accGear) {
        glyphOpportunities.push({
          championId: c.id,
          championName: c.name,
          slot: accGear.slot,
          stat: "acc",
          gap: item.accDeficit,
          recommendation: `Apply a +${item.accDeficit} ACC glyph to ${accGear.slot} to reach the ${targets.acc} accuracy threshold.`,
        });
      }
    }

    // 2. If Speed or ACC has a significant deficit, find the best donor piece
    if (item.speedDeficit > 4) {
      // Find Boots or high speed sub-stat piece
      const candidates = availableArtifacts
        .filter((a) => !claimedArtifactIds.has(a.id))
        .filter((a) => {
          if (a.slot === "Boots" && a.primary.stat === "spd") return true;
          return a.subs.some((s) => s.stat === "spd" && s.value >= 12);
        })
        .sort((a, b) => {
          const spdA =
            a.primary.stat === "spd"
              ? a.primary.value
              : a.subs.find((s) => s.stat === "spd")?.value || 0;
          const spdB =
            b.primary.stat === "spd"
              ? b.primary.value
              : b.subs.find((s) => s.stat === "spd")?.value || 0;
          return spdB - spdA;
        });

      if (candidates.length > 0) {
        const best = candidates[0];
        claimedArtifactIds.add(best.id);

        const donor = best.ownerId ? donorChampionsMap.get(best.ownerId) : undefined;
        if (donor) {
          donorWarnings.push(
            `Stripping ${best.slot} from ${donor.name} (Safe Donor).`
          );
        }

        const spdGain =
          best.primary.stat === "spd"
            ? best.primary.value
            : best.subs.find((s) => s.stat === "spd")?.value || 0;

        swaps.push({
          id: `swap-${best.id}-${c.id}`,
          artifactId: best.id,
          slot: best.slot,
          setName: best.set || "Artifact",
          rank: best.rank,
          rarity: best.rarity,
          sourceType: best.ownerId ? "donor" : "unequipped",
          donorChampionName: donor?.name,
          targetChampionId: c.id,
          targetChampionName: c.name,
          statImpact: `+${spdGain} SPD`,
          silverCost: calculateUnequipCost(best.rank),
        });
      }
    }

    // Check ACC deficit for debuffers
    if (item.role === "debuffer" && item.accDeficit > 10) {
      const bannerCandidates = availableArtifacts
        .filter((a) => !claimedArtifactIds.has(a.id))
        .filter((a) => a.slot === "Banner" && a.primary.stat === "acc")
        .sort((a, b) => b.primary.value - a.primary.value);

      if (bannerCandidates.length > 0) {
        const bestBanner = bannerCandidates[0];
        claimedArtifactIds.add(bestBanner.id);
        const donor = bestBanner.ownerId
          ? donorChampionsMap.get(bestBanner.ownerId)
          : undefined;

        swaps.push({
          id: `swap-${bestBanner.id}-${c.id}`,
          artifactId: bestBanner.id,
          slot: bestBanner.slot,
          setName: bestBanner.set || "Banner",
          rank: bestBanner.rank,
          rarity: bestBanner.rarity,
          sourceType: bestBanner.ownerId ? "donor" : "unequipped",
          donorChampionName: donor?.name,
          targetChampionId: c.id,
          targetChampionName: c.name,
          statImpact: `+${bestBanner.primary.value} ACC`,
          silverCost: calculateUnequipCost(bestBanner.rank),
        });
      }
    }
  }

  const totalSilverCost = swaps.reduce((sum, s) => sum + s.silverCost, 0);

  return {
    buildOrder,
    swaps,
    glyphOpportunities,
    donorWarnings,
    totalSilverCost,
  };
}

/** Apply approved swaps directly to the roster data */
export function applySwaps(roster: RosterData, swaps: SwapAction[]): RosterData {
  const swapMap = new Map(swaps.map((s) => [s.artifactId, s.targetChampionId]));

  const updatedArtifacts = roster.artifacts.map((a) => {
    if (swapMap.has(a.id)) {
      return {
        ...a,
        ownerId: swapMap.get(a.id),
      };
    }
    return a;
  });

  return {
    ...roster,
    artifacts: updatedArtifacts,
  };
}
