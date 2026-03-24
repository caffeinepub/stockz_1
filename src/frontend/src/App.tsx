import {
  BarChart2,
  Download,
  Minus,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createActorWithConfig } from "./config";
import { exportCSV, runMACrossover } from "./utils/backtester";
import type { BacktestResult } from "./utils/backtester";
import { computeIndicators, getSignal } from "./utils/indicators";
import type { EnrichedData } from "./utils/indicators";
import { linearRegression } from "./utils/linearRegression";
import {
  filterByRange,
  generateMockData,
  parseYahooData,
} from "./utils/mockData";
import type { OHLCVData } from "./utils/mockData";

const TABS = [
  "Overview",
  "Indicators",
  "ML Predict",
  "Backtest",
  "Compare",
] as const;
type Tab = (typeof TABS)[number];
const WATCHLIST = ["AAPL", "TSLA", "NVDA", "GOOGL", "MSFT", "AMZN"];
const RANGES = ["6M", "1Y", "5Y"] as const;
type Range = (typeof RANGES)[number];

const BG = "#0B1220";
const CARD = "#141F2C";
const BORDER = "#223247";
const TEXT = "#E6EDF6";
const MUTED = "#9AA9BD";
const GREEN = "#22C55E";
const RED = "#EF4444";
const BLUE = "#3B82F6";
const ORANGE = "#F97316";
const PURPLE = "#A78BFA";

function fmt(n: number, dec = 2) {
  return n.toFixed(dec);
}
function fmtBig(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return `${(n / 1e3).toFixed(0)}K`;
}

const cardStyle: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: "16px",
  marginBottom: 20,
};

