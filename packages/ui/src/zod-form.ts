import { z } from 'zod';

// Walks a registry attributeSchema (docs/04-SHOUT-TYPES.md) and produces a
// simple field descriptor ShoutComposer can render generically — the form
// is genuinely driven by the registry's Zod schema, not a hardcoded field
// list per type.
export type FieldKind = 'string' | 'number' | 'boolean' | 'string[]' | 'enum';

export interface FieldDescriptor {
  key: string;
  kind: FieldKind;
  optional: boolean;
  options?: string[]; // for 'enum'
}

function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; optional: boolean } {
  if (schema instanceof z.ZodOptional) {
    return { inner: schema._def.innerType, optional: true };
  }
  return { inner: schema, optional: false };
}

export function describeAttributeSchema(schema: z.ZodTypeAny): FieldDescriptor[] {
  if (!(schema instanceof z.ZodObject)) return [];

  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const fields: FieldDescriptor[] = [];

  for (const [key, rawField] of Object.entries(shape)) {
    const { inner, optional } = unwrap(rawField);

    if (inner instanceof z.ZodString) {
      fields.push({ key, kind: 'string', optional });
    } else if (inner instanceof z.ZodNumber) {
      fields.push({ key, kind: 'number', optional });
    } else if (inner instanceof z.ZodBoolean) {
      fields.push({ key, kind: 'boolean', optional });
    } else if (inner instanceof z.ZodEnum) {
      fields.push({ key, kind: 'enum', optional, options: inner.options as string[] });
    } else if (inner instanceof z.ZodArray) {
      const element = inner.element as z.ZodTypeAny;
      if (element instanceof z.ZodString) {
        fields.push({ key, kind: 'string[]', optional });
      }
      // Non-string array elements aren't rendered generically — none exist
      // in the current registry (docs/04-SHOUT-TYPES.md), so this is a
      // stated gap, not silently dropped data.
    }
    // Unrecognized field shapes are skipped, not guessed at.
  }

  return fields;
}
