import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Upload, FileJson, Plus, Search, Shield, Lock, Recycle, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseImport } from "@/lib/roster/parse";
import { SAMPLE_HELLHADES, SAMPLE_RSLHELPER } from "@/lib/roster/samples";
import { gearOf, mergeRoster, setCounts, totalStats, useRoster } from "@/lib/roster/store";
import {
  SLOTS,
  STAT_KEYS,
  STAT_LABEL,
  TAG_LABEL,
  emptyStats,
  type Artifact,
  type Champion,
  type ChampionTag,
  type RosterData,
  type Slot,
  type StatKey,
} from "@/lib/roster/types";

export const Route = createFileRoute("/roster")({
  head: () => ({
    meta: [
      { title: "Roster Hub — Raid Tactical Companion" },
      { name: "description", content: "Import your Raid: Shadow Legends account from RSL Helper or HellHades, tag Core, Active and Safe Donor champions, and browse gear." },
      { property: "og:title", content: "Roster Hub — Raid Tactical Companion" },
      { property: "og:description", content: "Import champions and gear, protect your core teams, and mark safe gear donors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RosterHub,
});

const TAG_ICON: Record<ChampionTag, React.ReactNode> = {
  core: <Lock className="h-3 w-3" />,
  active: <Shield className="h-3 w-3" />,
  donor: <Recycle className="h-3 w-3" />,
};
const TAG_STYLE: Record<ChampionTag, string> = {
  core: "border-primary text-primary",
  active: "border-border text-foreground",
  donor: "border-accent text-accent",
};

function RosterHub() {
  const { data, ready, update } = useRoster();
  const [editing, setEditing] = useState<Champion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Link to="/" className="text-muted-foreground hover:text-primary" aria-label="Back to stages">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-lg tracking-wider text-primary">Roster Hub</h1>
        <span className="ml-2 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">Phase 2 · Import & Protection</span>
        <div className="ml-auto text-xs text-muted-foreground">
          {data.champions.length} champions · {data.artifacts.length} gear
          {data.source ? ` · from ${data.source}` : ""}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 p-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <Importer onImport={(d, replace) => update((p) => mergeRoster(p, d, replace))} />
          <TagSummary data={data} />
          <div className="rounded-md border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-primary">Manual entry</h3>
            <p className="mb-3 text-xs text-muted-foreground">Add a champion the export missed, or fix one on the fly.</p>
            <Button size="sm" onClick={() => setEditing(blankChampion())}>
              <Plus className="h-4 w-4" /> Add champion
            </Button>
            {data.champions.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-2 text-destructive"
                onClick={() => {
                  if (confirm("Delete your whole saved roster and gear?")) update(() => ({ champions: [], artifacts: [] }));
                }}
              >
                <Trash2 className="h-4 w-4" /> Clear all
              </Button>
            )}
          </div>
        </div>

        {ready && (
          <Catalog
            data={data}
            selected={selected}
            onSelect={setSelected}
            onTag={(id, tag) => update((d) => ({ ...d, champions: d.champions.map((c) => (c.id === id ? { ...c, tag } : c)) }))}
            onEdit={setEditing}
            onUpdate={update}
          />
        )}
      </div>

      {editing && (
        <ChampionEditor
          champ={editing}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            update((d) => ({
              ...d,
              champions: d.champions.some((x) => x.id === c.id) ? d.champions.map((x) => (x.id === c.id ? c : x)) : [...d.champions, c],
            }));
            setEditing(null);
          }}
          onDelete={(id) => {
            update((d) => ({
              champions: d.champions.filter((c) => c.id !== id),
              artifacts: d.artifacts.map((a) => (a.ownerId === id ? { ...a, ownerId: undefined } : a)),
            }));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function blankChampion(): Champion {
  return { id: crypto.randomUUID(), name: "", level: 60, rank: 6, rarity: "Epic", affinity: "Magic", faction: "", role: "Attack", tag: "active", base: emptyStats() };
}

/* ---------------- Importer ---------------- */

function Importer({ onImport }: { onImport: (d: RosterData, replace: boolean) => void }) {
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [replace, setReplace] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const ingest = (text: string, label?: string) => {
    try {
      const r = parseImport(text);
      onImport({ champions: r.champions, artifacts: r.artifacts, source: label ?? r.format, importedAt: new Date().toISOString() }, replace);
      setMsg({ ok: true, text: `Detected ${r.format}: ${r.champions.length} champions, ${r.artifacts.length} gear pieces.${r.warnings.length ? " " + r.warnings.join(" ") : ""}` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Import failed." });
    }
  };
  const readFile = async (f: File | undefined) => {
    if (f) ingest(await f.text());
  };

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
        <FileJson className="h-4 w-4" /> Import account JSON
      </h3>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void readFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-md border-2 border-dashed p-6 text-center text-sm transition-colors ${drag ? "border-primary bg-primary/10" : "border-border hover:border-primary"}`}
      >
        <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        Drop an RSL Helper or HellHades export here, or click to choose a file
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void readFile(e.target.files?.[0])} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        Replace current roster (your Core/Donor tags are kept)
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => ingest(JSON.stringify(SAMPLE_HELLHADES), "Sample · HellHades")}>
          Load HellHades sample
        </Button>
        <Button size="sm" variant="secondary" onClick={() => ingest(JSON.stringify(SAMPLE_RSLHELPER), "Sample · RSL Helper")}>
          Load RSL Helper sample
        </Button>
      </div>
      {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
    </div>
  );
}

function TagSummary({ data }: { data: RosterData }) {
  const count = (t: ChampionTag) => data.champions.filter((c) => c.tag === t).length;
  const donorGear = data.artifacts.filter((a) => data.champions.find((c) => c.id === a.ownerId)?.tag === "donor").length;
  const loose = data.artifacts.filter((a) => !a.ownerId).length;
  return (
    <div className="rounded-md border border-border bg-card p-4 text-sm">
      <h3 className="mb-2 font-semibold text-primary">Protection overview</h3>
      {(["core", "active", "donor"] as ChampionTag[]).map((t) => (
        <div key={t} className="flex justify-between py-0.5">
          <span className="flex items-center gap-1.5">{TAG_ICON[t]} {TAG_LABEL[t]}</span>
          <span className="text-muted-foreground">{count(t)}</span>
        </div>
      ))}
      <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
        Free to pull: {donorGear} pieces on donors + {loose} unequipped in the vault. Core champions are never stripped.
      </div>
    </div>
  );
}

/* ---------------- Catalog ---------------- */

function Catalog({
  data,
  selected,
  onSelect,
  onTag,
  onEdit,
  onUpdate,
}: {
  data: RosterData;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onTag: (id: string, t: ChampionTag) => void;
  onEdit: (c: Champion) => void;
  onUpdate: (fn: (d: RosterData) => RosterData) => void;
}) {
  const [q, setQ] = useState("");
  const [f, setF] = useState({ role: "", affinity: "", faction: "", rarity: "", tag: "" });
  const opts = (k: "role" | "affinity" | "faction" | "rarity") => [...new Set(data.champions.map((c) => c[k]).filter(Boolean))].sort();

  const list = useMemo(
    () =>
      data.champions
        .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
        .filter((c) => (!f.role || c.role === f.role) && (!f.affinity || c.affinity === f.affinity) && (!f.faction || c.faction === f.faction) && (!f.rarity || c.rarity === f.rarity) && (!f.tag || c.tag === f.tag))
        .sort((a, b) => ["core", "active", "donor"].indexOf(a.tag) - ["core", "active", "donor"].indexOf(b.tag) || b.level - a.level || a.name.localeCompare(b.name)),
    [data.champions, q, f],
  );

  if (!data.champions.length)
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No roster yet. Import a JSON export or load a sample on the left.
      </div>
    );

  const sel = (key: keyof typeof f, label: string, values: string[]) => (
    <select value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className="rounded-md border border-input bg-card px-2 py-1.5 text-xs">
      <option value="">{label}: all</option>
      {values.map((v) => (
        <option key={v} value={v}>
          {key === "tag" ? TAG_LABEL[v as ChampionTag] : v}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-input px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search champions" className="w-full bg-transparent py-1.5 text-sm outline-none" />
        </div>
        {sel("tag", "Tag", ["core", "active", "donor"])}
        {sel("role", "Role", opts("role"))}
        {sel("affinity", "Affinity", opts("affinity"))}
        {sel("faction", "Faction", opts("faction"))}
        {sel("rarity", "Rarity", opts("rarity"))}
      </div>
      <p className="text-xs text-muted-foreground">{list.length} shown</p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const gear = gearOf(c, data.artifacts);
          const t = totalStats(c, gear);
          const sets = setCounts(gear);
          return (
            <div key={c.id} className={`rounded-md border bg-card p-3 ${selected === c.id ? "border-primary" : "border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => onSelect(selected === c.id ? null : c.id)} className="min-w-0 text-left">
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {"★".repeat(c.rank)} L{c.level} · {c.rarity} · {c.affinity}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.role} · {c.faction}
                    {c.inVault ? " · Vault" : ""}
                  </div>
                </button>
                <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => onEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-2 flex gap-1">
                {(["core", "active", "donor"] as ChampionTag[]).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onTag(c.id, tag)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded border px-1 py-1 text-[11px] ${c.tag === tag ? TAG_STYLE[tag] + " bg-secondary" : "border-border text-muted-foreground opacity-60 hover:opacity-100"}`}
                  >
                    {TAG_ICON[tag]} {tag === "core" ? "Core" : tag === "active" ? "Active" : "Donor"}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {Object.keys(sets).length ? (
                  Object.entries(sets).map(([s, n]) => (
                    <span key={s} className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">
                      {s} ×{n}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-muted-foreground">{gear.length ? "No set bonuses" : "No gear equipped"}</span>
                )}
              </div>

              <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                {STAT_KEYS.map((k) => (
                  <div key={k} className="rounded bg-secondary/50 py-1">
                    <div className="text-[10px] text-muted-foreground">{STAT_LABEL[k]}</div>
                    <div className="text-xs font-semibold text-primary">{t[k]}{k === "cr" || k === "cd" ? "%" : ""}</div>
                    {t[k] !== Math.round(c.base[k]) && <div className="text-[10px] text-muted-foreground">base {Math.round(c.base[k])}</div>}
                  </div>
                ))}
              </div>

              {selected === c.id && <GearList champ={c} data={data} onUpdate={onUpdate} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtBonus(b: { stat: StatKey; value: number; flat: boolean }) {
  return `${STAT_LABEL[b.stat]} ${b.flat ? "+" : ""}${b.value}${b.flat ? "" : "%"}`;
}

function GearList({ champ, data, onUpdate }: { champ: Champion; data: RosterData; onUpdate: (fn: (d: RosterData) => RosterData) => void }) {
  const gear = gearOf(champ, data.artifacts);
  const [adding, setAdding] = useState(false);
  return (
    <div className="mt-3 border-t border-border pt-2">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Equipped gear</div>
      {SLOTS.map((slot) => {
        const a = gear.find((g) => g.slot === slot);
        return (
          <div key={slot} className="flex items-start justify-between gap-2 py-0.5 text-xs">
            <span className="w-14 shrink-0 text-muted-foreground">{slot}</span>
            {a ? (
              <span className="flex-1">
                <span className="text-foreground">{a.set} {a.rank}★ +{a.level}</span> · {fmtBonus(a.primary)}
                {a.subs.length > 0 && <span className="text-muted-foreground"> · {a.subs.map(fmtBonus).join(", ")}</span>}
              </span>
            ) : (
              <span className="flex-1 text-muted-foreground">—</span>
            )}
            {a && (
              <button
                aria-label={`Unequip ${slot}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onUpdate((d) => ({ ...d, artifacts: d.artifacts.map((x) => (x.id === a.id ? { ...x, ownerId: undefined } : x)) }))}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
      {adding ? (
        <GearEditor
          onCancel={() => setAdding(false)}
          onSave={(a) => {
            onUpdate((d) => ({
              ...d,
              artifacts: [...d.artifacts.map((x) => (x.ownerId === champ.id && x.slot === a.slot ? { ...x, ownerId: undefined } : x)), { ...a, ownerId: champ.id }],
            }));
            setAdding(false);
          }}
        />
      ) : (
        <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3" /> Add gear piece
        </Button>
      )}
    </div>
  );
}

/* ---------------- Manual editors ---------------- */

const inputCls = "w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:border-primary";

function GearEditor({ onSave, onCancel }: { onSave: (a: Artifact) => void; onCancel: () => void }) {
  const [a, setA] = useState<Artifact>({ id: crypto.randomUUID(), slot: "Weapon", set: "Speed", rank: 6, rarity: "Epic", level: 16, primary: { stat: "atk", value: 265, flat: true }, subs: [] });
  const [subs, setSubs] = useState("");
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-2">
      <div className="grid grid-cols-3 gap-2">
        <select className={inputCls} value={a.slot} onChange={(e) => setA({ ...a, slot: e.target.value as Slot })}>
          {SLOTS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input className={inputCls} value={a.set} onChange={(e) => setA({ ...a, set: e.target.value })} placeholder="Set" />
        <input className={inputCls} type="number" value={a.level} onChange={(e) => setA({ ...a, level: +e.target.value })} placeholder="Level" />
        <select className={inputCls} value={a.primary.stat} onChange={(e) => setA({ ...a, primary: { ...a.primary, stat: e.target.value as StatKey } })}>
          {STAT_KEYS.map((k) => <option key={k} value={k}>{STAT_LABEL[k]}</option>)}
        </select>
        <input className={inputCls} type="number" value={a.primary.value} onChange={(e) => setA({ ...a, primary: { ...a.primary, value: +e.target.value } })} />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={a.primary.flat} onChange={(e) => setA({ ...a, primary: { ...a.primary, flat: e.target.checked } })} /> Flat
        </label>
      </div>
      <input className={inputCls} value={subs} onChange={(e) => setSubs(e.target.value)} placeholder="Substats, e.g. SPD 18, ACC 30, HP% 6" />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() =>
            onSave({
              ...a,
              subs: subs
                .split(",")
                .map((s) => s.trim().match(/^([A-Za-z.]+)(%?)\s*\+?(\d+(?:\.\d+)?)/))
                .filter((m): m is RegExpMatchArray => !!m)
                .map((m) => {
                  const map: Record<string, StatKey> = { hp: "hp", atk: "atk", def: "def", spd: "spd", res: "res", acc: "acc", "c.rate": "cr", cr: "cr", "c.dmg": "cd", cd: "cd" };
                  const stat = map[m[1]!.toLowerCase()] ?? "hp";
                  return { stat, value: +m[3]!, flat: m[2] !== "%" && !["cr", "cd"].includes(stat) };
                }),
            })
          }
        >
          Equip
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function ChampionEditor({ champ, onSave, onClose, onDelete }: { champ: Champion; onSave: (c: Champion) => void; onClose: () => void; onDelete: (id: string) => void }) {
  const [c, setC] = useState<Champion>(champ);
  const field = (k: "name" | "rarity" | "affinity" | "faction" | "role", label: string) => (
    <label className="text-xs text-muted-foreground">
      {label}
      <input className={inputCls + " mt-0.5 text-foreground"} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <div className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-primary">{champ.name ? `Edit ${champ.name}` : "Add champion"}</h3>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {field("name", "Name")}
          {field("faction", "Faction")}
          {field("affinity", "Affinity")}
          {field("rarity", "Rarity")}
          {field("role", "Role")}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Level<input type="number" className={inputCls + " mt-0.5 text-foreground"} value={c.level} onChange={(e) => setC({ ...c, level: +e.target.value })} /></label>
            <label className="text-xs text-muted-foreground">Rank<input type="number" min={1} max={6} className={inputCls + " mt-0.5 text-foreground"} value={c.rank} onChange={(e) => setC({ ...c, rank: +e.target.value })} /></label>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Base stats (no gear)</div>
          <div className="grid grid-cols-4 gap-2">
            {STAT_KEYS.map((k) => (
              <label key={k} className="text-[11px] text-muted-foreground">
                {STAT_LABEL[k]}
                <input type="number" className={inputCls + " mt-0.5 text-foreground"} value={c.base[k]} onChange={(e) => setC({ ...c, base: { ...c.base, [k]: +e.target.value } })} />
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-1">
          {(["core", "active", "donor"] as ChampionTag[]).map((t) => (
            <button key={t} onClick={() => setC({ ...c, tag: t })} className={`flex-1 rounded border px-2 py-1 text-xs ${c.tag === t ? TAG_STYLE[t] + " bg-secondary" : "border-border text-muted-foreground"}`}>
              {TAG_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="flex justify-between">
          {champ.name ? (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(c.id)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : <span />}
          <Button size="sm" disabled={!c.name.trim()} onClick={() => onSave(c)}>Save</Button>
        </div>
      </div>
    </div>
  );
}
