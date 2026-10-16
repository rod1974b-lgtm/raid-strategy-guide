/** Small, realistic sample exports for testing the importer. */

export const SAMPLE_HELLHADES = {
  fileVersion: 1,
  heroes: [
    { id: 101, name: "Maneater", fraction: "OgrynTribes", element: "Void", rarity: "Epic", role: "Support", level: 60, grade: "Stars6", locked: true, health: 1335, attack: 727, defense: 1123, speed: 101, resistance: 30, accuracy: 10, criticalChance: 0.15, criticalDamage: 0.5, artifacts: [1, 2, 3] },
    { id: 102, name: "Pain Keeper", fraction: "OgrynTribes", element: "Void", rarity: "Epic", role: "Support", level: 60, grade: "Stars6", locked: true, health: 1290, attack: 793, defense: 1068, speed: 100, resistance: 40, accuracy: 0, criticalChance: 0.15, criticalDamage: 0.5, artifacts: [4] },
    { id: 103, name: "Kael", fraction: "DarkElves", element: "Magic", rarity: "Rare", role: "Attack", level: 50, grade: "Stars5", health: 1050, attack: 1100, defense: 650, speed: 100, resistance: 30, accuracy: 0, criticalChance: 0.15, criticalDamage: 0.6, inVault: true, artifacts: [5, 6] },
    { id: 104, name: "Elhain", fraction: "HighElves", element: "Magic", rarity: "Rare", role: "Attack", level: 40, grade: "Stars4", health: 990, attack: 1180, defense: 600, speed: 101, resistance: 30, accuracy: 0, criticalChance: 0.15, criticalDamage: 0.57, inVault: true, artifacts: [7] },
    { id: 105, name: "Armanz the Magnificent", fraction: "HighElves", element: "Magic", rarity: "Legendary", role: "Support", level: 60, grade: "Stars6", health: 1500, attack: 720, defense: 1080, speed: 101, resistance: 30, accuracy: 0, criticalChance: 0.15, criticalDamage: 0.5, artifacts: [] },
  ],
  artifacts: [
    { id: 1, kind: "Weapon", setKind: "Speed", rank: "Six", rarity: "Legendary", level: 16, primaryBonus: { kind: "Attack", isAbsolute: true, value: 265 }, secondaryBonuses: [{ kind: "Speed", isAbsolute: true, value: 18, enhancement: 3 }, { kind: "Health", isAbsolute: false, value: 0.06 }] },
    { id: 2, kind: "Boots", setKind: "Speed", rank: "Six", rarity: "Epic", level: 16, primaryBonus: { kind: "Speed", isAbsolute: true, value: 45 }, secondaryBonuses: [{ kind: "Defense", isAbsolute: false, value: 0.11 }, { kind: "Resistance", isAbsolute: true, value: 10 }] },
    { id: 3, kind: "Ring", setKind: "None", rank: "Five", rarity: "Epic", level: 12, primaryBonus: { kind: "Health", isAbsolute: true, value: 2320 }, secondaryBonuses: [{ kind: "Defense", isAbsolute: true, value: 45 }] },
    { id: 4, kind: "Boots", setKind: "Speed", rank: "Six", rarity: "Legendary", level: 16, primaryBonus: { kind: "Speed", isAbsolute: true, value: 45 }, secondaryBonuses: [{ kind: "Speed", isAbsolute: true, value: 11 }] },
    { id: 5, kind: "Gloves", setKind: "Savage", rank: "Six", rarity: "Legendary", level: 16, primaryBonus: { kind: "CriticalDamage", isAbsolute: false, value: 0.8 }, secondaryBonuses: [{ kind: "CriticalChance", isAbsolute: false, value: 0.15 }, { kind: "Speed", isAbsolute: true, value: 12 }] },
    { id: 6, kind: "Chest", setKind: "Savage", rank: "Five", rarity: "Epic", level: 16, primaryBonus: { kind: "Attack", isAbsolute: false, value: 0.5 }, secondaryBonuses: [{ kind: "Speed", isAbsolute: true, value: 9 }] },
    { id: 7, kind: "Helmet", setKind: "Accuracy", rank: "Six", rarity: "Epic", level: 12, primaryBonus: { kind: "Health", isAbsolute: true, value: 3480 }, secondaryBonuses: [{ kind: "Accuracy", isAbsolute: true, value: 40 }, { kind: "Speed", isAbsolute: true, value: 10 }] },
    { id: 8, kind: "Shield", setKind: "Lifesteal", rank: "Six", rarity: "Legendary", level: 16, primaryBonus: { kind: "Defense", isAbsolute: true, value: 265 }, secondaryBonuses: [{ kind: "Speed", isAbsolute: true, value: 16 }, { kind: "CriticalChance", isAbsolute: false, value: 0.12 }] },
  ],
};

export const SAMPLE_RSLHELPER = {
  Account: {
    Champions: [
      { Id: "c-201", Name: "Duchess Lilitu", Faction: "Undead Hordes", Element: "Spirit", Rarity: "Legendary", Role: "Defense", Level: 60, Stars: 6, IsLocked: true, Stats: { HP: 20000, ATK: 900, DEF: 1100, SPD: 99, RES: 50, ACC: 0, CritRate: 15, CritDamage: 50 }, Equipped: ["g-1", "g-2"] },
      { Id: "c-202", Name: "Warmaiden", Faction: "Sacred Order", Element: "Void", Rarity: "Rare", Role: "Attack", Level: 60, Stars: 6, Stats: { HP: 13000, ATK: 1000, DEF: 900, SPD: 100, RES: 30, ACC: 10, CritRate: 15, CritDamage: 57 }, Equipped: ["g-3"] },
      { Id: "c-203", Name: "Apothecary", Faction: "Banner Lords", Element: "Spirit", Rarity: "Rare", Role: "Support", Level: 50, Stars: 5, Stats: { HP: 15000, ATK: 700, DEF: 800, SPD: 106, RES: 30, ACC: 0, CritRate: 15, CritDamage: 50 }, Equipped: [] },
    ],
    Artifacts: [
      { Id: "g-1", Slot: "Chest", Set: "Immortal", Stars: 6, Rarity: "Legendary", Level: 16, MainStat: { Stat: "HP%", Value: 60, Flat: false }, SubStats: [{ Stat: "SPD", Value: 14 }, { Stat: "DEF%", Value: 10, Flat: false }] },
      { Id: "g-2", Slot: "Banner", Set: "None", Stars: 6, Rarity: "Epic", Level: 16, Faction: "Undead Hordes", MainStat: { Stat: "RES", Value: 64 }, SubStats: [{ Stat: "HP%", Value: 8, Flat: false }] },
      { Id: "g-3", Slot: "Gloves", Set: "Cruel", Stars: 6, Rarity: "Legendary", Level: 16, MainStat: { Stat: "C.RATE", Value: 60, Flat: false }, SubStats: [{ Stat: "SPD", Value: 11 }] },
      { Id: "g-4", Slot: "Boots", Set: "Speed", Stars: 5, Rarity: "Epic", Level: 16, MainStat: { Stat: "SPD", Value: 40 }, SubStats: [{ Stat: "ACC", Value: 30 }] },
    ],
  },
};
