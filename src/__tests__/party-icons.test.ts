import { describe, expect, it } from "vitest";
import { getPartyCodeFromName, getPartyIconUrl } from "../data/party-icons";

describe("party icon registry", () => {
  it("resolves icon URLs from party codes", () => {
    expect(getPartyIconUrl("BJP")).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Logo_of_the_Bharatiya_Janata_Party.svg"
    );
    expect(getPartyIconUrl("CPI(M)")).toContain("Cpm_election_symbol.svg");
  });

  it("resolves icon URLs and codes from party names", () => {
    expect(getPartyCodeFromName("All India Trinamool Congress")).toBe("AITC");
    expect(getPartyIconUrl(undefined, "All India Trinamool Congress")).toContain(
      "All_India_Trinamool_Congress_symbol_2021.svg"
    );
  });
});
