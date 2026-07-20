export { fetchBars, fetchQuote } from './marketDataService'
export { saveJournal, loadJournal, clearJournal } from './journalService'
export {
  analyzeChartScreenshot,
  imageToBase64,
  formatAnalysisAsMarkdown,
} from './chartAnalysisService'
export { analyzeCoaching } from './coachingService'
export type { MistakeFrequency, CoachingRecommendation, CoachingAnalysis } from './coachingService'

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

export type {
  ChartAnalysisRequest,
  ChartAnalysisResult,
  CandleAnalysis,
  TrendAnalysis,
  PriceLevel,
  IndicatorAnalysis,
  VolumeAnalysis,
  PatternAnalysis,
} from './chartAnalysisService'

