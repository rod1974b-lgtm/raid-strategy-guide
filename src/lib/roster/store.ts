import { useCallback, useEffect, useState } from "react";
import { STAT_KEYS, emptyStats, type Artifact, type Champion, type RosterData, type Stats } from "./types";

export const ROSTER_STORAGE_KEY = "rsl-roster-v1";

export function loadRoster(): RosterData {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RosterData;
  } catch {
    /* ignore */
  }
  return { champions: [], artifacts: [] };
}

export function useRoster() {
  const [data, setData] = useState<RosterData>({ champions: [], artifacts: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadRoster());
    setReady(true);
  }, []);

  const update = useCallback((fn: (d: RosterData) => RosterData) => {
    setData((prev) => {
      const next = fn(prev);
      localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { data, ready, update };
}

/** Merge imported data: replaces by id, keeps existing tags for known champions. */
export function mergeRoster(prev: RosterData, incoming: RosterData, replace: boolean): RosterData {
  if (replace) {
    const tags = new Map(prev.champions.map((c) => [c.id, c.tag]));
    return { ...incoming, champions: incoming.champions.map((c) => ({ ...c, tag: tags.get(c.id) ?? c.tag })) };
  }
  const champs = new Map(prev.champions.map((c) => [c.id, c]));
  incoming.champions.forEach((c) => champs.set(c.id, { ...c, tag: champs.get(c.id)?.tag ?? c.tag }));
  const arts = new Map(prev.artifacts.map((a) => [a.id, a]));
  incoming.artifacts.forEach((a) => arts.set(a.id, a));
  return { ...incoming, champions: [...champs.values()], artifacts: [...arts.values()] };
}

export function gearOf(champ: Champion, artifacts: Artifact[]) {
  return artifacts.filter((a) => a.ownerId === champ.id);
}

export function totalStats(champ: Champion, gear: Artifact[]): Stats {
  const t: Stats = { ...emptyStats(), ...champ.base };
  for (const a of gear) {
    for (const b of [a.primary, ...a.subs]) {
      if (["hp", "atk", "def"].includes(b.stat) && !b.flat) t[b.stat] += (champ.base[b.stat] * b.value) / 100;
      else t[b.stat] += b.value;
    }
  }
  STAT_KEYS.forEach((k) => (t[k] = Math.round(t[k])));
  return t;
}

export function setCounts(gear: Artifact[]) {
  const counts: Record<string, number> = {};
  gear.filter((a) => a.set && a.set !== "None").forEach((a) => (counts[a.set] = (counts[a.set] ?? 0) + 1));
  return counts;
}

/** Compact text for the AI coach so it knows protection tags and gear. */
export function rosterBriefForCoach(d: RosterData): string {
  if (!d.champions.length) return "";
  const line = (c: Champion) => {
    const g = gearOf(c, d.artifacts);
    const t = totalStats(c, g);
    const sets = Object.entries(setCounts(g)).map(([s, n]) => `${s}x${n}`).join(" ");
    return `- ${c.name} (${c.rank}★ L${c.level} ${c.affinity} ${c.role}) SPD ${t.spd} ACC ${t.acc} RES ${t.res} HP ${t.hp}${sets ? ` sets: ${sets}` : ""}`;
  };
  const group = (tag: Champion["tag"]) => d.champions.filter((c) => c.tag === tag).slice(0, 40).map(line).join("\n");
  const unequipped = d.artifacts.filter((a) => !a.ownerId).length;
  return [
    `Imported roster (${d.champions.length} champions, ${d.artifacts.length} gear pieces, ${unequipped} unequipped).`,
    `CORE / LOCKED — never strip:\n${group("core") || "(none)"}`,
    `ACTIVE:\n${group("active") || "(none)"}`,
    `SAFE DONORS — gear can be stripped freely:\n${group("donor") || "(none)"}`,
  ].join("\n");
}
