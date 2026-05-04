import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DEFAULT_REFRESH_MS } from "../data/sources";
import { fetchElectionSnapshot, fetchElectionStateDetails } from "../lib/election-api";
import type { ElectionSource, ElectionState } from "../types/election";

export function useElectionData(sources: ElectionSource[]) {
  return useQuery({
    queryKey: ["election-results", sources.map((source) => source.summaryJsonUrl)],
    queryFn: () => fetchElectionSnapshot(sources),
    refetchInterval: DEFAULT_REFRESH_MS,
    retry: 2,
    staleTime: DEFAULT_REFRESH_MS - 5_000,
    gcTime: 30 * 60_000
  });
}

export function useElectionStateDetails(state?: ElectionState) {
  return useQuery({
    queryKey: ["election-state-details", state?.stateCode, state?.sourceUrl],
    queryFn: () => {
      if (!state) throw new Error("No state selected.");
      return fetchElectionStateDetails(state);
    },
    enabled: Boolean(state),
    placeholderData: keepPreviousData,
    refetchInterval: DEFAULT_REFRESH_MS,
    retry: 1,
    staleTime: DEFAULT_REFRESH_MS,
    gcTime: 30 * 60_000
  });
}
