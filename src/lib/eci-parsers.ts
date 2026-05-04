import type {
  ConstituencyResult,
  ElectionState,
  PartyTally,
  ResultStatus
} from "../types/election";
import { STATE_NAMES } from "../data/sources";

type SummaryRow = [string, string, number, string, string];
type SummaryPayload = Record<
  string,
  {
    chartData?: unknown[];
    tableData?: unknown[];
  }
>;

type HtmlResult = {
  stateCode: string;
  statusKnown?: number;
  totalConstituencies?: number;
  constituencies: ConstituencyResult[];
};

const PARTY_CODE_BY_NAME: Record<string, string> = {
  "Bharatiya Janata Party": "BJP",
  "Indian National Congress": "INC",
  "All India Trinamool Congress": "AITC",
  "Communist Party of India (Marxist)": "CPI(M)",
  "Communist Party of India": "CPI",
  "All India N.R. Congress": "AINRC",
  "Dravida Munnetra Kazhagam": "DMK",
  "All India Anna Dravida Munnetra Kazhagam": "ADMK"
};

const DEFAULT_PARTY_COLOR = "#667085";

function isSummaryRow(row: unknown): row is SummaryRow {
  return (
    Array.isArray(row) &&
    typeof row[0] === "string" &&
    typeof row[1] === "string" &&
    typeof row[2] === "number" &&
    typeof row[3] === "string" &&
    typeof row[4] === "string"
  );
}

function emptyResult(stateCode: string, acNo: number): ConstituencyResult {
  return {
    stateCode,
    acNo,
    status: "Unknown",
    battleLevel: "normal",
    leadChangedSinceLastPoll: false
  };
}

function tallyParties(rows: SummaryRow[]): PartyTally[] {
  const tally = new Map<string, PartyTally>();
  rows.forEach(([partyCode, , , , color]) => {
    const existing = tally.get(partyCode);
    if (existing) {
      existing.leading += 1;
      return;
    }
    tally.set(partyCode, {
      code: partyCode,
      color: color || DEFAULT_PARTY_COLOR,
      leading: 1,
      won: 0
    });
  });
  return Array.from(tally.values()).sort((a, b) => b.leading + b.won - (a.leading + a.won));
}

function calculateRoundProgress(constituencies: ConstituencyResult[]) {
  return constituencies.reduce(
    (acc, result) => {
      if (
        result.roundCurrent === undefined ||
        result.roundTotal === undefined ||
        result.roundTotal <= 0
      ) {
        return acc;
      }

      return {
        countedRounds: acc.countedRounds + result.roundCurrent,
        totalRounds: acc.totalRounds + result.roundTotal,
        roundReportingConstituencies: acc.roundReportingConstituencies + 1
      };
    },
    {
      countedRounds: 0,
      totalRounds: 0,
      roundReportingConstituencies: 0
    }
  );
}

export function parseSummaryJson(
  payload: SummaryPayload,
  sourceUrl: string,
  updatedAt = new Date().toISOString()
): ElectionState[] {
  return Object.entries(payload).flatMap(([stateCode, statePayload]) => {
    const rows = (statePayload.chartData ?? []).filter(isSummaryRow);
    if (rows.length === 0) return [];

    const constituencies = rows.map(([partyCode, rowStateCode, acNo, candidateName, color]) => {
      const status: ResultStatus = partyCode === "NA" ? "Unknown" : "Result in Progress";
      return {
        ...emptyResult(rowStateCode || stateCode, acNo),
        leadingCandidate: candidateName === "NA" ? undefined : candidateName,
        leadingPartyCode: partyCode === "NA" ? undefined : partyCode,
        color,
        status
      };
    });

    const statusKnown = constituencies.filter((result) => result.leadingPartyCode).length;
    const roundProgress = calculateRoundProgress(constituencies);
    return [
      {
        stateCode,
        stateName: STATE_NAMES[stateCode],
        totalConstituencies: rows.length,
        statusKnown,
        ...roundProgress,
        countingProgressPct: roundProgress.totalRounds
          ? Math.round((roundProgress.countedRounds / roundProgress.totalRounds) * 100)
          : 0,
        parties: tallyParties(rows),
        constituencies,
        updatedAt,
        sourceUrl
      }
    ];
  });
}