const axisStyle = { fill: MUTED, fontSize: 11 };
const gridStyle = { stroke: BORDER, strokeDasharray: "3 3" };

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#0F1A2A",
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
      }}
    >
      <p style={{ color: MUTED, marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? TEXT }}>
          {p.name}: {typeof p.value === "number" ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function App() {
  const [ticker, setTicker] = useState("AAPL");
  const [inputTicker, setInputTicker] = useState("AAPL");
  const [range, setRange] = useState<Range>("1Y");
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [allData, setAllData] = useState<Record<string, OHLCVData[]>>({});
  const [enriched, setEnriched] = useState<EnrichedData[]>([]);
  const [signal, setSignal] = useState<"BUY" | "SELL" | "HOLD">("HOLD");
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [compareInputs, setCompareInputs] = useState(["AAPL", "TSLA", "NVDA"]);

  function processData(raw: OHLCVData[], r: Range) {
    const filtered = filterByRange(raw, r);
    const enrichedData = computeIndicators(filtered);
    setEnriched(enrichedData);
    setSignal(getSignal(enrichedData));
  }

  function getOrGenerate(
    t: string,
    currentAll: Record<string, OHLCVData[]>,
  ): [OHLCVData[], Record<string, OHLCVData[]>] {
    if (currentAll[t]) return [currentAll[t], currentAll];
    const data = generateMockData(t);
    return [data, { ...currentAll, [t]: data }];
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional on mount only
  useEffect(() => {
    const data: Record<string, OHLCVData[]> = {};
    for (const t of WATCHLIST) {
      data[t] = generateMockData(t);
    }
    setAllData(data);
    processData(data.AAPL, "1Y");
  }, []);

  const handleFetch = async () => {
    const t = inputTicker.toUpperCase().trim();
    if (!t) return;
    setLoading(true);
    setError("");
    try {
      const actor = await createActorWithConfig();
      const rangeMap: Record<Range, string> = {
        "6M": "6mo",
        "1Y": "1y",
        "5Y": "5y",
      };
      const json = await actor.getStockData(t, rangeMap[range]);
      const parsed = parseYahooData(json);
      if (parsed.length > 0) {
        setAllData((prev) => ({ ...prev, [t]: parsed }));
        setTicker(t);
        processData(parsed, range);
      } else {
        const [mock, next] = getOrGenerate(t, allData);
        setAllData(next);
        setTicker(t);
        processData(mock, range);
      }
    } catch {
      const [mock, next] = getOrGenerate(t, allData);
      setAllData(next);
      setTicker(t);
      processData(mock, range);
      setError("Live data unavailable — showing simulated data.");
    }
    setLoading(false);
  };

  const handleWatchlistClick = (t: string) => {
    setInputTicker(t);
    setTicker(t);
    const raw = allData[t] ?? generateMockData(t);
    processData(raw, range);
    setError("");
  };

  const handleRangeChange = (r: Range) => {
    setRange(r);
    const raw = allData[ticker] ?? generateMockData(ticker);
    processData(raw, r);
  };

  const handleRunBacktest = () => {
    const raw = allData[ticker] ?? generateMockData(ticker);
    const filtered = filterByRange(raw, range);
    const result = runMACrossover(filtered);
    setBacktest(result);
  };

  const last = enriched[enriched.length - 1];
  const prev = enriched[enriched.length - 2];
  const dailyChange =
    last && prev ? ((last.close - prev.close) / prev.close) * 100 : 0;
  const high52 = enriched.length ? Math.max(...enriched.map((d) => d.high)) : 0;
  const low52 = enriched.length ? Math.min(...enriched.map((d) => d.low)) : 0;

  const mlResult =
    enriched.length > 10
      ? linearRegression(enriched.map((d) => d.close))
      : null;
  const mlChartData = enriched.map((d, i) => ({
    date: d.date,
    actual: d.close,
    predicted: mlResult?.predictions[i] ?? null,
  }));
  const forecastData =
    mlResult?.forecast.map((v, i) => ({
      date: `+${i + 1}d`,
      forecast: v,
    })) ?? [];

  const chartData =
    enriched.length > 200
      ? enriched.filter((_, i) => i % Math.ceil(enriched.length / 200) === 0)
      : enriched;

  const tickFormatter = (val: string) => val?.slice(5) ?? "";

  const compareChartData = (() => {
    const tickers = compareInputs.filter((t) => t);
    const allFiltered = tickers.map((t) =>
      filterByRange(allData[t] ?? generateMockData(t), range),
    );
    const minLen = Math.min(...allFiltered.map((d) => d.length));
    if (minLen < 2) return [];
    return Array.from({ length: minLen }, (_, i) => {
      const obj: Record<string, number | string> = {
        date: allFiltered[0][i].date,
      };
      for (let ti = 0; ti < tickers.length; ti++) {
        const base = allFiltered[ti][0].close;
        obj[tickers[ti]] = +(
          ((allFiltered[ti][i].close - base) / base) *
          100
        ).toFixed(2);
      }
      return obj;
    });
  })();

  const compareColors = [BLUE, GREEN, ORANGE];

  return (
    <div
      style={{
        background: BG,
        minHeight: "100vh",
        color: TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          background: CARD,
          borderBottom: `1px solid ${BORDER}`,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          height: 56,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 700,
            fontSize: 18,
            color: BLUE,
          }}
        >
          <BarChart2 size={22} />
          <span>Stockz</span>
        </div>
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                background: activeTab === tab ? `${BLUE}22` : "transparent",
                color: activeTab === tab ? BLUE : MUTED,
                borderBottom:
                  activeTab === tab
                    ? `2px solid ${BLUE}`
                    : "2px solid transparent",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: MUTED,
            fontSize: 13,
          }}
        >
          <Search size={16} />
          <span>ML Stock Analysis</span>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div
          style={{
            width: 240,
            background: CARD,
            borderRight: `1px solid ${BORDER}`,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          {/* Ticker Input */}
          <div>
            <label
              htmlFor="ticker-input"
              style={{
                fontSize: 11,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Ticker Symbol
            </label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input
                id="ticker-input"
                value={inputTicker}
                onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="AAPL"
                style={{
                  flex: 1,
                  background: "#0B1220",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 6,
                  color: TEXT,
                  padding: "7px 10px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleFetch}
                disabled={loading}
                style={{
                  background: BLUE,
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 10px",
                  cursor: "pointer",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {loading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
              </button>
            </div>
            {error && (
              <p style={{ color: ORANGE, fontSize: 11, marginTop: 4 }}>
                {error}
              </p>
            )}
          </div>

          {/* Timeframe */}
          <div>
            <p
              style={{
                fontSize: 11,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: 1,
                margin: 0,
                marginBottom: 6,
              }}
            >
              Timeframe
            </p>
            <div style={{ display: "flex", gap: 4 }}>
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRangeChange(r)}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    borderRadius: 5,
                    border: `1px solid ${BORDER}`,
                    cursor: "pointer",
                    fontSize: 12,
                    background: range === r ? BLUE : "transparent",
                    color: range === r ? "#fff" : MUTED,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Signal */}
          <div
            style={{
              background: "#0B1220",
              borderRadius: 8,
              padding: 12,
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>
              SIGNAL
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 20,
                fontWeight: 700,
                color:
                  signal === "BUY" ? GREEN : signal === "SELL" ? RED : MUTED,
              }}
            >
              {signal === "BUY" ? (
                <TrendingUp size={20} />
              ) : signal === "SELL" ? (
                <TrendingDown size={20} />
              ) : (
                <Minus size={20} />
              )}
              {signal}
            </div>
            {last && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  ${fmt(last.close)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: dailyChange >= 0 ? GREEN : RED,
                  }}
                >
                  {dailyChange >= 0 ? "+" : ""}
                  {fmt(dailyChange)}%
                </div>
              </div>
            )}
          </div>

          {/* Watchlist */}
          <div>
            <p
              style={{
                fontSize: 11,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: 1,
                margin: 0,
                marginBottom: 6,
              }}
            >
              Watchlist
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {WATCHLIST.map((t) => {
                const raw = allData[t] ?? [];
                const last2 = raw.slice(-2);
                const chg =
                  last2.length === 2
                    ? ((last2[1].close - last2[0].close) / last2[0].close) * 100
                    : 0;
                const lastClose = last2[1]?.close ?? 0;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleWatchlistClick(t)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 8px",
                      borderRadius: 5,
                      border: "none",
                      cursor: "pointer",
                      background: ticker === t ? `${BLUE}18` : "transparent",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: ticker === t ? BLUE : TEXT,
                      }}
                    >
                      {t}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      {lastClose > 0 && (
                        <div style={{ fontSize: 12, color: TEXT }}>
                          ${fmt(lastClose)}
                        </div>
                      )}
                      <div
                        style={{ fontSize: 11, color: chg >= 0 ? GREEN : RED }}
                      >
                        {chg >= 0 ? "+" : ""}
                        {fmt(chg)}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
                {ticker}
              </h1>
              <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
                Stock Analysis Dashboard
              </p>
            </div>
            {last && (
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <MetricCard label="Last Close" value={`$${fmt(last.close)}`} />
                <MetricCard
                  label="Daily Change"
                  value={`${dailyChange >= 0 ? "+" : ""}${fmt(dailyChange)}%`}
                  positive={dailyChange >= 0}
                />
                <MetricCard label="52W High" value={`$${fmt(high52)}`} />
                <MetricCard label="52W Low" value={`$${fmt(low52)}`} />
                <MetricCard label="Volume" value={fmtBig(last.volume)} />
              </div>
            )}
          </div>

          {activeTab === "Overview" && (
            <OverviewTab chartData={chartData} tickFormatter={tickFormatter} />
          )}
          {activeTab === "Indicators" && (
            <IndicatorsTab
              chartData={chartData}
              tickFormatter={tickFormatter}
            />
          )}
          {activeTab === "ML Predict" && (
            <MLTab
              mlChartData={mlChartData}
              forecastData={forecastData}
              mlResult={mlResult}
              tickFormatter={tickFormatter}
            />
          )}
          {activeTab === "Backtest" && (
            <BacktestTab
              backtest={backtest}
              onRun={handleRunBacktest}
              onExport={() => backtest && exportCSV(backtest.trades)}
            />
          )}
          {activeTab === "Compare" && (
            <CompareTab
              compareInputs={compareInputs}
              setCompareInputs={setCompareInputs}
              compareChartData={compareChartData}
              compareColors={compareColors}
              range={range}
              allData={allData}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  positive,
}: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined ? TEXT : positive ? GREEN : RED;
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "8px 14px",
        minWidth: 90,
      }}
    >
      <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: { title: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div
        style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 12 }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function OverviewTab({
  chartData,
  tickFormatter,
}: { chartData: EnrichedData[]; tickFormatter: (v: string) => string }) {
  return (
    <div>
      <SectionCard title="Price & Moving Averages">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid {...gridStyle} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={axisStyle}
            />
            <YAxis domain={["auto", "auto"]} tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: MUTED }} />
            <Area
              type="monotone"
              dataKey="close"
              name="Close"
              stroke={BLUE}
              fill={`${BLUE}15`}
              dot={false}
              strokeWidth={1.5}
            />
            <Line
              type="monotone"
              dataKey="sma20"
              name="SMA20"
              stroke={ORANGE}
              dot={false}
              strokeWidth={1.5}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="sma50"
              name="SMA50"
              stroke={PURPLE}
              dot={false}
              strokeWidth={1.5}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ema20"
              name="EMA20"
              stroke={GREEN}
              dot={false}
              strokeWidth={1}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="Volume">
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData}>
            <CartesianGrid {...gridStyle} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={axisStyle}
            />
            <YAxis tickFormatter={(v: number) => fmtBig(v)} tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="volume" name="Volume" fill={`${BLUE}80`} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

function IndicatorsTab({
  chartData,
  tickFormatter,
}: { chartData: EnrichedData[]; tickFormatter: (v: string) => string }) {
  return (
    <div>
      <SectionCard title="RSI (14) — Overbought > 70 | Oversold < 30">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid {...gridStyle} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={axisStyle}
            />
            <YAxis domain={[0, 100]} tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={70}
              stroke={RED}
              strokeDasharray="4 4"
              label={{ value: "OB", fill: RED, fontSize: 10 }}
            />
            <ReferenceLine
              y={30}
              stroke={GREEN}
              strokeDasharray="4 4"
              label={{ value: "OS", fill: GREEN, fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="rsi"
              name="RSI"
              stroke={PURPLE}
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="MACD">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData}>
            <CartesianGrid {...gridStyle} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={axisStyle}
            />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="macdHist"
              name="Histogram"
              fill={BLUE}
              opacity={0.7}
            />
            <Line
              type="monotone"
              dataKey="macdLine"
              name="MACD"
              stroke={ORANGE}
              dot={false}
              strokeWidth={1.5}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="macdSignal"
              name="Signal"
              stroke={RED}
              dot={false}
              strokeWidth={1.5}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="Bollinger Bands">
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData}>
            <CartesianGrid {...gridStyle} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={axisStyle}
            />
            <YAxis domain={["auto", "auto"]} tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="bbUpper"
              name="Upper Band"
              stroke={`${BLUE}80`}
              fill={`${BLUE}10`}
              dot={false}
              strokeWidth={1}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="bbLower"
              name="Lower Band"
              stroke={`${BLUE}80`}
              fill={`${BLUE}10`}
              dot={false}
              strokeWidth={1}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="close"
              name="Close"
              stroke={TEXT}
              dot={false}
              strokeWidth={1.5}
            />
            <Line
              type="monotone"
              dataKey="bbMiddle"
              name="SMA20"
              stroke={ORANGE}
              dot={false}
              strokeWidth={1}
              strokeDasharray="4 4"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

function MLTab({
  mlChartData,
  forecastData,
  mlResult,
  tickFormatter,
}: {
  mlChartData: { date: string; actual: number; predicted: number | null }[];
  forecastData: { date: string; forecast: number }[];
  mlResult: ReturnType<typeof linearRegression> | null;
  tickFormatter: (v: string) => string;
}) {
  const thinned =
    mlChartData.length > 200
      ? mlChartData.filter(
          (_, i) => i % Math.ceil(mlChartData.length / 200) === 0,
        )
      : mlChartData;
  const lastActual = mlChartData[mlChartData.length - 1]?.actual ?? 0;
  const lastForecast = forecastData[forecastData.length - 1]?.forecast ?? 0;
  const changePct =
    lastActual > 0 ? ((lastForecast - lastActual) / lastActual) * 100 : 0;

  return (
    <div>
      <div
        style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}
      >
        <MetricCard
          label="R² Score"
          value={mlResult ? `${fmt(mlResult.r2 * 100)}%` : "—"}
        />
        <MetricCard
          label="Trend"
          value={
            mlResult ? (mlResult.slope > 0 ? "↑ Bullish" : "↓ Bearish") : "—"
          }
          positive={mlResult ? mlResult.slope > 0 : undefined}
        />
        <MetricCard
          label="10-Day Forecast"
          value={lastForecast > 0 ? `$${fmt(lastForecast)}` : "—"}
        />
        <MetricCard
          label="Predicted Change"
          value={`${changePct >= 0 ? "+" : ""}${fmt(changePct)}%`}
          positive={changePct >= 0}
        />
      </div>
      <SectionCard title="Actual vs Linear Regression Fit">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={thinned}>
            <CartesianGrid {...gridStyle} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={axisStyle}
            />
            <YAxis domain={["auto", "auto"]} tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke={BLUE}
              dot={false}
              strokeWidth={1.5}
            />
            <Line
              type="monotone"
              dataKey="predicted"
              name="Regression"
              stroke={ORANGE}
              dot={false}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="10-Day Price Forecast">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={forecastData}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis domain={["auto", "auto"]} tick={axisStyle} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke={GREEN}
              fill={`${GREEN}20`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

function BacktestTab({
  backtest,
  onRun,
  onExport,
}: {
  backtest: BacktestResult | null;
  onRun: () => void;
  onExport: () => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={onRun}
          style={{
            background: BLUE,
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Run MA Crossover (20/50)
        </button>
        {backtest && (
          <button
            type="button"
            onClick={onExport}
            style={{
              background: "transparent",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: MUTED,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>
      {backtest ? (
        <div>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <MetricCard
              label="Total Return"
              value={`${backtest.totalReturn >= 0 ? "+" : ""}${backtest.totalReturn}%`}
              positive={backtest.totalReturn >= 0}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={fmt(backtest.sharpeRatio)}
              positive={backtest.sharpeRatio > 1}
            />
            <MetricCard
              label="Win Rate"
              value={`${backtest.winRate}%`}
              positive={backtest.winRate > 50}
            />
            <MetricCard
              label="Max Drawdown"
              value={`-${backtest.maxDrawdown}%`}
              positive={false}
            />
            <MetricCard
              label="Total Trades"
              value={String(backtest.totalTrades)}
            />
          </div>
          <SectionCard title="Equity Curve ($10,000 initial)">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={backtest.equity.filter(
                  (_, i) => i % Math.ceil(backtest.equity.length / 200) === 0,
                )}
              >
                <CartesianGrid {...gridStyle} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v?.slice(5) ?? ""}
                  tick={axisStyle}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                  tick={axisStyle}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Portfolio"
                  stroke={GREEN}
                  fill={`${GREEN}25`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>
          <SectionCard title="Trade Log">
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      color: MUTED,
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    {[
                      "Date",
                      "Type",
                      "Price",
                      "Shares",
                      "P&L",
                      "Cumulative P&L",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "6px 10px",
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {backtest.trades.map((t, i) => (
                    <tr
                      key={`${t.date}-${i}`}
                      style={{ borderBottom: `1px solid ${BORDER}20` }}
                    >
                      <td style={{ padding: "5px 10px" }}>{t.date}</td>
                      <td
                        style={{
                          padding: "5px 10px",
                          color: t.type === "BUY" ? GREEN : RED,
                          fontWeight: 600,
                        }}
                      >
                        {t.type}
                      </td>
                      <td style={{ padding: "5px 10px" }}>${fmt(t.price)}</td>
                      <td style={{ padding: "5px 10px" }}>{t.shares}</td>
                      <td
                        style={{
                          padding: "5px 10px",
                          color: t.pnl >= 0 ? GREEN : RED,
                        }}
                      >
                        {t.pnl >= 0 ? "+" : ""}${fmt(t.pnl)}
                      </td>
                      <td
                        style={{
                          padding: "5px 10px",
                          color: t.cumPnl >= 0 ? GREEN : RED,
                        }}
                      >
                        {t.cumPnl >= 0 ? "+" : ""}${fmt(t.cumPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      ) : (
        <div
          style={{
            ...cardStyle,
            textAlign: "center",
            padding: 60,
            color: MUTED,
          }}
        >
          Click "Run MA Crossover" to backtest a moving average crossover
          strategy on the current ticker.
        </div>
      )}
    </div>
  );
}

function CompareTab({
  compareInputs,
  setCompareInputs,
  compareChartData,
  compareColors,
  range,
  allData,
}: {
  compareInputs: string[];
  setCompareInputs: (v: string[]) => void;
  compareChartData: Record<string, number | string>[];
  compareColors: string[];
  range: string;
  allData: Record<string, OHLCVData[]>;
}) {
  const tickers = compareInputs.filter((t) => t);
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
          Compare up to 3 tickers:
        </p>
        {compareInputs.map((t, i) => (
          <input
            // biome-ignore lint/suspicious/noArrayIndexKey: compare inputs are position-based
            key={`compare-slot-${i}`}
            value={t}
            onChange={(e) => {
              const next = [...compareInputs];
              next[i] = e.target.value.toUpperCase();
              setCompareInputs(next);
            }}
            placeholder={`Ticker ${i + 1}`}
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              color: TEXT,
              padding: "8px 12px",
              fontSize: 13,
              outline: "none",
              width: 90,
            }}
          />
        ))}
      </div>
      <SectionCard title={`Normalized Returns (%) — ${range}`}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={compareChartData}>
            <CartesianGrid {...gridStyle} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => v?.slice(5) ?? ""}
              tick={axisStyle}
            />
            <YAxis
              tickFormatter={(v: number) =>
                `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
              }
              tick={axisStyle}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {tickers.map((t, i) => (
              <Line
                key={t}
                type="monotone"
                dataKey={t}
                stroke={compareColors[i] ?? BLUE}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="Comparison Stats">
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr style={{ color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
              {["Ticker", "Return %", "Last Price", "Period"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((t, i) => {
              const raw = allData[t] ?? generateMockData(t);
              const filtered = filterByRange(raw, range as Range);
              const first = filtered[0]?.close ?? 1;
              const lastClose = filtered[filtered.length - 1]?.close ?? 1;
              const ret = ((lastClose - first) / first) * 100;
              return (
                <tr key={t} style={{ borderBottom: `1px solid ${BORDER}20` }}>
                  <td
                    style={{
                      padding: "6px 10px",
                      color: compareColors[i],
                      fontWeight: 700,
                    }}
                  >
                    {t}
                  </td>
                  <td
                    style={{
                      padding: "6px 10px",
                      color: ret >= 0 ? GREEN : RED,
                    }}
                  >
                    {ret >= 0 ? "+" : ""}
                    {ret.toFixed(2)}%
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    ${lastClose.toFixed(2)}
                  </td>
                  <td style={{ padding: "6px 10px", color: MUTED }}>{range}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}
