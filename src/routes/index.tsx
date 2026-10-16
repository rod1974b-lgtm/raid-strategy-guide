import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { loadRoster, rosterBriefForCoach } from "@/lib/roster/store";
import { useEffect, useMemo, useState } from "react";
import { Search, Skull, Crosshair, Cog, Gauge, ListOrdered, Bot, Users, Coins, Hammer } from "lucide-react";
import { ENCOUNTERS, GROUPS, findEncounter, type Encounter } from "@/data/encounters";
import { CoachPanel } from "@/components/coach/CoachPanel";

type Search = { stage?: string | undefined };

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    stage: typeof s["stage"] === "string" ? s["stage"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Raid Tactical Companion — Stage Coach & Stat Checkpoints" },
      { name: "description", content: "Stage cheat sheets, stat checkpoints, turn order, Auto AI presets and a live AI coach for every Raid: Shadow Legends mode." },
      { property: "og:title", content: "Raid Tactical Companion" },
      { property: "og:description", content: "Stage-aware AI coach and threshold database for Raid: Shadow Legends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ROSTER_KEY = "rsl-roster-notes";

function Index() {
  const { stage } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const enc = findEncounter(stage ?? "") ?? ENCOUNTERS[0]!;
  const [q, setQ] = useState("");
  const [roster, setRoster] = useState("");

  const [brief, setBrief] = useState("");
  useEffect(() => {
    setRoster(localStorage.getItem(ROSTER_KEY) ?? "");
    setBrief(rosterBriefForCoach(loadRoster()));
  }, []);
  const coachRoster = [roster, brief].filter(Boolean).join("\n\n");

  const filtered = useMemo(
    () => ENCOUNTERS.filter((e) => `${e.name} ${e.mode}`.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Crosshair className="h-6 w-6 text-primary" />
        <h1 className="font-display text-lg tracking-wider text-primary">Raid Tactical Companion</h1>
        <span className="ml-2 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">Stage Engine & Coach</span>
        <Link to="/roster" className="ml-auto rounded-md border border-primary px-3 py-1 text-sm text-primary hover:bg-primary hover:text-primary-foreground">
          Roster Hub
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr_420px]">
        <aside className="flex min-h-0 flex-col border-r border-border bg-sidebar">
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-md border border-input px-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a stage or boss"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 pb-3">
            {GROUPS.map((g) => {
              const items = filtered.filter((e) => e.group === g.id);
              if (!items.length) return null;
              return (
                <div key={g.id} className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{g.label}</div>
                  {items.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => navigate({ search: { stage: e.id } })}
                      className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                        e.id === enc.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                      }`}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="border-t border-border p-3">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">My roster & gear notes</label>
            <textarea
              value={roster}
              onChange={(e) => {
                setRoster(e.target.value);
                localStorage.setItem(ROSTER_KEY, e.target.value);
              }}
              rows={4}
              placeholder="Core: Maneater 6★ 60 booked… Vault: Kael, Elhain… Key gear: 2 speed boots 4x…"
              className="mt-1 w-full resize-none rounded-md border border-input bg-transparent p-2 text-xs outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground">The coach uses this for substitutes and gear pulls.</p>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto p-5">
          <StageSheet e={enc} />
        </main>

        <section className="min-h-[500px] border-l border-border bg-card lg:min-h-0">
          <CoachPanel encounter={enc} roster={roster} />
        </section>
      </div>
    </div>
  );
}

function StageSheet({ e }: { e: Encounter }) {
  const stats = [
    ["True Speed", e.stats.speed],
    ["Accuracy", e.stats.acc],
    ["Resistance", e.stats.res],
    ["EHP", e.stats.ehp],
    ["Notes", e.stats.other],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="text-xs uppercase tracking-widest text-accent">
          {e.mode}
          {e.affinity ? ` · ${e.affinity}` : ""}
        </div>
        <h2 className="font-display text-2xl text-foreground">{e.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{e.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.slice(0, 4).map(([k, v]) => (
          <div key={k} className="rounded-md border border-border bg-card p-3">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{k}</div>
            <div className="mt-1 text-sm font-semibold text-primary">{v}</div>
          </div>
        ))}
      </div>
      {e.stats.other && <p className="text-xs text-muted-foreground">Note: {e.stats.other}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Block icon={<Skull className="h-4 w-4" />} title="What wipes teams here" items={e.wipes} tone="danger" />
        <Block icon={<Crosshair className="h-4 w-4" />} title="Kill priority" items={e.killOrder} />
        <Block icon={<Cog className="h-4 w-4" />} title="Mandatory mechanics" items={e.mechanics} />
        <Block icon={<ListOrdered className="h-4 w-4" />} title="Turn-order sequence" items={e.turnOrder} ordered />
        <Block icon={<Hammer className="h-4 w-4" />} title="Gear these first" items={e.gearFirst} ordered />
        <Block icon={<Users className="h-4 w-4" />} title="Template team" items={e.team} />
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
          <Bot className="h-4 w-4" /> Auto AI skill presets
        </h3>
        <div className="divide-y divide-border">
          {e.aiPresets.map((p) => (
            <div key={p.role} className="flex justify-between gap-4 py-2 text-sm">
              <span className="font-medium">{p.role}</span>
              <span className="text-right text-muted-foreground">{p.preset}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
          <Coins className="h-4 w-4" /> Budget / community route
        </h3>
        <p className="text-sm text-muted-foreground">{e.budget}</p>
      </div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Gauge className="h-3 w-3" /> Checkpoints are community benchmarks for reliable auto clears; ask the coach to tailor them to your team.
      </p>
    </div>
  );
}

function Block({ icon, title, items, ordered, tone }: { icon: React.ReactNode; title: string; items: string[]; ordered?: boolean; tone?: "danger" }) {
  const L = ordered ? "ol" : "ul";
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h3 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${tone === "danger" ? "text-destructive" : "text-primary"}`}>
        {icon} {title}
      </h3>
      <L className={`space-y-1 pl-4 text-sm ${ordered ? "list-decimal" : "list-disc"}`}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </L>
    </div>
  );
}