function directText(element: Element | undefined) {
  if (!element) return "";
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function nestedPartyText(element: Element | undefined) {
  if (!element) return "";
  const nested = element.querySelector("table tbody tr td[align='left']");
  return (nested?.textContent ?? directText(element)).replace(/\s+/g, " ").trim();
}

function parseNumber(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRound(value: string) {
  const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return {};
  const roundCurrent = Number.parseInt(match[1], 10);
  const roundTotal = Number.parseInt(match[2], 10);
  return {
    roundCurrent,
    roundTotal,
    roundProgressPct: roundTotal ? Math.round((roundCurrent / roundTotal) * 100) : undefined
  };
}

function normalizeStatus(value: string): ResultStatus {
  const text = value.trim();
  if (/won/i.test(text)) return "Won";
  if (/progress/i.test(text)) return "Result in Progress";
  return "Unknown";
}

function partyCodeFromName(name: string) {
  return PARTY_CODE_BY_NAME[name] ?? undefined;
}

export function parseStatewiseHtml(html: string, stateCode: string): HtmlResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const statusMatch = doc.body.textContent?.match(
    /Status Known For\s+(\d+)\s+out of\s+(\d+)\s+Constituencies/i
  );
  const statusKnown = statusMatch ? Number.parseInt(statusMatch[1], 10) : undefined;
  const totalConstituencies = statusMatch ? Number.parseInt(statusMatch[2], 10) : undefined;
  const rows = Array.from(doc.querySelectorAll("table.table tbody > tr"));

  const constituencies = rows.flatMap((row) => {
    const cells = Array.from(row.children).filter((cell) => cell.tagName === "TD");
    if (cells.length < 9) return [];

    const acName = directText(cells[0]);
    const acNo = parseNumber(directText(cells[1]));
    if (!acName || acNo === undefined) return [];

    const leadingPartyName = nestedPartyText(cells[3]);
    const trailingPartyName = nestedPartyText(cells[5]);
    const round = parseRound(directText(cells[7]));

    return [
      {
        ...emptyResult(stateCode, acNo),
        acName,
        leadingCandidate: directText(cells[2]) || undefined,
        leadingPartyName: leadingPartyName || undefined,
        leadingPartyCode: partyCodeFromName(leadingPartyName),
        trailingCandidate: directText(cells[4]) || undefined,
        trailingPartyName: trailingPartyName || undefined,
        trailingPartyCode: partyCodeFromName(trailingPartyName),
        margin: parseNumber(directText(cells[6])),
        ...round,
        status: normalizeStatus(directText(cells[8]))
      }
    ];
  });

  return {
    stateCode,
    statusKnown,
    totalConstituencies,
    constituencies
  };
}

function constituencyKey(result: Pick<ConstituencyResult, "stateCode" | "acNo">) {
  return `${result.stateCode}:${result.acNo}`;
}

function rebuildPartyTallies(constituencies: ConstituencyResult[], fallback: PartyTally[]) {
  const byCode = new Map(fallback.map((party) => [party.code, { ...party, leading: 0, won: 0 }]));
  constituencies.forEach((result) => {
    const code = result.leadingPartyCode ?? result.leadingPartyName;
    if (!code) return;
    const existing = byCode.get(code);
    if (existing) {
      existing.leading += result.status === "Won" ? 0 : 1;
      existing.won += result.status === "Won" ? 1 : 0;
      return;
    }
    byCode.set(code, {
      code,
      name: result.leadingPartyName,
      color: result.color ?? DEFAULT_PARTY_COLOR,
      leading: result.status === "Won" ? 0 : 1,
      won: result.status === "Won" ? 1 : 0
    });
  });
  return Array.from(byCode.values())
    .filter((party) => party.leading + party.won > 0)
    .sort((a, b) => b.leading + b.won - (a.leading + a.won));
}

export function mergeHtmlIntoState(state: ElectionState, htmlResult?: HtmlResult): ElectionState {
  if (!htmlResult) return state;

  const jsonByKey = new Map(
    state.constituencies.map((result) => [constituencyKey(result), result])
  );
  const mergedHtmlResults = htmlResult.constituencies.map((htmlConstituency) => {
    const jsonConstituency = jsonByKey.get(constituencyKey(htmlConstituency));
    return {
      ...jsonConstituency,
      ...htmlConstituency,
      leadingPartyCode: htmlConstituency.leadingPartyCode ?? jsonConstituency?.leadingPartyCode,
      trailingPartyCode: htmlConstituency.trailingPartyCode ?? jsonConstituency?.trailingPartyCode,
      color: jsonConstituency?.color ?? htmlConstituency.color
    };
  });

  const htmlKeys = new Set(mergedHtmlResults.map(constituencyKey));
  const leftovers = state.constituencies.filter((result) => !htmlKeys.has(constituencyKey(result)));
  const constituencies = [...mergedHtmlResults, ...leftovers].sort((a, b) => a.acNo - b.acNo);
  const totalConstituencies = htmlResult.totalConstituencies ?? state.totalConstituencies;
  const statusKnown =
    htmlResult.statusKnown ??
    constituencies.filter((result) => result.status !== "Unknown").length;
  const roundProgress = calculateRoundProgress(constituencies);

  return {
    ...state,
    totalConstituencies,
    statusKnown,
    ...roundProgress,
    countingProgressPct: roundProgress.totalRounds
      ? Math.round((roundProgress.countedRounds / roundProgress.totalRounds) * 100)
      : 0,
    parties: rebuildPartyTallies(constituencies, state.parties),
    constituencies
  };
}
