// Search + ranking — one engine, weighted per use case (docs/02-ARCHITECTURE.md
// ADR-002). Pure scoring functions only; each module owns its own DB reads.
export * from './shortlist';
export * from './attribute-fit';
