import { describe, expect, it } from "vitest";

import {
  precallRunIdempotencyKey,
  precallSendIdempotencyKey,
  precallSlotIdempotencyKey,
} from "./precall-sequence.js";

describe("pre-call idempotency keys", () => {
  const sequenceId =
    "precall:booking-123:2026-08-14T18:00:00.000Z:precall-v1";

  it("uses one stable run key for every trigger of a sequence", () => {
    expect(precallRunIdempotencyKey(sequenceId)).toBe(
      `precall-run:${sequenceId}`,
    );
  });

  it("uses one stable wait key per sequence module", () => {
    expect(precallSlotIdempotencyKey(sequenceId, "confirmation")).toBe(
      `precall-slot:${sequenceId}:confirmation`,
    );
  });

  it("uses one stable transport key per sequence module", () => {
    expect(precallSendIdempotencyKey(sequenceId, "confirmation")).toBe(
      `precall-send:${sequenceId}:confirmation`,
    );
  });
});
