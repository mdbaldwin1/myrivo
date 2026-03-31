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

  test("does not render the large compliance block when readiness is clear", async () => {
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

    render(<StoreEmailSubscribersManager storeSlug="at-home-apothecary" />);

    await waitFor(() => {
      expect(screen.getByText("shopper@example.com")).toBeTruthy();
    });

    expect(screen.queryByText("Marketing send defaults")).toBeNull();
    expect(screen.queryByText("Ready to reuse")).toBeNull();
    expect(screen.queryByText(/From address:\s*no-reply@myrivo\.app/i)).toBeNull();
  });

  test("renders only compact warnings when compliance defaults are incomplete", async () => {
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
                "Add a valid mailing address before sending marketing email so the footer can include the required postal address."
              ]
            }
          }
        })
      })
    );

    render(<StoreEmailSubscribersManager storeSlug="at-home-apothecary" />);

    await waitFor(() => {
      expect(screen.getByText(/monitored support email/i)).toBeTruthy();
    });

    expect(screen.getByText(/monitored support email/i)).toBeTruthy();
    expect(screen.getByText(/add a valid mailing address before sending marketing email/i)).toBeTruthy();
    expect(screen.queryByText("Marketing send defaults")).toBeNull();
    expect(screen.queryByText("Needs attention")).toBeNull();
    expect(screen.queryByText("Update legal contact details")).toBeNull();
  });
});
