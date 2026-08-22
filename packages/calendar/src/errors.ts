// Same shape as modules/profiles/src/errors.ts — docs/12-API.md error
// convention: { error: { code, message, details? } }, codes SCREAMING_SNAKE.
// Small enough to duplicate per package rather than force a cross-package
// dependency for a 10-line class.
export class ModuleError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
