import { classifyBattle } from "./battle";
import type { ConstituencyResult, ElectionState, ElectionSnapshot } from "../types/election";

export const SNAPSHOT_STORAGE_KEY = "election-results.previous-snapshot";

function constituencyKey(result: Pick<ConstituencyResult, "stateCode" | "acNo">) {
  return `${result.stateCode}:${result.acNo}`;
}

export function applySnapshotDiff(
  states: ElectionState[],
  previous?: ElectionSnapshot | null
): ElectionState[] {
  const previousByKey = new Map<string, ConstituencyResult>();
  previous?.states.forEach((state) => {
    state.constituencies.forEach((result) => {
      previousByKey.set(constituencyKey(result), result);
    });
  });

  return states.map((state) => {
    const constituencies = state.constituencies.map((result) => {
      const previousResult = previousByKey.get(constituencyKey(result));
      const previousLeader =
        previousResult?.leadingPartyCode ??
        previousResult?.leadingPartyName ??
        previousResult?.leadingCandidate;
      const currentLeader =
        result.leadingPartyCode ?? result.leadingPartyName ?? result.leadingCandidate;
      const leadChangedSinceLastPoll = Boolean(
        previousLeader && currentLeader && previousLeader !== currentLeader
      );
      const marginDeltaSinceLastPoll =
        previousResult?.margin !== undefined && result.margin !== undefined
          ? result.margin - previousResult.margin
          : undefined;
      const nextResult = {
        ...result,
        leadChangedSinceLastPoll,
        marginDeltaSinceLastPoll
      };
      return {
        ...nextResult,
        battleLevel: classifyBattle(nextResult, previousResult)
      };
    });

    return {
      ...state,
      constituencies
    };
  });
}

export function readPreviousSnapshot(): ElectionSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ElectionSnapshot) : null;
  } catch {
    return null;
  }
}

export function writePreviousSnapshot(snapshot: ElectionSnapshot) {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Best-effort only; the live UI still works without persisted comparison data.
  }
}
