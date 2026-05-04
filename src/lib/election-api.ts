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

async function fetchSource(source: ElectionSource): Promise<ElectionState[]> {
  const fetchedAt = new Date().toISOString();
  const payload = await fetchJson(source.summaryJsonUrl);
  const summaryStates = parseSummaryJson(payload, source.summaryJsonUrl, fetchedAt);
  const enrichedStates = await Promise.all(
    summaryStates.map(async (state) => {
      const detailUrl = source.statewiseHtmlUrl ?? deriveStatewiseUrl(source.summaryJsonUrl, state.stateCode);
      try {
        const firstHtml = await fetchText(detailUrl);
        const pageUrls = extractStatewisePageUrls(firstHtml, detailUrl, state.stateCode);
        const htmlPages = await Promise.all(
          pageUrls.map(async (pageUrl) => (pageUrl === detailUrl ? firstHtml : fetchText(pageUrl)))
        );
        const htmlResult = combineHtmlResults(
          htmlPages.map((html) => parseStatewiseHtml(html, state.stateCode))
        );
        return mergeHtmlIntoState(state, htmlResult);
      } catch {
        return state;
      }
    })
  );
  return enrichedStates;
}

export async function fetchElectionSnapshot(sources: ElectionSource[]): Promise<ElectionSnapshot> {
  const settled = await Promise.allSettled(sources.map(fetchSource));
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
