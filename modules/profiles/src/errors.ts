// docs/12-API.md error convention: { error: { code, message, details? } },
// codes SCREAMING_SNAKE. Modules throw this; route handlers catch it and
// map to the right HTTP status — the module itself doesn't know about HTTP.
export class ModuleError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
