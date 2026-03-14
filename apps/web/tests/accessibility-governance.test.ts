import { describe, expect, test } from "vitest";
import {
  ACCESSIBILITY_CONFORMANCE_NOTE,
  ACCESSIBILITY_EVIDENCE_MATRIX,
  ACCESSIBILITY_HIGH_PRIORITY_BLOCKERS,
  ACCESSIBILITY_PROGRAM_OWNERSHIP,
  ACCESSIBILITY_RELEASE_GATES,
  ACCESSIBILITY_TARGET_FLOWS
} from "@/lib/accessibility-governance";

describe("accessibility governance constants", () => {
  test("keeps target flows and release gates defined for the program", () => {
    expect(ACCESSIBILITY_TARGET_FLOWS).toContain("cart and checkout completion");
    expect(ACCESSIBILITY_RELEASE_GATES).toContain("verify keyboard access and visible focus on changed controls");
    expect(ACCESSIBILITY_HIGH_PRIORITY_BLOCKERS).toContain("authentication or account access is blocked");
  });

  test("keeps ownership expectations grouped by discipline", () => {
    expect(ACCESSIBILITY_PROGRAM_OWNERSHIP.engineering.length).toBeGreaterThan(0);
    expect(ACCESSIBILITY_PROGRAM_OWNERSHIP.productAndDesign.length).toBeGreaterThan(0);
    expect(ACCESSIBILITY_PROGRAM_OWNERSHIP.supportAndOps.length).toBeGreaterThan(0);
  });

  test("keeps an evidence matrix and restrained conformance note", () => {
    expect(ACCESSIBILITY_EVIDENCE_MATRIX.length).toBeGreaterThan(0);
    expect(ACCESSIBILITY_EVIDENCE_MATRIX[0]?.evidence.length).toBeGreaterThan(0);
    expect(ACCESSIBILITY_CONFORMANCE_NOTE).toContain("not making a formal WCAG conformance claim");
  });
});
