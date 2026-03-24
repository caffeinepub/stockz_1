# Stockz - ML-Based Stock Analysis Web App

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- Stock ticker search with support for US and international stocks (e.g. AAPL, TSLA, RELIANCE.NS)
- Timeframe selector: 6M, 1Y, 5Y
- Interactive candlestick chart with volume overlay, zoom/pan
- Technical indicators: SMA (20/50), EMA (20), RSI (14), MACD
- Daily metrics: last close price, daily change %, Buy/Sell/Hold signal
- ML component: Linear Regression trend analysis, next-day price prediction, prediction vs actual chart
- Backtesting engine: MA crossover strategy, total returns, Sharpe ratio, win/loss ratio, equity curve chart
- Multi-stock comparison mode (up to 3 tickers)
- CSV export of stock data and backtest results
- Dark-mode UI
- HTTP outcalls from backend to fetch stock data from Yahoo Finance compatible endpoint

### Modify
N/A

### Remove
N/A

## Implementation Plan
1. Backend (Motoko): HTTP outcall proxy to fetch OHLCV data from Yahoo Finance (query1.finance.yahoo.com). Expose query endpoint returning JSON with date, open, high, low, close, volume arrays.
2. Frontend: 
   - Sidebar: ticker input, timeframe selector, strategy selector, compare toggle
   - Main panel tabs: Overview, Indicators, ML Prediction, Backtesting, Compare
   - Candlestick chart using lightweight-charts or recharts
   - Compute SMA, EMA, RSI, MACD client-side
   - Linear Regression model in TypeScript for price prediction
   - Backtesting engine: MA crossover signals, PnL tracking, Sharpe ratio, equity curve
   - CSV export functionality
   - Dark theme throughout
