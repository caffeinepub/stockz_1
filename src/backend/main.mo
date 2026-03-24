import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Blob "mo:core/Blob";
import Array "mo:core/Array";
import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import OutCall "http-outcalls/outcall";

actor {
  type StockData = {
    ticker : Text;
    range : Text;
    timestamp : Int;
    responseBody : Text;
  };

  module StockData {
    public func compare(stockData1 : StockData, stockData2 : StockData) : Order.Order {
      switch (Text.compare(stockData1.ticker, stockData2.ticker)) {
        case (#equal) {
          switch (Text.compare(stockData1.range, stockData2.range)) {
            case (#equal) { Int.compare(stockData1.timestamp, stockData2.timestamp) };
            case (order) { order };
          };
        };
        case (order) { order };
      };
    };
  };

  type CacheKey = {
    ticker : Text;
    range : Text;
  };

  module CacheKey {
    public func compare(cacheKey1 : CacheKey, cacheKey2 : CacheKey) : Order.Order {
      switch (Text.compare(cacheKey1.ticker, cacheKey2.ticker)) {
        case (#equal) { Text.compare(cacheKey1.range, cacheKey2.range) };
        case (order) { order };
      };
    };
  };

  type PriceQuote = {
    ticker : Text;
    currentPrice : Float;
    previousClose : Float;
    dailyChange : Float;
  };

  let stockCache = Map.empty<CacheKey, StockData>();
  let userFavorites = Map.empty<Principal, [(Text, Int)]>(); // ticker, timestamp

  /// Transform function to handle HTTP outcall responses.
  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  /// Fetch OHLCV data from Yahoo Finance API with caching.
  public shared ({ caller }) func getStockData(ticker : Text, range : Text) : async Text {
    let cacheKey : CacheKey = {
      ticker;
      range;
    };

    switch (stockCache.get(cacheKey)) {
      case (?cachedData) {
        if (Time.now() - cachedData.timestamp < 24 * 60 * 60 * 1000_000_000) {
          // Return cached data if less than 24 hours old
          return cachedData.responseBody;
        };
      };
      case (null) {};
    };

    // Fetch from Yahoo Finance API
    let url = "https://query1.finance.yahoo.com/v8/finance/chart/" # ticker # "?interval=1d&range=" # range;
    let response = await OutCall.httpGetRequest(url, [], transform);

    let stockData = {
      ticker;
      range;
      timestamp = Time.now();
      responseBody = response;
    };

    stockCache.add(cacheKey, stockData);
    response;
  };

  /// Fetch multiple stock tickers for comparison.
  public shared ({ caller }) func getMultipleStocks(tickers : [Text], range : Text) : async [Text] {
    let responses = List.empty<Text>();
    for (ticker in tickers.values()) {
      let data = await getStockData(ticker, range);
      responses.add(data);
    };
    responses.toArray();
  };

  /// Fetch current price quote data.
  public shared ({ caller }) func getPriceQuote(ticker : Text) : async PriceQuote {
    let url = "https://query1.finance.yahoo.com/v8/finance/chart/" # ticker # "?interval=1d&range=1d";
    let response = await OutCall.httpGetRequest(url, [], transform);

    // Parse response to extract currentPrice and previousClose (Assume frontend handles parsing)
    {
      ticker;
      currentPrice = 0.0;
      previousClose = 0.0;
      dailyChange = 0.0;
    };
  };

  /// Add stock to user's favorites list.
  public shared ({ caller }) func addFavorite(ticker : Text) : async () {
    let updatedFavorites = switch (userFavorites.get(caller)) {
      case (?favorites) { favorites.concat([(ticker, Time.now())]) };
      case (null) { [(ticker, Time.now())] };
    };
    userFavorites.add(caller, updatedFavorites);
  };

  /// Get user's favorite stocks.
  public query ({ caller }) func getFavorites() : async [(Text, Int)] {
    switch (userFavorites.get(caller)) {
      case (?favorites) { favorites };
      case (null) { [] };
    };
  };

  // Clean up old cache entries (not used, but setup for potential cron task)
  func cleanupCache() {
    let day = 24 * 60 * 60 * 1000_000_000;
    let now = Time.now();

    let filteredEntries = stockCache.entries().filter(func((key, data)) { now - data.timestamp < day });

    stockCache.clear();
    for ((key, value) in filteredEntries) {
      stockCache.add(key, value);
    };
  };

  /// Helper function to parse extract price from JSON - to be implemented in frontend.
  func parsePrice(input : Text) : Float {
    0.0;
  };
};
