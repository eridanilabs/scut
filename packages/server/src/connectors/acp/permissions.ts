import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@agentclientprotocol/sdk';
import { normalizeToolKey } from '../../db/ReplicantPermissionRepo.js';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Derive `tool` and `sessionId` from an SDK permission request. Tool
 * preference order matches the CBK reference:
 *   rawInput.kind (string) -> toolCall.kind -> 'unknown'.
 *
 * Per spec sec 7.7 the derived tool is normalized via
 * ReplicantPermissionRepo.normalizeToolKey so it round-trips with
 * keys stored by the admin permissions endpoints
 * (lower-cased, whitespace -> '/', collapsed and trimmed). The
 * 'unknown' sentinel survives normalization unchanged.
 */
export function permissionDetailFromParams(
  params: RequestPermissionRequest
): { tool: string; sessionId: string | null } {
  const rawInput = asRecord(params.toolCall.rawInput);
  const derived =
    typeof rawInput?.kind === 'string' && rawInput.kind.trim() !== ''
      ? rawInput.kind
      : typeof params.toolCall.kind === 'string' && params.toolCall.kind.trim() !== ''
        ? params.toolCall.kind
        : 'unknown';
  const normalized = normalizeToolKey(derived);
  return {
    tool: normalized === '' ? 'unknown' : normalized,
    sessionId: params.sessionId ?? null,
  };
}

/**
 * Map a stored allow/deny decision to an ACP RequestPermissionResponse.
 * Selects the first option whose `kind` matches the decision (in
 * preferred order: allow_once before allow_always; reject_once before
 * reject_always). If no matching option exists, returns the cancelled
 * outcome.
 */
export function mapStoredDecisionToAcpResponse(
  decision: 'allow' | 'deny',
  params: RequestPermissionRequest
): RequestPermissionResponse {
  const preferred =
    decision === 'allow'
      ? (['allow_once', 'allow_always'] as const)
      : (['reject_once', 'reject_always'] as const);

  for (const kind of preferred) {
    const option = params.options.find((candidate) => candidate.kind === kind);
    if (option) {
      return {
        outcome: { outcome: 'selected', optionId: option.optionId },
      };
    }
  }
  return { outcome: { outcome: 'cancelled' } };
}
