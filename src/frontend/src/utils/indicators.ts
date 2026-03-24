import type { OHLCVData } from "./mockData";

export function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    return +(slice.reduce((a, b) => a + b, 0) / period).toFixed(4);
  });
}

export function ema(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (prev === null) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(+prev.toFixed(4));
    } else {
      prev = values[i] * k + prev * (1 - k);
      result.push(+prev.toFixed(4));
    }
  }
  return result;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }
    let gains = 0;
    let losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - values[j - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = gains / (losses || 1);
    result.push(+(100 - 100 / (1 + rs)).toFixed(2));
  }
  return result;
}

export function macd(values: number[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const macdLine = ema12.map((v, i) => {
    if (v === null || ema26[i] === null) return null;
    return +(v - ema26[i]!).toFixed(4);
  });
  const validMacd = macdLine.map((v) => v ?? 0);
  const signalLine = ema(validMacd, 9);
  const histogram = macdLine.map((v, i) => {
    if (v === null || signalLine[i] === null) return null;
    return +(v - signalLine[i]!).toFixed(4);
  });
  return { macd: macdLine, signal: signalLine, histogram };
}

export function bollingerBands(
  values: number[],
  period = 20,
  stdDev = 2,
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = sma(values, period);
  const upper = middle.map((m, i) => {
    if (m === null || i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(
      slice.reduce((a, b) => a + (b - avg) ** 2, 0) / period,
    );
    return +(m + stdDev * std).toFixed(4);
  });
  const lower = middle.map((m, i) => {
    if (m === null || i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(
      slice.reduce((a, b) => a + (b - avg) ** 2, 0) / period,
    );
    return +(m - stdDev * std).toFixed(4);
  });
  return { upper, middle, lower };
}

export function computeIndicators(data: OHLCVData[]) {
  const closes = data.map((d) => d.close);
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const e20 = ema(closes, 20);
  const rsiVals = rsi(closes);
  const macdData = macd(closes);
  const bb = bollingerBands(closes);
  return data.map((d, i) => ({
    ...d,
    sma20: s20[i],
    sma50: s50[i],
    ema20: e20[i],
    rsi: rsiVals[i],
    macdLine: macdData.macd[i],
    macdSignal: macdData.signal[i],
    macdHist: macdData.histogram[i],
    bbUpper: bb.upper[i],
    bbMiddle: bb.middle[i],
    bbLower: bb.lower[i],
  }));
}

export type EnrichedData = ReturnType<typeof computeIndicators>[number];

export function getSignal(data: EnrichedData[]): "BUY" | "SELL" | "HOLD" {
  const last = data[data.length - 1];
  if (!last) return "HOLD";
  const rsiVal = last.rsi ?? 50;
  const macdVal = last.macdLine ?? 0;
  const macdSig = last.macdSignal ?? 0;
  const priceAboveSma20 = last.sma20 ? last.close > last.sma20 : false;
  let score = 0;
  if (rsiVal < 35) score++;
  if (rsiVal > 65) score--;
  if (macdVal > macdSig) score++;
  else score--;
  if (priceAboveSma20) score++;
  else score--;
  if (score >= 2) return "BUY";
  if (score <= -2) return "SELL";
  return "HOLD";
}
