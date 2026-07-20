// Batch indicator functions
export {
  calcSMA, calcEMA, calcVWAP, calcRSI, calcMACD,
  calcATR, calcADX, calcBollingerBands, calcVolumeProfile, calcAnchoredVWAP,
} from './indicators'

// Indicator output types
export type {
  IndicatorPoint,
  MACDPoint,
  BollingerPoint,
  ADXPoint,
  VolumeProfileLevel,
  VolumeProfileResult,
  EngineResults,
  EngineOptions,
} from './indicatorTypes'

// Incremental calculators
export {
  IncEMA, IncSMA, IncVWAP, IncRSI, IncMACD,
  IncATR, IncADX, IncBollingerBands, IncAnchoredVWAP,
  IndicatorEngine,
  useIndicatorEngine,
} from './indicatorEngine'

// Support & resistance detector
export {
  detectSupportResistance,
} from './analysis'

export type {
  SRTouch,
  SRScore,
  SRLevel,
  SROptions,
} from './analysis'

// Other lib utilities
export { generateSampleData } from './sampleData'

// Market structure analyzer (hook lives in src/hooks/useMarketStructure.ts)
export { analyzeMarketStructure } from './marketStructure'

export type {
  SwingKind,
  SwingLabel,
  SwingPoint,
  MarketTrend,
  MarketBias,
  TrendLineKind,
  TrendLineResult,
  StructureBreak,
  StructureScores,
  MarketStructureResult,
  MarketStructureOptions,
} from './marketStructure'

// Chart pattern recognition
export { detectChartPatterns } from './chartPatterns'

export type {
  PatternCategory,
  PatternType,
  PatternGeometry,
  PatternLevel,
  LevelTouch,
  PatternDetectionOptions,
  PatternDetectionResult,
  PatternEngineResults,
  PatternScores,
} from './patternTypes'

// Smart Money Concepts detection
export { detectSMCZones } from './smc'

export type {
  SMCZoneType,
  SMCZone,
  SMCDetectionOptions,
  SMCDetectionResults,
  LiquiditySweep,
  FairValueGap,
  OrderBlock,
  MarketStructureShift,
  ChangeOfCharacter,
  PremiumZone,
  DiscountZone,
  EqualHighs,
  EqualLows,
  ZoneBias,
  MitigationStatus,
  SMCScores,
} from './smcTypes'

// Scalping strategy engine
export { analyzeScalpingStrategy, analyzeScalpingSignal } from './scalping'

export type {
  ScalpingSignal,
  TrendDirection,
  EMAAlignment,
  VWAPAnalysis,
  VolumeAnalysis,
  ATRFilter,
  TrendFilter,
  MomentumFilter,
  PriceStructure,
  SignalComponent,
  ScalpingSignalResult,
  ScalpingEngineOptions,
  ScalpingEngineResults,
} from './scalpingTypes'

// Probability engine
export { calculateProbability, analyzeProbability } from './probability'

export type {
  TradeGrade,
  ProbabilityDirection,
  TrendInput,
  VolumeInput,
  MomentumInput,
  SupportResistanceInput,
  ATRInput,
  RSIInput,
  VWAPInput,
  EMAAlignmentInput,
  MarketStructureInput,
  ProbabilityFactors,
  ComponentScore,
  ProbabilityResult,
  ProbabilityEngineOptions,
  ProbabilityEngineResults,
} from './probabilityTypes'

// Setup rating engine
export { rateSetup, analyzeSetup } from './setupRating'

export type {
  SetupGrade,
  SetupRating,
  SetupExplanation,
  SetupMetrics,
  SetupComponent,
  SetupResult,
  SetupRatingOptions,
  SetupRatingResults,
} from './setupRatingTypes'
