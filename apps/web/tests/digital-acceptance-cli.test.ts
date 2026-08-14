/* eslint-disable @typescript-eslint/no-explicit-any -- signing helper preserves deliberately mutable artifact order */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyDigitalAcceptanceArtifact } from "@/lib/digital-products/acceptance-evidence";
import { buildDigitalAcceptanceEvidenceFixture, requiredDigitalAcceptanceScenarios } from "./fixtures/digital-acceptance-evidence";

function sign(evidence: any, key: string) {
  const unsigned = structuredClone(evidence);
  delete unsigned.signature;
  return { ...unsigned, signature: createHmac("sha256", key).update(JSON.stringify(unsigned)).digest("hex") };
}

describe("digital acceptance CLI artifact verification", () => {
  const key = "evidence-signing-key-that-is-longer-than-32-characters";
  const now = Date.parse("2026-08-13T12:30:00.000Z");

  it("accepts a freshly signed full release artifact", () => {
    expect(verifyDigitalAcceptanceArtifact(sign(buildDigitalAcceptanceEvidenceFixture(), key), { key, now, requiredScenarios: [...requiredDigitalAcceptanceScenarios] }).observations).toHaveLength(12);
  });

  it("rejects a tampered signature and stale completion", () => {
    const valid = sign(buildDigitalAcceptanceEvidenceFixture(), key);
    expect(() => verifyDigitalAcceptanceArtifact({ ...valid, releaseVersion: "tampered" }, { key, now, requiredScenarios: [...requiredDigitalAcceptanceScenarios] })).toThrow(/signature/i);
    const stale = buildDigitalAcceptanceEvidenceFixture();
    stale.completedAt = "2026-08-13T10:00:00.000Z";
    expect(() => verifyDigitalAcceptanceArtifact(sign(stale, key), { key, now, requiredScenarios: [...requiredDigitalAcceptanceScenarios] })).toThrow(/stale/i);
  });
});
