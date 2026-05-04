import type { ElectionSource } from "../types/election";

export const DEFAULT_REFRESH_MS = 180_000;

export const DEFAULT_SOURCES: ElectionSource[] = [
  {
    id: "eci-s03",
    label: "ECI Assembly Results S03",
    summaryJsonUrl:
      "https://results.eci.gov.in/ResultAcGenMay2026/election-json-S03-live.json"
  },
  {
    id: "eci-s25",
    label: "ECI Assembly Results S25 bundle",
    summaryJsonUrl:
      "https://results.eci.gov.in/ResultAcGenMay2026/election-json-S25-live.json"
  }
];

export const STATE_NAMES: Record<string, string> = {
  S03: "Assam",
  S11: "Kerala",
  S22: "Tamil Nadu",
  S25: "West Bengal",
  U07: "Puducherry"
};

export const CUSTOM_SOURCES_KEY = "election-results.custom-sources";
