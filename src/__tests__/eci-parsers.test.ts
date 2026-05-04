import { describe, expect, it } from "vitest";
import {
  combineHtmlResults,
  extractStatewisePageUrls,
  mergeHtmlIntoState,
  parseStatewiseHtml,
  parseSummaryJson
} from "../lib/eci-parsers";

const summaryPayload = {
  S25: {
    chartData: [
      ["BJP", "S25", 12, "PARITOSH DAS", "#ff944d"],
      ["AITC", "S25", 102, "MOHAMMAD KASEM SIDDIQUE", "#05a"],
      ["NA", "S25", 3, "NA", "#ddd"]
    ],
    tableData: []
  }
};

const htmlSnippet = `
  <table class="table table-striped table-bordered">
    <thead>
      <tr><th colspan="9">Status Known For 2 out of 3 Constituencies</th></tr>
    </thead>
    <tbody>
      <tr>
        <td align="left">ALIPURDUARS</td>
        <td align="right">12</td>
        <td align="left">PARITOSH DAS</td>
        <td align="left">
          <table><tbody><tr><td align="left">Bharatiya Janata Party</td><td>
            <div class="tooltip"><table class="table table-striped"><tbody><tr><td>Leading In</td><td>:</td><td>187</td></tr></tbody></table></div>
          </td></tr></tbody></table>
        </td>
        <td align="left">SUMAN KANJILAL</td>
        <td><table><tbody><tr><td align="left">All India Trinamool Congress</td></tr></tbody></table></td>
        <td align="right">584</td>
        <td align="right">2/22</td>
        <td align="left">Result in Progress</td>
      </tr>
      <tr>
        <td align="left">AMDANGA</td>
        <td align="right">102</td>
        <td align="left">MOHAMMAD KASEM SIDDIQUE</td>
        <td><table><tbody><tr><td align="left">All India Trinamool Congress</td></tr></tbody></table></td>
        <td align="left">ARINDAM DEY</td>
        <td><table><tbody><tr><td align="left">Bharatiya Janata Party</td></tr></tbody></table></td>
        <td align="right">2,500</td>
        <td align="right">12/22</td>
        <td align="left">Result in Progress</td>
      </tr>
    </tbody>
  </table>`;

describe("ECI parsers", () => {
  it("normalizes compact JSON chart rows", () => {
    const [state] = parseSummaryJson(summaryPayload, "https://example.test/live.json");

    expect(state.stateCode).toBe("S25");
    expect(state.totalConstituencies).toBe(3);
    expect(state.statusKnown).toBe(2);
    expect(state.countedRounds).toBe(0);
    expect(state.totalRounds).toBe(0);
    expect(state.countingProgressPct).toBe(0);
    expect(state.constituencies[0]).toMatchObject({
      acNo: 12,
      leadingCandidate: "PARITOSH DAS",
      leadingPartyCode: "BJP",
      color: "#ff944d",
      partyIconUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Logo_of_the_Bharatiya_Janata_Party.svg"
    });
    expect(state.parties.find((party) => party.code === "AITC")?.iconUrl).toContain(
      "All_India_Trinamool_Congress_logo.svg"
    );
  });

  it("extracts direct result cells without tooltip table pollution", () => {
    const parsed = parseStatewiseHtml(htmlSnippet, "S25");

    expect(parsed.statusKnown).toBe(2);
    expect(parsed.totalConstituencies).toBe(3);
    expect(parsed.constituencies).toHaveLength(2);
    expect(parsed.constituencies[0]).toMatchObject({
      acName: "ALIPURDUARS",
      acNo: 12,
      leadingPartyName: "Bharatiya Janata Party",
      leadingPartyCode: "BJP",
      margin: 584,
      roundCurrent: 2,
      roundTotal: 22,
      status: "Result in Progress"
    });
  });

  it("treats ECI result declared rows as won seats", () => {
    const parsed = parseStatewiseHtml(
      htmlSnippet
        .replace("Result in Progress", "Result Declared")
        .replace("2/22", "22/22"),
      "S25"
    );

    expect(parsed.constituencies[0]).toMatchObject({
      roundCurrent: 22,
      roundTotal: 22,
      status: "Won"
    });
  });

  it("treats fully counted rounds as won even when ECI status still says progress", () => {
    const parsed = parseStatewiseHtml(
      htmlSnippet.replace("2/22", "18/18"),
      "S25"
    );

    expect(parsed.constituencies[0]).toMatchObject({
      roundCurrent: 18,
      roundTotal: 18,
      status: "Won"
    });
  });

  it("merges HTML detail into JSON rows and keeps party colors", () => {
    const [summaryState] = parseSummaryJson(summaryPayload, "https://example.test/live.json");
    const merged = mergeHtmlIntoState(summaryState, parseStatewiseHtml(htmlSnippet, "S25"));

    expect(merged.statusKnown).toBe(2);
    expect(merged.totalConstituencies).toBe(3);
    expect(merged.countedRounds).toBe(14);
    expect(merged.totalRounds).toBe(44);
    expect(merged.countingProgressPct).toBe(32);
    expect(merged.constituencies.find((result) => result.acNo === 12)).toMatchObject({
      acName: "ALIPURDUARS",
      leadingPartyCode: "BJP",
      color: "#ff944d"
    });
  });

  it("recomputes icons from HTML leaders when summary party data is stale", () => {
    const [summaryState] = parseSummaryJson(
      {
        S25: {
          chartData: [["AITC", "S25", 12, "STALE LEADER", "#05a"]],
          tableData: []
        }
      },
      "https://example.test/live.json"
    );
    const merged = mergeHtmlIntoState(summaryState, parseStatewiseHtml(htmlSnippet, "S25"));
    const result = merged.constituencies.find((constituency) => constituency.acNo === 12);

    expect(result).toMatchObject({
      leadingPartyCode: "BJP",
      partyIconUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Logo_of_the_Bharatiya_Janata_Party.svg"
    });
    expect(result?.partyIconUrl).not.toContain("Trinamool");
  });

  it("discovers and combines paginated statewise detail pages", () => {
    const pageUrls = extractStatewisePageUrls(
      `<a class="page-link" href="statewiseS251.htm">1</a><a class="page-link" href="statewiseS252.htm">2</a>`,
      "https://results.eci.gov.in/ResultAcGenMay2026/statewiseS251.htm",
      "S25"
    );

    expect(pageUrls).toEqual([
      "https://results.eci.gov.in/ResultAcGenMay2026/statewiseS251.htm",
      "https://results.eci.gov.in/ResultAcGenMay2026/statewiseS252.htm"
    ]);

    const combined = combineHtmlResults([
      parseStatewiseHtml(htmlSnippet, "S25"),
      parseStatewiseHtml(
        htmlSnippet.replace(/ALIPURDUARS/g, "MEKLIGANJ").replace(/>12</g, ">1<"),
        "S25"
      )
    ]);

    expect(combined?.constituencies.some((result) => result.acName === "MEKLIGANJ")).toBe(true);
  });
});
