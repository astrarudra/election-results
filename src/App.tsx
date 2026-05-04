import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  Settings2,
  X
} from "lucide-react";
import { DEFAULT_REFRESH_MS, CUSTOM_SOURCES_KEY } from "./data/sources";
import { getPartyIconUrl } from "./data/party-icons";
import { useCountdown } from "./hooks/use-countdown";
import { useElectionData, useElectionStateDetails } from "./hooks/use-election-data";
import { compareBattleResults, getBattleLabel } from "./lib/battle";
import {
  getRegisteredSources,
  readCustomSourceText,
  writeCustomSourceText
} from "./lib/source-registry";
import type { BattleLevel, ConstituencyResult, ElectionState } from "./types/election";

type FilterMode = "all" | "close" | "lead-change" | "in-progress" | "won" | "unknown";

const DEFAULT_STATE_CODE = "S25";

const filters: Array<{ id: FilterMode; label: string }> = [
  { id: "all", label: "All" },
  { id: "close", label: "Close" },
  { id: "lead-change", label: "Lead changed" },
  { id: "in-progress", label: "In progress" },
  { id: "won", label: "Won" },
  { id: "unknown", label: "Unknown" }
];

function formatNumber(value?: number) {
  return value === undefined ? "-" : new Intl.NumberFormat("en-IN").format(value);
}

