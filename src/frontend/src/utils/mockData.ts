export interface OHLCVData {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function seed(n: number): number {
  const x = Math.sin(n + 1) * 10000;
  return x - Math.floor(x);
}

export function generateMockData(ticker: string, days = 252): OHLCVData[] {
  const startPrices: Record<string, number> = {
    AAPL: 150,
    TSLA: 200,
    NVDA: 400,
    GOOGL: 130,
    MSFT: 300,
    AMZN: 140,
  };
  let price = startPrices[ticker] ?? 100;
  const data: OHLCVData[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const s = seed(i + ticker.charCodeAt(0));
    const change = (s - 0.48) * 0.035;
    const open = price;
    price = price * (1 + change);
    const high = Math.max(open, price) * (1 + seed(i * 3) * 0.012);
    const low = Math.min(open, price) * (1 - seed(i * 7) * 0.012);
    const vol = Math.round(seed(i * 11) * 50_000_000 + 20_000_000);

    data.push({
      date: d.toISOString().split("T")[0],
      timestamp: d.getTime(),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +price.toFixed(2),
      volume: vol,
    });
  }
  return data;
}

export function filterByRange(data: OHLCVData[], range: string): OHLCVData[] {
  const now = Date.now();
  const ms = range === "6M" ? 180 : range === "1Y" ? 365 : 5 * 365;
  const cutoff = now - ms * 86400000;
  return data.filter((d) => d.timestamp >= cutoff);
}

export function parseYahooData(json: string): OHLCVData[] {
  try {
    const parsed = JSON.parse(json);
    const result = parsed?.chart?.result?.[0];
    if (!result) return [];
    const ts: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    return ts
      .map((t, i) => ({
        date: new Date(t * 1000).toISOString().split("T")[0],
        timestamp: t * 1000,
        open: +(q.open?.[i] ?? 0).toFixed(2),
        high: +(q.high?.[i] ?? 0).toFixed(2),
        low: +(q.low?.[i] ?? 0).toFixed(2),
        close: +(q.close?.[i] ?? 0).toFixed(2),
        volume: Math.round(q.volume?.[i] ?? 0),
      }))
      .filter((d) => d.close > 0);
  } catch {
    return [];
  }
}
