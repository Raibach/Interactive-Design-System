// @vitest-environment node

import { describe, expect, it } from "vitest";

import { costFormatter } from "@/src/utils/numbers";

describe("costFormatter", () => {
  // HOUSE PATCH (2026-10-09, owner-approved): costFormatter now formats with up to
  // 6 decimals (the app's own usdFormatter default). It used to round to exactly 2,
  // which printed sub-half-cent costs — every deepseek-flash call — as "$0.00".
  // These expectations were updated WITH the patch; revert both together.
  it("formats dashboard costs with up to 6 decimals", () => {
    expect(costFormatter(4.402973)).toBe("$4.402973");
    expect(costFormatter(0.068415)).toBe("$0.068415");
    expect(costFormatter(0.015427)).toBe("$0.015427");
    expect(costFormatter(0)).toBe("$0.00");
  });
});
