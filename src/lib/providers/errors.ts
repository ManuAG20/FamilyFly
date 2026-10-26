export type ProviderErrorCode =
  | "config"
  | "auth"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "invalid_response";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: ProviderErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ProviderError";
  }
}