function formatTime(value?: string) {
  if (!value) return "Waiting for data";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function stateTitle(state?: ElectionState) {
  if (!state) return "Loading states";
  return state.stateName ? `${state.stateName} (${state.stateCode})` : state.stateCode;
}

function battleClass(level: BattleLevel) {
  return `battle battle-${level}`;
}

function getPartyInitials(code?: string, name?: string) {
  const label = code || name || "?";
  if (code && code.length <= 5) return code;
  const words = label
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.map((word) => word[0]).join("").slice(0, 4);
  return initials || label.slice(0, 4).toUpperCase();
}

function PartyIcon({
  code,
  name,
  color,
  iconUrl,
  size = "md"
}: {
  code?: string;
  name?: string;
  color?: string;
  iconUrl?: string;
  size?: "sm" | "md";
}) {
  const label = code || name || "Party";
  const initials = getPartyInitials(code, name);
  const resolvedIconUrl = iconUrl ?? getPartyIconUrl(code, name);

  return (
    <span
      className={`party-icon party-icon-${size}${resolvedIconUrl ? " party-icon-image" : ""}`}
      style={{ backgroundColor: resolvedIconUrl ? "#fff" : color ?? "#667085" }}
      aria-label={`${label} icon`}
      title={label}
    >
      {resolvedIconUrl ? <img src={resolvedIconUrl} alt="" /> : initials}
    </span>
  );
}

function ProgressCard({ state }: { state: ElectionState }) {
  const declared = state.constituencies.filter((result) => result.status === "Won").length;
  const inProgress = state.constituencies.filter(
    (result) => result.status === "Result in Progress"
  ).length;
  const hasRoundData = state.totalRounds > 0;

  return (
    <section className="panel progress-panel">
      <div>
        <p className="eyebrow">Counting progress</p>
        <h2>{hasRoundData ? `Round ${state.countedRounds}/${state.totalRounds}` : "Round data unavailable"}</h2>
      </div>
      <strong>{state.countingProgressPct}%</strong>
      <div className="progress-track" aria-label="Counting progress">
        <span style={{ width: `${state.countingProgressPct}%` }} />
      </div>
      <div className="progress-stats">
        <span>
          <Clock3 size={15} /> {state.roundReportingConstituencies}/{state.totalConstituencies} seats reporting rounds
        </span>
        <span>
          <Activity size={15} /> Status known {state.statusKnown}/{state.totalConstituencies}
        </span>
        <span>
          <Activity size={15} /> {inProgress} active
        </span>
        <span>
          <CheckCircle2 size={15} /> {declared} won
        </span>
      </div>
    </section>
  );
}

function PartyStrip({ state }: { state: ElectionState }) {
  return (
    <section className="party-strip" aria-label="Party tally">
      {state.parties.slice(0, 12).map((party) => (
        <div className="party-pill" key={party.code}>
          <PartyIcon code={party.code} name={party.name} color={party.color} iconUrl={party.iconUrl} />
          <div>
            <strong>{party.code}</strong>
            <span>{party.leading + party.won}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function OverallCharts({ state }: { state: ElectionState }) {
  const topParties = state.parties.slice(0, 8);
  const maxSeats = Math.max(...topParties.map((party) => party.leading + party.won), 1);
  const pendingStatuses = Math.max(state.totalConstituencies - state.statusKnown, 0);

  return (
    <section className="panel chart-panel" aria-label="Overall result charts">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Overall charts</p>
          <h2>Party position and counting pace</h2>
        </div>
        <BarChart3 size={20} />
      </div>

      <div className="stacked-chart" aria-label="Party seat share">
        {topParties.map((party) => {
          const seats = party.leading + party.won;
          return (
            <span
              key={party.code}
              title={`${party.code}: ${seats}`}
              style={{
                width: `${percent(seats, state.totalConstituencies)}%`,
                backgroundColor: party.color
              }}
            />
          );
        })}
      </div>

      <div className="chart-grid">
        <div className="chart-block">
          <h3>Party tally</h3>
          <div className="bar-list">
            {topParties.map((party) => {
              const seats = party.leading + party.won;
              return (
                <div className="bar-row" key={party.code}>
                  <span className="bar-party">
                    <PartyIcon
                      code={party.code}
                      name={party.name}
                      color={party.color}
                      iconUrl={party.iconUrl}
                      size="sm"
                    />
                    {party.code}
                  </span>
                  <div className="bar-track">
                    <i
                      style={{
                        width: `${percent(seats, maxSeats)}%`,
                        backgroundColor: party.color
                      }}
                    />
                  </div>
                  <b>{seats}</b>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chart-block">
          <h3>Counting status</h3>
          <div className="metric-bars">
            <div>
              <span>Rounds counted</span>
              <strong>{state.countingProgressPct}%</strong>
              <div className="bar-track">
                <i style={{ width: `${state.countingProgressPct}%` }} />
              </div>
            </div>
            <div>
              <span>Status known</span>
              <strong>
                {state.statusKnown}/{state.totalConstituencies}
              </strong>
              <div className="bar-track">
                <i style={{ width: `${percent(state.statusKnown, state.totalConstituencies)}%` }} />
              </div>
            </div>
            <div>
              <span>Awaiting first trend</span>
              <strong>{pendingStatuses}</strong>
              <div className="bar-track">
                <i style={{ width: `${percent(pendingStatuses, state.totalConstituencies)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RaceRow({
  result,
  compact = false,
  onOpen
}: {
  result: ConstituencyResult;
  compact?: boolean;
  onOpen: (result: ConstituencyResult) => void;
}) {
  return (
    <button className="race-row" type="button" onClick={() => onOpen(result)}>
      <div className="race-main">
        <div>
          <span className="ac-number">AC {result.acNo}</span>
          <strong>{result.acName ?? `Constituency ${result.acNo}`}</strong>
        </div>
        <span className={battleClass(result.battleLevel)}>
          {getBattleLabel(result.battleLevel)}
        </span>
      </div>
      <div className="candidate-line">
        <PartyIcon
          code={result.leadingPartyCode}
          name={result.leadingPartyName}
          color={result.color}
          iconUrl={result.partyIconUrl}
          size="sm"
        />
        <span>
          {result.leadingCandidate ?? "Awaiting update"}{" "}
          <b>{result.leadingPartyCode ?? result.leadingPartyName ?? ""}</b>
        </span>
      </div>
      {!compact && (
        <div className="race-meta">
          <span>Margin {formatNumber(result.margin)}</span>
          <span>Round {result.roundCurrent && result.roundTotal ? `${result.roundCurrent}/${result.roundTotal}` : "-"}</span>
          <span>{result.status ?? "Unknown"}</span>
        </div>
      )}
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

function ConstituencyChart({ results }: { results: ConstituencyResult[] }) {
  const battleBuckets: Array<{ label: string; count: number; level: BattleLevel }> = [
    {
      label: "Critical",
      count: results.filter((result) => result.battleLevel === "critical").length,
      level: "critical"
    },
    {
      label: "Close",
      count: results.filter((result) => result.battleLevel === "close").length,
      level: "close"
    },
    {
      label: "Watch",
      count: results.filter((result) => result.battleLevel === "watch").length,
      level: "watch"
    },
    {
      label: "Normal",
      count: results.filter((result) => result.battleLevel === "normal").length,
      level: "normal"
    }
  ];
  const maxBattleCount = Math.max(...battleBuckets.map((bucket) => bucket.count), 1);
  const marginBuckets = [
    { label: "<=500", count: results.filter((result) => result.margin !== undefined && result.margin <= 500).length },
    {
      label: "<=1k",
      count: results.filter(
        (result) => result.margin !== undefined && result.margin > 500 && result.margin <= 1000
      ).length
    },
    {
      label: "<=2k",
      count: results.filter(
        (result) => result.margin !== undefined && result.margin > 1000 && result.margin <= 2000
      ).length
    },
    {
      label: "<=5k",
      count: results.filter(
        (result) => result.margin !== undefined && result.margin > 2000 && result.margin <= 5000
      ).length
    },
    { label: ">5k", count: results.filter((result) => result.margin !== undefined && result.margin > 5000).length },
    { label: "No margin", count: results.filter((result) => result.margin === undefined).length }
  ];
  const maxMarginCount = Math.max(...marginBuckets.map((bucket) => bucket.count), 1);

  return (
    <div className="constituency-chart" aria-label="Constituency data charts">
      <div className="chart-block">
        <h3>Race pressure</h3>
        <div className="bar-list">
          {battleBuckets.map((bucket) => (
            <div className="bar-row" key={bucket.label}>
              <span>{bucket.label}</span>
              <div className="bar-track">
                <i
                  className={`bar-${bucket.level}`}
                  style={{ width: `${percent(bucket.count, maxBattleCount)}%` }}
                />
              </div>
              <b>{bucket.count}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-block">
        <h3>Margin spread</h3>
        <div className="bar-list">
          {marginBuckets.map((bucket) => (
            <div className="bar-row" key={bucket.label}>
              <span>{bucket.label}</span>
              <div className="bar-track">
                <i style={{ width: `${percent(bucket.count, maxMarginCount)}%` }} />
              </div>
              <b>{bucket.count}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConstituencyList({
  results,
  search,
  filter,
  onOpen,
  detailsLoading
}: {
  results: ConstituencyResult[];
  search: string;
  filter: FilterMode;
  onOpen: (result: ConstituencyResult) => void;
  detailsLoading: boolean;
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = results
    .filter((result) => {
      if (!normalizedSearch) return true;
      return [
        result.acName,
        result.leadingCandidate,
        result.leadingPartyCode,
        result.leadingPartyName,
        result.trailingCandidate,
        result.trailingPartyName
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    })
    .filter((result) => {
      switch (filter) {
        case "close":
          return result.battleLevel !== "normal";
        case "lead-change":
          return result.leadChangedSinceLastPoll;
        case "in-progress":
          return result.status === "Result in Progress";
        case "won":
          return result.status === "Won";
        case "unknown":
          return result.status === "Unknown";
        default:
          return true;
      }
    })
    .sort(compareBattleResults);

  return (
    <section className="panel results-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Constituencies</p>
          <h2>{filtered.length} results</h2>
        </div>
      </div>
      {detailsLoading && (
        <div className="detail-loading">
          <Clock3 size={16} /> Loading constituency names, margins, and rounds...
        </div>
      )}
      <ConstituencyChart results={filtered} />
      <div className="race-list">
        {filtered.map((result) => (
          <RaceRow key={`${result.stateCode}-${result.acNo}`} result={result} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function DetailDrawer({
  result,
  onClose
}: {
  result?: ConstituencyResult;
  onClose: () => void;
}) {
  if (!result) return null;
  const marginMovement =
    result.marginDeltaSinceLastPoll === undefined
      ? "No previous margin"
      : result.marginDeltaSinceLastPoll > 0
        ? `Margin widened by ${formatNumber(result.marginDeltaSinceLastPoll)}`
        : result.marginDeltaSinceLastPoll < 0
          ? `Margin narrowed by ${formatNumber(Math.abs(result.marginDeltaSinceLastPoll))}`
          : "Margin unchanged";

  return (
    <aside className="drawer" aria-label="Constituency detail">
      <div className="drawer-header">
        <div>
          <span className="ac-number">AC {result.acNo}</span>
          <h2>{result.acName ?? `Constituency ${result.acNo}`}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close detail">
          <X size={18} />
        </button>
      </div>

      <div className="duel">
        <div>
          <p className="eyebrow">Leading</p>
          <PartyIcon
            code={result.leadingPartyCode}
            name={result.leadingPartyName}
            color={result.color}
            iconUrl={result.partyIconUrl}
          />
          <strong>{result.leadingCandidate ?? "Awaiting update"}</strong>
          <span>{result.leadingPartyName ?? result.leadingPartyCode ?? "-"}</span>
        </div>
        <div>
          <p className="eyebrow">Trailing</p>
          <PartyIcon
            code={result.trailingPartyCode}
            name={result.trailingPartyName}
            color="#8a949c"
          />
          <strong>{result.trailingCandidate ?? "Awaiting update"}</strong>
          <span>{result.trailingPartyName ?? result.trailingPartyCode ?? "-"}</span>
        </div>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>Margin</dt>
          <dd>{formatNumber(result.margin)}</dd>
        </div>
        <div>
          <dt>Round</dt>
          <dd>{result.roundCurrent && result.roundTotal ? `${result.roundCurrent}/${result.roundTotal}` : "-"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{result.status ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Battle</dt>
          <dd>{getBattleLabel(result.battleLevel)}</dd>
        </div>
      </dl>

      <div className="comparison">
        <Clock3 size={18} />
        <span>
          {result.leadChangedSinceLastPoll ? "Lead changed since last poll" : marginMovement}
        </span>
      </div>
    </aside>
  );
}

function SourceSettings({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <details className="source-settings">
      <summary>
        <Settings2 size={16} /> Sources
      </summary>
      <textarea
        aria-label="Custom ECI JSON feed URLs"
        placeholder="Paste one election-json URL per line"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <p className="source-note">
        Data from{" "}
        <a href="https://results.eci.gov.in/" target="_blank" rel="noreferrer">
          results.eci.gov.in
        </a>
        .
      </p>
      <button
        type="button"
        onClick={() => {
          writeCustomSourceText(draft);
          onChange(draft);
        }}
      >
        Save sources
      </button>
      <small>Saved in localStorage key {CUSTOM_SOURCES_KEY}.</small>
    </details>
  );
}

export function App() {
  const [customSourceText, setCustomSourceText] = useState(readCustomSourceText);
  const sources = useMemo(() => getRegisteredSources(customSourceText), [customSourceText]);
  const query = useElectionData(sources);
  const countdown = useCountdown(query.dataUpdatedAt || Date.now(), DEFAULT_REFRESH_MS);
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedResult, setSelectedResult] = useState<ConstituencyResult>();

  const states = query.data?.states ?? [];
  const selectedSummaryState =
    states.find((state) => state.stateCode === selectedStateCode) ?? states[0];
  const detailQuery = useElectionStateDetails(selectedSummaryState);
  const selectedState = detailQuery.data ?? selectedSummaryState;
  const detailsLoading = Boolean(
    selectedSummaryState && detailQuery.isFetching && !detailQuery.data
  );
  const detailsRefreshing = Boolean(
    selectedSummaryState && detailQuery.isFetching && detailQuery.data
  );

  useEffect(() => {
    const defaultState = states.find((state) => state.stateCode === DEFAULT_STATE_CODE) ?? states[0];
    if (!selectedStateCode && states[0]) {
      setSelectedStateCode(defaultState.stateCode);
    }
    if (selectedStateCode && states.length && !states.some((state) => state.stateCode === selectedStateCode)) {
      setSelectedStateCode(defaultState.stateCode);
    }
  }, [selectedStateCode, states]);

  return (
    <main>
      <header className="app-header">
        <div className="header-main">
          <div>
            <p className="eyebrow">Assembly results live</p>
            <h1>{stateTitle(selectedState)}</h1>
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={() => {
              void query.refetch();
              if (selectedSummaryState) void detailQuery.refetch();
            }}
            disabled={query.isFetching || detailQuery.isFetching}
          >
            <RefreshCw size={18} className={query.isFetching || detailQuery.isFetching ? "spin" : ""} />
            <span>{query.isFetching || detailQuery.isFetching ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
        <div className="status-bar">
          <span>Updated {formatTime(query.data?.updatedAt)}</span>
          <span>Next refresh in {countdown}s</span>
          {detailsLoading && <span>Loading selected state details...</span>}
          {detailsRefreshing && <span>Refreshing selected state details...</span>}
          {detailQuery.isError && <span className="error-text">Detail refresh failed; showing summary data</span>}
          {query.isError && <span className="error-text">Refresh failed; showing last good data</span>}
        </div>
        <SourceSettings value={customSourceText} onChange={setCustomSourceText} />
      </header>

      {query.isLoading && <div className="loading">Loading ECI results...</div>}
      {query.isError && !query.data && (
        <div className="loading error-state">Unable to load any configured ECI source.</div>
      )}

      {selectedState && (
        <div className="app-shell">
          <nav className="state-rail" aria-label="States">
            {states.map((state) => (
              <button
                key={state.stateCode}
                className={state.stateCode === selectedState.stateCode ? "active" : ""}
                type="button"
                onClick={() => setSelectedStateCode(state.stateCode)}
              >
                <span>{state.stateName ?? state.stateCode}</span>
                <b>{state.countingProgressPct}%</b>
              </button>
            ))}
          </nav>

          <div className="content-column">
            <div className="mobile-state-select">
              <select
                value={selectedState.stateCode}
                onChange={(event) => setSelectedStateCode(event.target.value)}
                aria-label="Select state"
              >
                {states.map((state) => (
                  <option value={state.stateCode} key={state.stateCode}>
                    {state.stateName ?? state.stateCode}
                  </option>
                ))}
              </select>
            </div>

            <ProgressCard state={selectedState} />
            <PartyStrip state={selectedState} />
            <OverallCharts state={selectedState} />

            <div className="toolbar">
              <label className="search-box">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search seat, candidate, party"
                />
              </label>
              <div className="filter-row">
                {filters.map((item) => (
                  <button
                    key={item.id}
                    className={filter === item.id ? "active" : ""}
                    type="button"
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <ConstituencyList
              results={selectedState.constituencies}
              search={search}
              filter={filter}
              onOpen={setSelectedResult}
              detailsLoading={detailsLoading}
            />
          </div>

        </div>
      )}

      <footer>
        <span>
          Data from{" "}
          <a href="https://results.eci.gov.in/" target="_blank" rel="noreferrer">
            results.eci.gov.in
          </a>
          ; displayed as live trends until final Form-20 data is available.
        </span>
        <a href="https://github.com/astrarudra" target="_blank" rel="noreferrer">
          Created by Rudra Roy
        </a>
      </footer>

      <DetailDrawer result={selectedResult} onClose={() => setSelectedResult(undefined)} />
    </main>
  );
}
