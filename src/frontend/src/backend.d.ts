import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface PriceQuote {
    currentPrice: number;
    ticker: string;
    dailyChange: number;
    previousClose: number;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface backendInterface {
    /**
     * / Add stock to user's favorites list.
     */
    addFavorite(ticker: string): Promise<void>;
    /**
     * / Get user's favorite stocks.
     */
    getFavorites(): Promise<Array<[string, bigint]>>;
    /**
     * / Fetch multiple stock tickers for comparison.
     */
    getMultipleStocks(tickers: Array<string>, range: string): Promise<Array<string>>;
    /**
     * / Fetch current price quote data.
     */
    getPriceQuote(ticker: string): Promise<PriceQuote>;
    /**
     * / Fetch OHLCV data from Yahoo Finance API with caching.
     */
    getStockData(ticker: string, range: string): Promise<string>;
    /**
     * / Transform function to handle HTTP outcall responses.
     */
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
