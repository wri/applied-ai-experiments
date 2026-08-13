// =============================================================================
// Authoring a ReplaySession from a recorded run — with mandatory secret scrubbing.
// =============================================================================
//
// Replay fixtures are committed to a public repo, so this is where we make sure
// no credential rides along. The API key is never structurally captured (runLLM
// builds InspectableRequest only from call options; the auth header is added at
// fetch time and never recorded), so this is defense-in-depth against a key that
// was *accidentally* typed into a prompt, echoed back in an error string, or
// stuffed into the demo's arbitrary config blob.
//
// Two layers:
//   1. stripSecrets() — drop any property whose NAME looks like a credential.
//   2. deepRedact()   — redact any key-SHAPED string value (sk-ant-…, AIza…, …)
//                       that name-matching can't catch.
// =============================================================================

import type { RunRecord } from '../types';
import { stripSecrets } from '../export/share-config';
import type { ReplaySession, ReplayCall } from './replay.svelte';

/** Known provider key shapes. Specific (hyphenated) variants first. */
const KEY_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g, // Anthropic
  /sk-or-v1-[A-Za-z0-9]{20,}/g, // OpenRouter
  /sk-proj-[A-Za-z0-9_-]{20,}/g, // OpenAI project keys
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI classic
  /AIza[A-Za-z0-9_-]{30,}/g, // Google
  /hf_[A-Za-z0-9]{20,}/g, // Hugging Face
  /\bBearer\s+[A-Za-z0-9._-]{20,}/gi, // generic bearer token
];

function redactString(input: string): { value: string; count: number } {
  let count = 0;
  let out = input;
  for (const re of KEY_PATTERNS) {
    out = out.replace(re, () => {
      count++;
      return '[redacted]';
    });
  }
  return { value: out, count };
}

/** Recursively redact key-shaped substrings from every string in a value. */
function deepRedact(value: unknown): { value: unknown; count: number } {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) {
    let count = 0;
    const arr = value.map((v) => {
      const r = deepRedact(v);
      count += r.count;
      return r.value;
    });
    return { value: arr, count };
  }
  if (value !== null && typeof value === 'object') {
    let count = 0;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const r = deepRedact(v);
      count += r.count;
      out[k] = r.value;
    }
    return { value: out, count };
  }
  return { value, count: 0 };
}

export interface ReplaySessionMeta {
  title?: string;
  description?: string;
}

export interface RecordToReplayResult {
  session: ReplaySession;
  /** Number of key-shaped values redacted. Non-zero → maintainer should review. */
  redactions: number;
}

/**
 * Convert a persisted RunRecord into a committable ReplaySession: zip the
 * parallel requests[]/responses[] into paired calls[], copy the config blob, and
 * scrub secrets. Warns on missing labels (those calls match by sequence only).
 */
export function recordToReplaySession(
  record: RunRecord,
  meta: ReplaySessionMeta = {}
): RecordToReplayResult {
  const n = Math.min(record.requests.length, record.responses.length);
  if (record.requests.length !== record.responses.length) {
    console.warn(
      `[replay] record ${record.id} has ${record.requests.length} requests but ` +
        `${record.responses.length} responses; pairing the first ${n}.`
    );
  }

  const calls: ReplayCall[] = [];
  for (let i = 0; i < n; i++) {
    const request = record.requests[i];
    if (!request.label) {
      console.warn(
        `[replay] call ${i} in record ${record.id} has no label; replay will match it by sequence only.`
      );
    }
    calls.push({ label: request.label, request, response: record.responses[i] });
  }

  const rawSession: ReplaySession = {
    experiment: record.experiment,
    title: meta.title,
    description: meta.description,
    recordedAt: record.createdAt,
    config: record.config,
    calls,
  };

  const nameScrubbed = stripSecrets(rawSession);
  const { value, count } = deepRedact(nameScrubbed);
  return { session: value as ReplaySession, redactions: count };
}
