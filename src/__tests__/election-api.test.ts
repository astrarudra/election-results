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
        const isSecondPage = url.includes("statewiseS032");
        return {
          ok: true,
          text: async () =>
            isSecondPage
              ? `<table class="table"><thead><tr><th>Status Known For 2 out of 2 Constituencies</th></tr></thead><tbody><tr><td>SECOND SEAT</td><td>2</td><td>NEWER TWO</td><td><table><tbody><tr><td align="left">Indian National Congress</td></tr></tbody></table></td><td>TRAILER</td><td><table><tbody><tr><td align="left">Bharatiya Janata Party</td></tr></tbody></table></td><td>10</td><td>1/10</td><td>Result in Progress</td></tr></tbody></table>`
              : `<table><thead><tr><th>Status Known For 2 out of 2 Constituencies</th></tr></thead><tbody></tbody></table><a class="page-link" href="statewiseS032.htm">2</a>`
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
              ],
              [
                "INC",
                "S03",
                2,
                "NEWER TWO",
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
    expect(snapshot.states[0].constituencies.find((result) => result.acNo === 2)).toMatchObject({
      acName: "SECOND SEAT",
      margin: 10
    });
  });
});
