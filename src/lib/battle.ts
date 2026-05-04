import type { BattleLevel, ConstituencyResult } from "../types/election";

const BATTLE_RANK: Record<BattleLevel, number> = {
  critical: 0,
  close: 1,
  watch: 2,
  normal: 3
};

export function classifyBattle(
  current: Pick<
    ConstituencyResult,
    "margin" | "roundProgressPct" | "roundTotal" | "status" | "leadChangedSinceLastPoll"
  >,
  previous?: ConstituencyResult
): BattleLevel {
  const margin = current.margin;
  if (current.leadChangedSinceLastPoll) return "critical";
  if (margin === undefined) return "normal";

  const isInProgress = current.status !== "Won";
  if (isInProgress && margin <= 500) return "critical";

  if (isInProgress && margin <= 1000) return "close";

  const narrowedBy =
    previous?.margin !== undefined && previous.margin > margin
      ? previous.margin - margin
      : 0;
  if (margin <= 5000 || current.roundTotal === undefined || narrowedBy >= 1000) {
    return "watch";
  }

  return "normal";
}

export function compareBattleResults(a: ConstituencyResult, b: ConstituencyResult) {
  const battleDiff = BATTLE_RANK[a.battleLevel] - BATTLE_RANK[b.battleLevel];
  if (battleDiff !== 0) return battleDiff;

  const marginA = a.margin ?? Number.POSITIVE_INFINITY;
  const marginB = b.margin ?? Number.POSITIVE_INFINITY;
  if (marginA !== marginB) return marginA - marginB;

  return (a.acName ?? "").localeCompare(b.acName ?? "");
}

export function getBattleLabel(level: BattleLevel) {
  switch (level) {
    case "critical":
      return "Critical";
    case "close":
      return "Close";
    case "watch":
      return "Watch";
    default:
      return "Normal";
  }
}
