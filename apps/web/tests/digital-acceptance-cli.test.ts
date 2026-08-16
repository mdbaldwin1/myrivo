/* eslint-disable @typescript-eslint/no-explicit-any -- signing helper preserves deliberately mutable artifact order */
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalAcceptanceEvidenceJson, verifyDigitalAcceptanceArtifact } from "@/lib/digital-products/acceptance-evidence";
import { buildDigitalAcceptanceEvidenceFixture, requiredDigitalAcceptanceScenarios } from "./fixtures/digital-acceptance-evidence";

function sign(evidence: any, key: string) {
  const unsigned = structuredClone(evidence);
  delete unsigned.signature;
  return { ...unsigned, signature: createHmac("sha256", key).update(canonicalAcceptanceEvidenceJson(unsigned)).digest("hex") };
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

  it("runs the actual CLI for a valid full fixture and rejects signed semantic and signature mutations", () => {
    const directory = mkdtempSync(join(tmpdir(), "myrivo-digital-cli-"));
    try {
      const npmPath = join(directory, "npm");
      const fixturePath = join(directory, "fixture.json");
      const evidencePath = join(directory, "evidence.json");
      writeFileSync(npmPath, "#!/bin/sh\nexit 0\n");
      chmodSync(npmPath, 0o755);
      const evidence: any = buildDigitalAcceptanceEvidenceFixture();
      const completedAt = new Date().toISOString();
      evidence.startedAt = new Date(Date.now() - 10_000).toISOString();
      evidence.completedAt = completedAt;
      evidence.origin = "http://127.0.0.1:3456";
      evidence.releaseVersion = "sha";
      const scenario = (name: string) => evidence.observations.find((record: any) => record.scenario === name);
      const fixture = {
        baseUrl: evidence.origin, runId: evidence.runId, controlSecret: "control-secret-that-is-longer-than-thirty-two-characters",
        customer: { email: "buyer@example.test" }, routes: {}, orderId: scenario("replacement").subjectId,
        financialOrders: {
          partialRefund: scenario("stripe-partial-refund").subjectId, fullRefund: scenario("stripe-full-refund").subjectId,
          disputeOpened: scenario("stripe-dispute-opened").subjectId, disputeWon: scenario("stripe-dispute-won").subjectId,
          disputeLost: scenario("stripe-dispute-lost").subjectId,
        },
      };
      writeFileSync(fixturePath, JSON.stringify(fixture));
      const env = {
        ...process.env, PATH: `${directory}:${process.env.PATH ?? ""}`, MYRIVO_DIGITAL_ACCEPTANCE_FIXTURE: fixturePath,
        MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_OUTPUT: evidencePath, MYRIVO_DIGITAL_ACCEPTANCE_EVIDENCE_HMAC_KEY: key,
        MYRIVO_DIGITAL_ACCEPTANCE_REDACTION_KEY: "redaction-key-that-is-longer-than-thirty-two-characters",
        STRIPE_SECRET_KEY: "sk_test_acceptance", STRIPE_WEBHOOK_SECRET: "whsec_acceptance", RESEND_API_KEY: "re_acceptance",
        MYRIVO_DIGITAL_TEST_RECIPIENT: "buyer@example.test", STRIPE_STUB_MODE: "false", GITHUB_SHA: "sha",
        MYRIVO_STRIPE_DISPUTE_HELPER_URL: "https://helper.example.test/disputes", MYRIVO_STRIPE_DISPUTE_HELPER_ORIGIN: "https://helper.example.test",
        MYRIVO_STRIPE_DISPUTE_HELPER_TOKEN: "helper-token", MYRIVO_STRIPE_DISPUTE_HELPER_SIGNING_KEY: "helper-signing-key",
      };
      const run = (artifact: any) => {
        writeFileSync(evidencePath, JSON.stringify(artifact));
        return spawnSync(process.execPath, [resolve(process.cwd(), "../../scripts/verify-digital-products-acceptance.mjs")], { env, encoding: "utf8" });
      };
      const valid = run(sign(evidence, key));
      expect(valid.status, valid.stderr).toBe(0);
      expect(valid.stdout).toContain("Validated current-run acceptance evidence");
      const semanticMutation = structuredClone(evidence);
      semanticMutation.observations.find((record: any) => record.scenario === "delivery-retry").observation.notifications.find((notification: any) => notification.provider_message_id === "email_retry").status = "failed";
      expect(run(sign(semanticMutation, key)).status).not.toBe(0);
      for (const mutate of [
        (record: any) => { record.providerEvidence.sixthDeniedStatus = 401; },
        (record: any) => { record.providerEvidence.sixthDeniedStatus = 403; },
        (record: any) => { record.providerEvidence.sixthDeniedStatus = 404; },
        (record: any) => { record.providerEvidence.sixthDeniedStatus = 429; },
        (record: any) => { record.providerEvidence.sixthDeniedCode = "download_unavailable"; },
        (record: any) => { record.providerEvidence.sixthDeniedMessage = "Download unavailable."; },
      ]) {
        const denialMutation = structuredClone(evidence);
        mutate(denialMutation.observations.find((record: any) => record.scenario === "five-grants"));
        expect(run(sign(denialMutation, key)).status).not.toBe(0);
      }
      expect(run({ ...sign(evidence, key), signature: "0".repeat(64) }).status).not.toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
