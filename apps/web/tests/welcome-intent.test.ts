import { describe, expect, test } from "vitest";
import { resolveWelcomeIntent, withWelcomeIntent } from "@/lib/auth/welcome-intent";

describe("welcome intent helpers", () => {
  test("reads a valid welcome intent from profile metadata", () => {
    expect(resolveWelcomeIntent({ welcome_intent: "shop" })).toBe("shop");
    expect(resolveWelcomeIntent({ welcome_intent: "sell" })).toBe("sell");
  });

  test("ignores invalid metadata values", () => {
    expect(resolveWelcomeIntent(null)).toBeNull();
    expect(resolveWelcomeIntent({ welcome_intent: "maybe" })).toBeNull();
  });

  test("merges welcome intent into existing metadata", () => {
    expect(withWelcomeIntent({ account_preferences: { weeklyDigestEmails: true } }, "sell")).toEqual({
      account_preferences: { weeklyDigestEmails: true },
      welcome_intent: "sell"
    });
  });
});
