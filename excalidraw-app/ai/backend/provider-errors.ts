/**
 * AI Provider Error Hierarchy & Classification
 *
 * Distinguishes recoverable schema/DSL errors (eligible for at most 1 repair turn)
 * from non-recoverable operational failures (timeouts, auth errors, rate limits,
 * network failures) which MUST fail fast immediately without retrying.
 */

export type ProviderErrorCode =
  | "AUTHENTICATION_ERROR"
  | "AUTH_FAILED"
  | "RATE_LIMIT"
  | "PROVIDER_CAPACITY"
  | "CREDIT_CAPACITY_EXCEEDED"
  | "PROVIDER_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "STRUCTURED_OUTPUT_ERROR"
  | "SCHEMA_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN_PROVIDER_ERROR"
  | "UNKNOWN_ERROR";

export interface ProviderErrorDetails {
  code: ProviderErrorCode;
  statusCode?: number;
  retryable: boolean;
  providerId?: string;
  details?: unknown;
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly providerId?: string;
  readonly details?: unknown;

  constructor(message: string, info: ProviderErrorDetails) {
    super(message);
    this.name = "ProviderError";
    this.code = info.code;
    this.statusCode = info.statusCode ?? 500;
    this.retryable = info.retryable;
    this.providerId = info.providerId;
    this.details = info.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(timeoutMs: number, providerId: string = "provider") {
    super(
      `${providerId} request timed out after ${Math.round(timeoutMs / 1000)}s.`,
      {
        code: "TIMEOUT",
        statusCode: 408,
        retryable: false,
        providerId,
        details: { timeoutMs },
      },
    );
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderAuthenticationError extends ProviderError {
  constructor(message: string, providerId: string = "provider") {
    super(message, {
      code: "AUTH_FAILED",
      statusCode: 401,
      retryable: false,
      providerId,
    });
    this.name = "ProviderAuthenticationError";
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(message: string, providerId: string = "provider") {
    super(message, {
      code: "RATE_LIMIT",
      statusCode: 429,
      retryable: false,
      providerId,
    });
    this.name = "ProviderRateLimitError";
  }
}

export class ProviderNetworkError extends ProviderError {
  constructor(message: string, providerId: string = "provider") {
    super(message, {
      code: "NETWORK_ERROR",
      statusCode: 503,
      retryable: false,
      providerId,
    });
    this.name = "ProviderNetworkError";
  }
}

export class ProviderSchemaError extends ProviderError {
  readonly validationErrors: readonly string[];

  constructor(
    message: string,
    validationErrors: readonly string[] = [],
    providerId: string = "provider",
  ) {
    super(message, {
      code: "SCHEMA_ERROR",
      statusCode: 502,
      retryable: true,
      providerId,
      details: { validationErrors },
    });
    this.name = "ProviderSchemaError";
    this.validationErrors = validationErrors;
  }
}

export interface CreditCapacityDetails {
  requestedTokens?: number;
  availableTokens?: number;
  limitSource?: string;
}

export class ProviderCreditCapacityError extends ProviderError {
  readonly requestedTokens?: number;
  readonly availableTokens?: number;

  constructor(
    message: string,
    details?: CreditCapacityDetails,
    providerId: string = "provider",
  ) {
    super(message, {
      code: "CREDIT_CAPACITY_EXCEEDED",
      statusCode: 402,
      retryable: false,
      providerId,
      details,
    });
    this.name = "ProviderCreditCapacityError";
    this.requestedTokens = details?.requestedTokens;
    this.availableTokens = details?.availableTokens;
  }
}
