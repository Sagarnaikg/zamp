import { HTTP_STATUS } from "@/server/constants";
import { ERROR_STATES } from "@/constants";

/**
 * One error type for every failed request, so components branch on a typed
 * field instead of parsing messages. The server already returns a human
 * sentence in `{ error }` (decisions.md §18) — that text is preserved and
 * shown; the generic copy here is only the fallback when there isn't one.
 */
export enum ApiErrorKind {
  Network = "network",
  NotFound = "not_found",
  Validation = "validation",
  Conflict = "conflict",
  Server = "server",
  Unknown = "unknown",
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }

  /** Whether retrying the same request unchanged could plausibly succeed. */
  get retryable(): boolean {
    return this.kind === ApiErrorKind.Network || this.kind === ApiErrorKind.Server;
  }
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === HTTP_STATUS.notFound) return ApiErrorKind.NotFound;
  if (status === HTTP_STATUS.conflict) return ApiErrorKind.Conflict;
  if (status === HTTP_STATUS.badRequest) return ApiErrorKind.Validation;
  if (status >= HTTP_STATUS.serverErrorFloor) return ApiErrorKind.Server;
  return ApiErrorKind.Unknown;
}

export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const kind = kindFromStatus(status);
  const serverMessage =
    typeof body === "object" && body !== null && "error" in body
      ? String((body as { error: unknown }).error)
      : "";
  return new ApiError(kind, serverMessage || ERROR_STATES.generic.body, status);
}

export function networkError(): ApiError {
  return new ApiError(ApiErrorKind.Network, ERROR_STATES.network.body, null);
}
