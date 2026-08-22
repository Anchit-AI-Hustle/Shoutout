import { NextResponse } from 'next/server';

// Shared error → HTTP mapping for the { code, message, details? } convention
// (docs/12-API.md), duck-typed rather than instanceof-checked so every
// module's own local ModuleError class (each package defines its own —
// see modules/gigs/src/errors.ts) works here without a cross-package
// dependency just for a type check.
interface CodedError {
  code: string;
  message: string;
  details?: unknown;
}

function isCodedError(error: unknown): error is CodedError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

// docs/12-API.md's error code table, plus the Gigs-specific codes this
// module introduces (DATE_ALREADY_CONFIRMED, HOLD_EXPIRED). Anything not
// listed here falls through to 500 — a genuinely unexpected failure should
// look like one, not get silently mapped to a client-error status.
const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  FORBIDDEN: 403,
  NO_ACTIVE_ORG: 403,
  UNAUTHENTICATED: 401,
  INVALID_TRANSITION: 409,
  DATE_ALREADY_CONFIRMED: 409,
  HOLD_EXPIRED: 409,
  ALREADY_CONFIRMED: 409,
  INSUFFICIENT_INDEX_DATA: 200,
  RATE_LIMITED: 429,
};

export function moduleErrorResponse(error: unknown) {
  if (isCodedError(error)) {
    const status = STATUS_BY_CODE[error.code] ?? 500;
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status },
    );
  }
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: 'Something went wrong' } },
    { status: 500 },
  );
}
