/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StoreEmailSubscribersManager } from "@/components/dashboard/store-email-subscribers-manager";

describe("StoreEmailSubscribersManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders marketing compliance defaults returned by the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          subscribers: [
            {
              id: "subscriber-1",
              email: "shopper@example.com",
              status: "subscribed",
              message_type: "marketing",
              source: "newsletter_footer",
              consent_source: "storefront_footer",
              consent_location: "/s/apothecary",
              consent_captured_at: "2026-03-13T00:00:00.000Z",
              suppression_reason: null,
              suppression_recorded_at: null,
              subscribed_at: "2026-03-13T00:00:00.000Z",
              unsubscribed_at: null,
              created_at: "2026-03-13T00:00:00.000Z"
            }
          ],
          summary: {
            total: 1,
            subscribed: 1,
            unsubscribed: 0,
            messageType: "marketing"
          },
          compliance: {
            messageType: "marketing",
            fromAddress: "no-reply@myrivo.app",
            fromMode: "platform_sender",
            senderDisplayName: "Apothecary",
            replyToEmail: "support@apothecary.test",
            supportEmail: "support@apothecary.test",
            unsubscribeHref: "/unsubscribe?store=apothecary",
            privacyPolicyHref: "/privacy?store=apothecary",
            privacyRequestHref: "/privacy/request?store=apothecary",
            footerAddress: "1 Madison Ave • Albany, NY 12203 • US",
            readiness: {
              status: "ready",
              warnings: []
            }
          }
        })
      })
    );

    render(<StoreEmailSubscribersManager />);

    await waitFor(() => {
      expect(screen.getByText("Marketing send defaults")).toBeTruthy();
    });

    expect(screen.getByText("Ready to reuse")).toBeTruthy();
    expect(screen.getByText(/From address:\s*no-reply@myrivo\.app/i)).toBeTruthy();
    expect(screen.getByText(/Reply-to:\s*support@apothecary\.test/i)).toBeTruthy();
    expect(screen.getByText("/unsubscribe?store=apothecary")).toBeTruthy();
    expect(screen.getByText(/1 Madison Ave/)).toBeTruthy();
  });

  test("renders warnings when compliance defaults are incomplete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          subscribers: [],
          summary: {
            total: 0,
            subscribed: 0,
            unsubscribed: 0,
            messageType: "marketing"
          },
          compliance: {
            messageType: "marketing",
            fromAddress: "no-reply@myrivo.app",
            fromMode: "platform_sender",
            senderDisplayName: "Apothecary",
            replyToEmail: null,
            supportEmail: null,
            unsubscribeHref: "/unsubscribe?store=apothecary",
            privacyPolicyHref: "/privacy?store=apothecary",
            privacyRequestHref: "/privacy/request?store=apothecary",
            footerAddress: null,
            readiness: {
              status: "attention_required",
              warnings: [
                "Add a monitored support email so marketing replies do not fall back to a generic platform address.",
                "Add a full mailing address in Store Settings so marketing email can include a footer disclosure."
              ]
            }
          }
        })
      })
    );

    render(<StoreEmailSubscribersManager />);

    await waitFor(() => {
      expect(screen.getByText("Needs attention")).toBeTruthy();
    });

    expect(screen.getByText(/monitored support email/i)).toBeTruthy();
    expect(screen.getByText(/marketing email can include a footer disclosure/i)).toBeTruthy();
    expect(screen.getByText("Update legal contact details")).toBeTruthy();
    expect(screen.getByText("Review storefront privacy links")).toBeTruthy();
  });
});
