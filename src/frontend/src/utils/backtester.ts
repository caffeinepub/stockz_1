import { sma } from "./indicators";
import type { OHLCVData } from "./mockData";

export interface Trade {
  date: string;
  type: "BUY" | "SELL";
  price: number;
  shares: number;
  pnl: number;
  cumPnl: number;
}

export interface BacktestResult {
  trades: Trade[];
  equity: { date: string; value: number }[];
  totalReturn: number;
  sharpeRatio: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
}

export function runMACrossover(
  data: OHLCVData[],
  shortP = 20,
  longP = 50,
  initialCapital = 10000,
): BacktestResult {
  const closes = data.map((d) => d.close);
  const shortSma = sma(closes, shortP);
  const longSma = sma(closes, longP);

  let cash = initialCapital;
  let shares = 0;
  let inPosition = false;
  let buyPrice = 0;
  const trades: Trade[] = [];
  const equity: { date: string; value: number }[] = [];
  let cumPnl = 0;

  for (let i = 1; i < data.length; i++) {
    const s = shortSma[i];
    const l = longSma[i];
    const sPrev = shortSma[i - 1];
    const lPrev = longSma[i - 1];
    const price = data[i].close;

    if (s !== null && l !== null && sPrev !== null && lPrev !== null) {
      // Golden cross: buy
      if (!inPosition && sPrev <= lPrev && s > l) {
        shares = Math.floor(cash / price);
        cash -= shares * price;
        buyPrice = price;
        inPosition = true;
        trades.push({
          date: data[i].date,
          type: "BUY",
          price,
          shares,
          pnl: 0,
          cumPnl,
        });
      }
      // Death cross: sell
      else if (inPosition && sPrev >= lPrev && s < l) {
        const pnl = (price - buyPrice) * shares;
        cash += shares * price;
        cumPnl += pnl;
        trades.push({
          date: data[i].date,
          type: "SELL",
          price,
          shares,
          pnl: +pnl.toFixed(2),
          cumPnl: +cumPnl.toFixed(2),
        });
        shares = 0;
        inPosition = false;
      }
    }
    equity.push({
      date: data[i].date,
      value: +(cash + shares * price).toFixed(2),
    });
  }

  // Close position at end
  if (inPosition && shares > 0) {
    const price = data[data.length - 1].close;
    const pnl = (price - buyPrice) * shares;
    cumPnl += pnl;
    trades.push({
      date: data[data.length - 1].date,
      type: "SELL",
      price,
      shares,
      pnl: +pnl.toFixed(2),
      cumPnl: +cumPnl.toFixed(2),
    });
  }

  const finalValue = equity[equity.length - 1]?.value ?? initialCapital;
  const totalReturn = +(
    ((finalValue - initialCapital) / initialCapital) *
    100
  ).toFixed(2);

  // Sharpe ratio
  const equityValues = equity.map((e) => e.value);
  const returns: number[] = [];
  for (let i = 1; i < equityValues.length; i++) {
    returns.push((equityValues[i] - equityValues[i - 1]) / equityValues[i - 1]);
  }
  const meanR = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const stdR = Math.sqrt(
    returns.reduce((a, b) => a + (b - meanR) ** 2, 0) / (returns.length || 1),
  );
  const sharpeRatio =
    stdR > 0 ? +((meanR / stdR) * Math.sqrt(252)).toFixed(2) : 0;

  // Win rate
  const sellTrades = trades.filter((t) => t.type === "SELL");
  const wins = sellTrades.filter((t) => t.pnl > 0).length;
  const winRate =
    sellTrades.length > 0 ? +((wins / sellTrades.length) * 100).toFixed(1) : 0;

  // Max drawdown
  let peak = initialCapital;
  let maxDD = 0;
  for (const e of equityValues) {
    if (e > peak) peak = e;
    const dd = (peak - e) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    trades,
    equity,
    totalReturn,
    sharpeRatio,
    winRate,
    maxDrawdown: +(maxDD * 100).toFixed(2),
    totalTrades: trades.length,
  };
}

export function exportCSV(trades: Trade[]): void {
  const header = "Date,Type,Price,Shares,PnL,Cumulative PnL\n";
  const rows = trades
    .map(
      (t) => `${t.date},${t.type},${t.price},${t.shares},${t.pnl},${t.cumPnl}`,
    )
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backtest_trades.csv";
  a.click();
  URL.revokeObjectURL(url);
}
