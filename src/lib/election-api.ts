import {
  combineHtmlResults,
  extractStatewisePageUrls,
  mergeHtmlIntoState,
  parseStatewiseHtml,
  parseSummaryJson
} from "./eci-parsers";
import { deriveStatewiseUrl } from "./source-registry";
import { applySnapshotDiff, readPreviousSnapshot, writePreviousSnapshot } from "./snapshot";
import type { ElectionSnapshot, ElectionSource, ElectionState } from "../types/election";

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`ECI JSON fetch failed (${response.status}) for ${url}`);
  }
  return response.json();
}

async function fetchText(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`ECI detail fetch failed (${response.status}) for ${url}`);
  }
  return response.text();
}

async function fetchSummarySource(source: ElectionSource): Promise<ElectionState[]> {
  const fetchedAt = new Date().toISOString();
  const payload = await fetchJson(source.summaryJsonUrl);
  return parseSummaryJson(payload, source.summaryJsonUrl, fetchedAt);
}

export async function fetchElectionSnapshot(sources: ElectionSource[]): Promise<ElectionSnapshot> {
  const settled = await Promise.allSettled(sources.map(fetchSummarySource));
  const deduped = new Map<string, ElectionState>();

  settled.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.forEach((state) => {
      deduped.set(state.stateCode, state);
    });
  });

  if (deduped.size === 0) {
    const firstError = settled.find((result) => result.status === "rejected");
    throw firstError && firstError.status === "rejected"
      ? firstError.reason
      : new Error("No election data sources returned usable results.");
  }

  const previous = readPreviousSnapshot();
  const states = applySnapshotDiff(
    Array.from(deduped.values()).sort((a, b) =>
      (a.stateName ?? a.stateCode).localeCompare(b.stateName ?? b.stateCode)
    ),
    previous
  );
  const snapshot = {
    updatedAt: new Date().toISOString(),
    states
  };
  writePreviousSnapshot(snapshot);
  return snapshot;
}

export async function fetchElectionStateDetails(state: ElectionState): Promise<ElectionState> {
  if (!state.sourceUrl) {
    return state;
  }

  const detailUrl = deriveStatewiseUrl(state.sourceUrl, state.stateCode);
  const firstHtml = await fetchText(detailUrl);
  const pageUrls = extractStatewisePageUrls(firstHtml, detailUrl, state.stateCode);
  const htmlPages = await Promise.all(
    pageUrls.map(async (pageUrl) => (pageUrl === detailUrl ? firstHtml : fetchText(pageUrl)))
  );
  const htmlResult = combineHtmlResults(
    htmlPages.map((html) => parseStatewiseHtml(html, state.stateCode))
  );
  const enrichedState = mergeHtmlIntoState(state, htmlResult);
  const previous = readPreviousSnapshot();
  const [stateWithDiff] = applySnapshotDiff([enrichedState], previous);

  if (previous) {
    const otherStates = previous.states.filter((item) => item.stateCode !== state.stateCode);
    writePreviousSnapshot({
      updatedAt: new Date().toISOString(),
      states: [...otherStates, stateWithDiff]
    });
  }

  return stateWithDiff;
}
