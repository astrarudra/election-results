import { describe, expect, it } from "vitest";
import { classifyBattle } from "../lib/battle";
import { applySnapshotDiff } from "../lib/snapshot";
import type { ElectionState } from "../types/election";

describe("adaptive battle classification", () => {
  it("marks very small in-progress margins as critical", () => {
    expect(
      classifyBattle({
        margin: 500,
        roundProgressPct: 80,
        roundTotal: 20,
        status: "Result in Progress",
        leadChangedSinceLastPoll: false
      })
    ).toBe("critical");
  });

  it("marks unfinished margins up to 1000 as close", () => {
    expect(
      classifyBattle({
        margin: 1000,
        roundProgressPct: 20,
        roundTotal: 20,
        status: "Result in Progress",
        leadChangedSinceLastPoll: false
      })
    ).toBe("close");
  });

  it("marks unfinished margins over 1000 as watch", () => {
    expect(
      classifyBattle({
        margin: 1001,
        roundProgressPct: 80,
        roundTotal: 20,
        status: "Result in Progress",
        leadChangedSinceLastPoll: false
      })
    ).toBe("watch");
  });

  it("marks lead changes as critical", () => {
    expect(
      classifyBattle({
        margin: 9000,
        roundProgressPct: 80,
        roundTotal: 20,
        status: "Result in Progress",
        leadChangedSinceLastPoll: true
      })
    ).toBe("critical");
  });

  it("applies snapshot lead-change and margin deltas", () => {
    const current: ElectionState[] = [
      {
        stateCode: "S25",
        totalConstituencies: 1,
        statusKnown: 1,
        countedRounds: 0,
        totalRounds: 0,
        roundReportingConstituencies: 0,
        countingProgressPct: 100,
        parties: [],
        updatedAt: "now",
        constituencies: [
          {
            stateCode: "S25",
            acNo: 12,
            leadingPartyCode: "BJP",
            margin: 100,
            status: "Result in Progress",
            battleLevel: "normal",
            leadChangedSinceLastPoll: false
          }
        ]
      }
    ];

    const [state] = applySnapshotDiff(current, {
      updatedAt: "previous",
      states: [
        {
          ...current[0],
          constituencies: [
            {
              ...current[0].constituencies[0],
              leadingPartyCode: "AITC",
              margin: 800
            }
          ]
        }
      ]
    });

    expect(state.constituencies[0]).toMatchObject({
      leadChangedSinceLastPoll: true,
      marginDeltaSinceLastPoll: -700,
      battleLevel: "critical"
    });
  });
});
