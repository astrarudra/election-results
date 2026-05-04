import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchElectionSnapshot } from "../lib/election-api";
import type { ElectionSource } from "../types/election";

const sourceA: ElectionSource = {
  id: "a",
  label: "A",
  summaryJsonUrl: "https://results.eci.gov.in/ResultAcGenMay2026/election-json-S03-live.json"
};

const sourceB: ElectionSource = {
  id: "b",
  label: "B",
  summaryJsonUrl: "https://results.eci.gov.in/ResultAcGenMay2026/election-json-S25-live.json"
};

describe("election API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("deduplicates states with later sources winning", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("statewise")) {
        return {
          ok: true,
          text: async () =>
            `<table><thead><tr><th>Status Known For 1 out of 1 Constituencies</th></tr></thead><tbody></tbody></table>`
        };
      }

      return {
        ok: true,
        json: async () => ({
          S03: {
            chartData: [
              [
                url.includes("S25") ? "INC" : "BJP",
                "S03",
                1,
                url.includes("S25") ? "NEWER" : "OLDER",
                "#19AAED"
              ]
            ],
            tableData: []
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await fetchElectionSnapshot([sourceA, sourceB]);

    expect(snapshot.states).toHaveLength(1);
    expect(snapshot.states[0].constituencies[0]).toMatchObject({
      leadingCandidate: "NEWER",
      leadingPartyCode: "INC"
    });
  });
});
