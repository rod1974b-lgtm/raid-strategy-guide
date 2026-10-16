import { useState, useMemo } from "react";
import {
  type RosterData,
  type Champion,
} from "@/lib/roster/types";
import {
  solveGearForTeam,
  applySwaps,
  ROLE_TITLE,
  type SwapAction,
} from "@/lib/gear/solver";
import type { Encounter } from "@/data/encounters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowRight,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Lock,
  Layers,
  Zap,
} from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  encounter: Encounter;
  roster: RosterData;
  onUpdateRoster: (updated: RosterData) => void;
};

export function GearSwapModal({
  open,
  onOpenChange,
  encounter,
  roster,
  onUpdateRoster,
}: Props) {
  // Select up to 5 champions from imported roster
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return roster.champions.slice(0, 5).map((c) => c.id);
  });
  const [fgrMode, setFgrMode] = useState(false);
  const [applied, setApplied] = useState(false);

  const solverResult = useMemo(() => {
    if (!selectedIds.length) return null;
    return solveGearForTeam(roster, selectedIds, encounter);
  }, [roster, selectedIds, encounter]);

  const toggleChampion = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
    setApplied(false);
  };

  const handleApplySwaps = () => {
    if (!solverResult || !solverResult.swaps.length) return;
    const updated = applySwaps(roster, solverResult.swaps);
    onUpdateRoster(updated);
    setApplied(true);
  };

  const totalCost = fgrMode ? 0 : solverResult?.totalSilverCost || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
            <Sparkles className="h-5 w-5 text-accent" />
            Gear Harvesting Optimizer · {encounter.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Role-sequenced optimization targeting stage requirements (Speed:{" "}
            {encounter.stats.speed || "N/A"}, ACC: {encounter.stats.acc || "N/A"}
            ). Only pulls gear from unequipped inventory and Safe Donors. Core /
            Locked champions are 100% protected.
          </p>
        </DialogHeader>

        {/* 1. Team Selector */}
        <div className="space-y-2 border-b border-border pb-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Select Team ({selectedIds.length}/5)</span>
            <span>Click to toggle roster members</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {roster.champions.map((c) => {
              const active = selectedIds.includes(c.id);
              const isCore = c.tag === "core";
              return (
                <button
                  key={c.id}
                  onClick={() => toggleChampion(c.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary/20 text-primary font-medium"
                      : "border-border bg-secondary/50 text-muted-foreground hover:border-border/80"
                  }`}
                >
                  {isCore && <Lock className="h-3 w-3 text-primary" />}
                  <span>{c.name}</span>
                  <span className="text-[10px] opacity-70">
                    ({c.rank}★ {c.role})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {solverResult && (
          <div className="space-y-6 pt-2">
            {/* 2. Build Order & Priority Sequence */}
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <Layers className="h-4 w-4" /> 1. Build Sequence & Stat Gaps
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {solverResult.buildOrder.map((item) => (
                  <div
                    key={item.champion.id}
                    className="rounded-md border border-border bg-background p-3 text-xs"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-foreground">
                        #{item.priority} {item.champion.name}
                      </span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-accent">
                        {ROLE_TITLE[item.role]}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Speed:</span>
                        <span
                          className={
                            item.speedDeficit > 0
                              ? "text-destructive font-medium"
                              : "text-primary"
                          }
                        >
                          {item.currentSpeed}{" "}
                          {item.speedDeficit > 0 && `(-${item.speedDeficit})`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Accuracy:</span>
                        <span
                          className={
                            item.accDeficit > 0
                              ? "text-destructive font-medium"
                              : "text-primary"
                          }
                        >
                          {item.currentAcc}{" "}
                          {item.accDeficit > 0 && `(-${item.accDeficit})`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Glyph Gap-Closing Recommendations */}
            {solverResult.glyphOpportunities.length > 0 && (
              <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-xs text-foreground">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-accent">
                  <Zap className="h-4 w-4" /> Glyph-First Gap Closing Opportunities
                </div>
                <ul className="space-y-1 list-disc pl-4 text-muted-foreground">
                  {solverResult.glyphOpportunities.map((g, i) => (
                    <li key={i}>{g.recommendation}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4. Actionable Step-by-Step Swap Shopping List */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Coins className="h-4 w-4" /> 2. Step-by-Step Swap Shopping List
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={fgrMode}
                      onChange={(e) => setFgrMode(e.target.checked)}
                      className="rounded border-border"
                    />
                    <Calendar className="h-3.5 w-3.5 text-accent" />
                    <span>Free Gear Removal (FGR) Event Mode</span>
                  </label>
                </div>
              </div>

              {solverResult.swaps.length === 0 ? (
                <div className="rounded-md border border-border bg-background p-4 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-primary" />
                  Your team already satisfies or is close to stage stat thresholds! No artifact swaps required.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="divide-y divide-border rounded-md border border-border bg-background">
                    {solverResult.swaps.map((swap) => (
                      <div
                        key={swap.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-accent">
                            {swap.slot}
                          </span>
                          <span className="text-muted-foreground">
                            ({swap.rank}★ {swap.setName})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {swap.sourceType === "donor"
                              ? `Strip from ${swap.donorChampionName} (Safe Donor)`
                              : "Pull from Unequipped Inventory"}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium text-foreground">
                            Equip on {swap.targetChampionName}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-primary">
                            {swap.statImpact}
                          </span>
                          <span className="text-muted-foreground">
                            {fgrMode
                              ? "0 Silver (FGR)"
                              : `${(swap.silverCost / 1000).toLocaleString()}k Silver`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {solverResult.donorWarnings.length > 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                      <div>
                        <span className="font-semibold">Donor Impact Notice: </span>
                        {solverResult.donorWarnings.join(" ")}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Summary & Execution */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <div className="text-xs text-muted-foreground">
                  Total Unequip Silver:
                </div>
                <div className="text-base font-bold text-primary">
                  {fgrMode ? "0 Silver (Free Event)" : `${totalCost.toLocaleString()} Silver`}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {solverResult.swaps.length > 0 && (
                  <Button
                    size="sm"
                    disabled={applied}
                    onClick={handleApplySwaps}
                    className="gap-1.5"
                  >
                    {applied ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-400" /> Swaps Applied!
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Apply Swaps to Inventory
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
