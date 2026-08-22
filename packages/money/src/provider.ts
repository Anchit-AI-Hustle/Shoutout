import type { LedgerLine } from './ledger';

// CLAUDE.md rule 6: "SHOUTOUT never holds customer funds. Use the payment
// aggregator's split-settlement product. packages/money is
// provider-agnostic behind an interface."
//
// Everything vendor-shaped lives behind this one interface. Razorpay Route
// and Cashfree Easy Split differ in payload and vocabulary but not in
// shape: register a payee, instruct a split, receive a webhook. Nothing
// above this layer knows which is configured.

export interface PayeeRegistration {
  orgId: string;
  legalName: string;
  /** Masked for logging; the full value never enters this process. */
  accountLast4: string;
  ifsc: string;
  panLast4: string;
}

export interface SplitInstruction {
  settlementId: string;
  grossPaise: bigint;
  lines: LedgerLine[];
  idempotencyKey: string;
}

export interface SplitResult {
  providerRef: string;
  status: 'accepted' | 'rejected';
  failureReason?: string;
}

export interface PayoutStatus {
  providerRef: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'returned';
  failureReason?: string;
}

export interface SettlementProvider {
  readonly name: string;
  registerPayee(registration: PayeeRegistration): Promise<{ contactRef: string }>;
  /** Penny-drop: the aggregator deposits ₹1 to prove the account resolves. */
  verifyAccount(contactRef: string): Promise<{ verified: boolean; failureReason?: string }>;
  instructSplit(instruction: SplitInstruction): Promise<SplitResult>;
  getPayoutStatus(providerRef: string): Promise<PayoutStatus>;
}

/**
 * Fails loudly instead of pretending to move money.
 *
 * No aggregator account exists yet (PA onboarding is a multi-week process
 * that cannot start from code). Rather than let a silent no-op look like a
 * successful payout — the worst possible failure mode in a money path —
 * every method throws, and the settlement stays in `draft` where it is
 * visibly incomplete. Swap this for a real adapter and nothing above
 * changes.
 */
export class UnconfiguredProvider implements SettlementProvider {
  readonly name = 'unconfigured';

  private fail(operation: string): never {
    throw new Error(
      `PROVIDER_NOT_CONFIGURED: cannot ${operation} — no payment aggregator is configured. ` +
        'Set SETTLEMENT_PROVIDER and its credentials once PA onboarding completes.',
    );
  }

  registerPayee(): Promise<{ contactRef: string }> {
    this.fail('register a payee');
  }
  verifyAccount(): Promise<{ verified: boolean; failureReason?: string }> {
    this.fail('verify an account');
  }
  instructSplit(): Promise<SplitResult> {
    this.fail('instruct a split');
  }
  getPayoutStatus(): Promise<PayoutStatus> {
    this.fail('read payout status');
  }
}

export function resolveProvider(name?: string): SettlementProvider {
  switch (name) {
    // Real adapters land here — the call sites above never change.
    case undefined:
    case '':
    case 'unconfigured':
      return new UnconfiguredProvider();
    default:
      throw new Error(`UNKNOWN_PROVIDER: ${name}`);
  }
}
