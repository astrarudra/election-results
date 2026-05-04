import { useQuery } from "@tanstack/react-query";
import { DEFAULT_REFRESH_MS } from "../data/sources";
import { fetchElectionSnapshot } from "../lib/election-api";
import type { ElectionSource } from "../types/election";

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
