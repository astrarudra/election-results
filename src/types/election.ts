export type BattleLevel = "critical" | "close" | "watch" | "normal";

export type ResultStatus = "Result in Progress" | "Won" | "Unknown";

export type PartyTally = {
  code: string;
  name?: string;
  color: string;
  leading: number;
  won: number;
  trailing?: number;
};

export type ConstituencyResult = {
  stateCode: string;
  acNo: number;
  acName?: string;
  leadingCandidate?: string;
  leadingPartyCode?: string;
  leadingPartyName?: string;
  trailingCandidate?: string;
  trailingPartyCode?: string;
  trailingPartyName?: string;
  margin?: number;
  roundCurrent?: number;
  roundTotal?: number;
  roundProgressPct?: number;
  status?: ResultStatus;
  color?: string;
  battleLevel: BattleLevel;
  leadChangedSinceLastPoll: boolean;
  marginDeltaSinceLastPoll?: number;
};

export type ElectionState = {
  stateCode: string;
  stateName?: string;
  totalConstituencies: number;
  statusKnown: number;
  countedRounds: number;
  totalRounds: number;
  roundReportingConstituencies: number;
  countingProgressPct: number;
  parties: PartyTally[];
  constituencies: ConstituencyResult[];
  updatedAt: string;
  sourceUrl?: string;
};

export type ElectionSource = {
  id: string;
  label: string;
  summaryJsonUrl: string;
  statewiseHtmlUrl?: string;
  mapJsUrl?: string;
};

export type ElectionSnapshot = {
  updatedAt: string;
  states: ElectionState[];
};
