export { fetchBars, fetchQuote } from './marketDataService'
export { saveJournal, loadJournal, clearJournal } from './journalService'

// Market data service layer — adapters, types, errors
export {
  // Service & factory
  MarketDataService,
  createAdapter,
  createServiceFromEnv,
  // Adapters
  PolygonAdapter,
  AlpacaAdapter,
  TradovateAdapter,
  BinanceAdapter,
  YahooAdapter,
  // Errors
  MarketDataError,
  NetworkError,
  ParseError,
  AuthError,
  RateLimitError,
  SymbolNotFoundError,
} from './marketData'

export type {
  IMarketDataAdapter,
  ProviderId,
  ProviderConfig,
  FetchBarsParams,
  QuoteData,
  PolygonConfig,
  AlpacaConfig,
  TradovateConfig,
  BinanceConfig,
  YahooConfig,
} from './marketData'

