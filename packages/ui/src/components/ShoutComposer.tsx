'use client';

import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { CompModel, ShoutType, ShoutTypeConfig } from '@shoutout/shout-types';
import { describeAttributeSchema } from '../zod-form';
import type { FieldDescriptor } from '../zod-form';

// "Type-aware, driven entirely by the registry. One slot by default; 'add
// another' is secondary. Never render an empty second slot."
// (docs/06-DESIGN-SYSTEM.md)
//
// Genuinely registry-driven: slot roles, comp models, and every attribute
// field come from `config` (packages/shout-types), not a hardcoded list —
// this component doesn't know what "collab" or "gig" mean.

export interface SlotDraft {
  role: string;
  compModel: CompModel;
  attributes: Record<string, unknown>;
}

export interface ShoutDraft {
  title: string;
  city: string;
  deadline: string;
  visibility: 'open' | 'invite' | 'roster' | 'verified';
  slots: SlotDraft[];
}

export interface ShoutComposerProps {
  type: ShoutType;
  config: ShoutTypeConfig;
  onSubmit: (draft: ShoutDraft) => void | Promise<void>;
  submitting?: boolean;
}

function defaultSlot(config: ShoutTypeConfig): SlotDraft {
  const fields = describeAttributeSchema(config.attributeSchema);
  const attributes: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.kind === 'string[]') attributes[field.key] = [];
    else if (field.kind === 'boolean') attributes[field.key] = false;
  }
  return {
    role: config.slotRoles[0] ?? '',
    compModel: config.compModels[0] ?? 'fee',
    attributes,
  };
}

const inputClass =
  'w-full min-h-11 rounded-md border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-trust';
const labelClass = 'text-sm text-ink-soft';

function AttributeField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.kind === 'enum') {
    return (
      <select
        className={inputClass}
        value={(value as string) ?? ''}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select {field.key}
        </option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <input
        type="checkbox"
        className="h-5 w-5"
        checked={Boolean(value)}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
    );
  }

  if (field.kind === 'number') {
    return (
      <input
        type="number"
        className={inputClass}
        value={(value as number) ?? ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
      />
    );
  }

  if (field.kind === 'string[]') {
    const arr = (value as string[]) ?? [];
    return (
      <input
        type="text"
        className={inputClass}
        placeholder="comma separated"
        value={arr.join(', ')}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(
            e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    );
  }

  return (
    <input
      type="text"
      className={inputClass}
      value={(value as string) ?? ''}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}

function SlotForm({
  config,
  slot,
  onChange,
  onRemove,
  removable,
}: {
  config: ShoutTypeConfig;
  slot: SlotDraft;
  onChange: (slot: SlotDraft) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const fields = describeAttributeSchema(config.attributeSchema);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>Role</label>
          <select
            className={inputClass}
            value={slot.role}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onChange({ ...slot, role: e.target.value })
            }
          >
            {config.slotRoles.map((role) => (
              <option key={role} value={role}>
                {role.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={labelClass}>Comp model</label>
          <select
            className={inputClass}
            value={slot.compModel}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onChange({ ...slot, compModel: e.target.value as CompModel })
            }
          >
            {config.compModels.map((cm) => (
              <option key={cm} value={cm}>
                {cm}
              </option>
            ))}
          </select>
        </div>
      </div>

      {fields.map((field) => (
        <div key={field.key}>
          <label className={labelClass}>{field.key.replace(/([A-Z])/g, ' $1')}</label>
          <AttributeField
            field={field}
            value={slot.attributes[field.key]}
            onChange={(value) =>
              onChange({ ...slot, attributes: { ...slot.attributes, [field.key]: value } })
            }
          />
        </div>
      ))}

      {removable ? (
        <button
          type="button"
          onClick={onRemove}
          className="self-start text-sm text-ink-soft underline"
        >
          Remove slot
        </button>
      ) : null}
    </div>
  );
}

export function ShoutComposer({ type: _type, config, onSubmit, submitting }: ShoutComposerProps) {
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [deadline, setDeadline] = useState('');
  const [visibility, setVisibility] = useState<ShoutDraft['visibility']>('open');
  // One slot by default — never an empty second slot.
  const [slots, setSlots] = useState<SlotDraft[]>([defaultSlot(config)]);

  const canAddSlot = slots.length < config.maxSlots;
  const canRemoveSlot = slots.length > config.minSlots;

  function addSlot() {
    if (!canAddSlot) return;
    setSlots([...slots, defaultSlot(config)]);
  }

  function updateSlot(index: number, next: SlotDraft) {
    setSlots(slots.map((s, i) => (i === index ? next : s)));
  }

  function removeSlot(index: number) {
    setSlots(slots.filter((_, i) => i !== index));
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({ title, city, deadline, visibility, slots });
      }}
    >
      <div>
        <label className={labelClass}>Title</label>
        <input
          className={inputClass}
          value={title}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>City</label>
          <input
            className={inputClass}
            value={city}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>Deadline</label>
          <input
            type="date"
            className={inputClass}
            value={deadline}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDeadline(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Visibility</label>
        <select
          className={inputClass}
          value={visibility}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setVisibility(e.target.value as ShoutDraft['visibility'])
          }
        >
          <option value="open">Open — anyone can discover it</option>
          <option value="invite">Invite only</option>
          <option value="roster">Roster only</option>
          <option value="verified">Verified artists only</option>
        </select>
      </div>

      {slots.map((slot, i) => (
        <SlotForm
          key={i}
          config={config}
          slot={slot}
          onChange={(next) => updateSlot(i, next)}
          onRemove={() => removeSlot(i)}
          removable={canRemoveSlot}
        />
      ))}

      {canAddSlot ? (
        <button
          type="button"
          onClick={addSlot}
          className="min-h-11 self-start rounded-md border border-line px-4 text-sm text-ink-soft"
        >
          + Add another slot
        </button>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50"
      >
        {submitting ? 'Putting out your shout…' : 'Put out a shout'}
      </button>
    </form>
  );
}
