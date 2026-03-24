export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  predictions: number[];
  forecast: number[];
  forecastDays: number;
}

export function linearRegression(
  values: number[],
  forecastDays = 10,
): RegressionResult {
  const n = values.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;

  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - meanX) * (values[i] - meanY);
    ssXX += (xs[i] - meanX) ** 2;
    ssYY += (values[i] - meanY) ** 2;
  }
  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const r2 = ssXX > 0 && ssYY > 0 ? ssXY ** 2 / (ssXX * ssYY) : 0;

  const predictions = xs.map((x) => +(slope * x + intercept).toFixed(2));
  const forecast = Array.from(
    { length: forecastDays },
    (_, i) => +(slope * (n + i) + intercept).toFixed(2),
  );

  return {
    slope,
    intercept,
    r2: +r2.toFixed(4),
    predictions,
    forecast,
    forecastDays,
  };
}
