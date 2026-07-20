// ─── Base error ───────────────────────────────────────────────────────────────

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'MarketDataError'
  }
}

// ─── Specialised subclasses ────────────────────────────────────────────────────

/** HTTP request failed or returned a non-2xx status. */
export class NetworkError extends MarketDataError {
  constructor(
    providerId: string,
    public readonly status: number,
    public readonly url: string,
    cause?: unknown,
  ) {
    super(`[${providerId}] HTTP ${status} from ${url}`, providerId, cause)
    this.name = 'NetworkError'
  }
}

/** Response was received but could not be parsed into the expected shape. */
export class ParseError extends MarketDataError {
  constructor(providerId: string, detail: string, cause?: unknown) {
    super(`[${providerId}] Parse error: ${detail}`, providerId, cause)
    this.name = 'ParseError'
  }
}

/** Authentication failed (missing/invalid API key or token). */
export class AuthError extends MarketDataError {
  constructor(providerId: string, detail?: string) {
    super(`[${providerId}] Authentication failed${detail ? ': ' + detail : ''}`, providerId)
    this.name = 'AuthError'
  }
}

/** Provider rate limit exceeded. */
export class RateLimitError extends MarketDataError {
  constructor(providerId: string, public readonly retryAfterSeconds?: number) {
    super(
      `[${providerId}] Rate limit exceeded${retryAfterSeconds ? ` — retry after ${retryAfterSeconds}s` : ''}`,
      providerId,
    )
    this.name = 'RateLimitError'
  }
}

/** Requested symbol was not found on the provider. */
export class SymbolNotFoundError extends MarketDataError {
  constructor(providerId: string, symbol: string) {
    super(`[${providerId}] Symbol not found: ${symbol}`, providerId)
    this.name = 'SymbolNotFoundError'
  }
}
