"use client";

import type { ReactNode } from "react";
import { DashboardFormActionBar } from "@/components/dashboard/dashboard-form-action-bar";
import { getBooleanValue, getStringValue } from "@/components/dashboard/store-experience-form-utils";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import { setAtPath, useStoreExperienceSection } from "@/components/dashboard/use-store-experience-section";

type ContentWorkspaceEmailsFormProps = {
  header?: ReactNode;
};

const EMAIL_TEMPLATE_TOKENS = [
  "{orderId}",
  "{orderShortId}",
  "{storeName}",
  "{customerName}",
  "{customerFirstName}",
  "{customerLastName}",
  "{customerEmail}",
  "{supportEmail}",
  "{replyToEmail}",
  "{subtotal}",
  "{discount}",
  "{total}",
  "{promoCode}",
  "{items}",
  "{dashboardUrl}",
  "{orderUrl}",
  "{storeUrl}",
  "{fulfillmentMethod}",
  "{pickupLocationName}",
  "{pickupAddress}",
  "{pickupCityRegion}",
  "{pickupWindow}",
  "{pickupInstructions}",
  "{pickupDetails}",
  "{status}",
  "{trackingUrl}",
  "{trackingNumber}",
  "{carrier}"
] as const;

export function ContentWorkspaceEmailsForm({ header }: ContentWorkspaceEmailsFormProps) {
  const formId = "content-workspace-emails-form";
  const { loading, saving, draft, setDraft, error, isDirty, save, discard } = useStoreExperienceSection("emails");
  const newsletterCaptureEnabled = getBooleanValue(draft, "newsletterCapture.enabled", false);

  return (
    <form
      id={formId}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "discard") {
          discard();
          return;
        }
        void save();
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-4">
        {header}
        {loading ? <p className="text-sm text-muted-foreground">Loading section...</p> : null}

        <SectionCard
          title="Newsletter Capture"
          description="Configure newsletter signup visibility and the customer-facing copy shown in the storefront capture module."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              className="sm:col-span-2"
              label="Enable Newsletter Capture"
              description="Controls whether the newsletter signup module is shown in storefront experiences."
            >
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newsletterCaptureEnabled}
                  onChange={(event) =>
                    setDraft((current) => setAtPath(current, "newsletterCapture.enabled", event.target.checked))
                  }
                />
                Enabled
              </label>
            </FormField>

            {newsletterCaptureEnabled ? (
              <>
                <FormField label="Newsletter Heading" description="Headline shown above the newsletter signup form.">
                  <Input
                    value={getStringValue(draft, "newsletterCapture.heading")}
                    onChange={(event) => setDraft((current) => setAtPath(current, "newsletterCapture.heading", event.target.value))}
                  />
                </FormField>
                <FormField className="sm:col-span-2" label="Newsletter Description" description="Supporting copy encouraging signup.">
                  <Textarea
                    rows={3}
                    value={getStringValue(draft, "newsletterCapture.description")}
                    onChange={(event) =>
                      setDraft((current) => setAtPath(current, "newsletterCapture.description", event.target.value))
                    }
                  />
                </FormField>
                <FormField
                  className="sm:col-span-2"
                  label="Newsletter Success Message"
                  description="Confirmation text shown after a successful subscription."
                >
                  <Input
                    value={getStringValue(draft, "newsletterCapture.successMessage")}
                    onChange={(event) =>
                      setDraft((current) => setAtPath(current, "newsletterCapture.successMessage", event.target.value))
                    }
                  />
                </FormField>
              </>
            ) : (
              <p className="sm:col-span-2 text-sm text-muted-foreground">
                Newsletter capture is disabled. Enable it to configure heading and message copy.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Transactional Templates"
          description="Edit subject/body templates used for order lifecycle emails sent to customers and store owners."
        >
          <div className="mb-3 rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-sm font-medium">Template Variables</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use these placeholders in subject and body fields. They are replaced automatically when emails are sent.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              For private pickup workflows, include <code>{"{pickupAddress}"}</code> only in emails where you want the exact address shared.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use <code>{"{orderUrl}"}</code>, <code>{"{trackingUrl}"}</code>, and <code>{"{storeUrl}"}</code> for customer-facing links.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EMAIL_TEMPLATE_TOKENS.map((token) => (
                <code key={token} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                  {token}
                </code>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-3 rounded-md border border-border/70 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Sender Identity</p>
                <p className="text-xs text-muted-foreground">
                  Configure display name used in outgoing emails. Sender domain uses platform infrastructure.
                </p>
              </div>
              <FormField
                label="Sender Name"
                description="Displayed in recipient inboxes as the sender name (for example: At Home Apothecary)."
              >
                <Input
                  value={getStringValue(draft, "transactional.senderName")}
                  onChange={(event) => setDraft((current) => setAtPath(current, "transactional.senderName", event.target.value))}
                  placeholder="Your Store Name"
                />
              </FormField>
              <FormField
                label="Reply-To Email"
                description="Used for customer replies. Falls back to Support Email, then platform default if blank."
              >
                <Input
                  type="email"
                  value={getStringValue(draft, "transactional.replyToEmail")}
                  onChange={(event) => setDraft((current) => setAtPath(current, "transactional.replyToEmail", event.target.value))}
                  placeholder="support@yourdomain.com"
                />
              </FormField>
              <p className="text-xs text-muted-foreground">
                Tip: use a branded address and set up email forwarding in your DNS provider if you do not host inboxes directly.
              </p>
            </div>
            <div className="sm:col-span-2 space-y-3 rounded-md border border-border/70 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Customer Order Confirmation</p>
                <p className="text-xs text-muted-foreground">Sent to customers after placing an order.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Subject Template" description="Email subject line for order confirmation emails.">
                  <Input
                    value={getStringValue(draft, "transactional.customerConfirmationSubjectTemplate")}
                    onChange={(event) =>
                      setDraft((current) =>
                        setAtPath(current, "transactional.customerConfirmationSubjectTemplate", event.target.value)
                      )
                    }
                  />
                </FormField>
                <div className="hidden sm:block" aria-hidden />
                <FormField className="sm:col-span-2" label="Body Template" description="Main email body copy for order confirmation emails.">
                  <Textarea
                    rows={8}
                    value={getStringValue(draft, "transactional.customerConfirmationBodyTemplate")}
                    onChange={(event) =>
                      setDraft((current) => setAtPath(current, "transactional.customerConfirmationBodyTemplate", event.target.value))
                    }
                  />
                </FormField>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-3 rounded-md border border-border/70 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Owner New Order Alert</p>
                <p className="text-xs text-muted-foreground">Sent to store owners when a new order is created.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Subject Template" description="Email subject line for owner order alerts.">
                  <Input
                    value={getStringValue(draft, "transactional.ownerNewOrderSubjectTemplate")}
                    onChange={(event) =>
                      setDraft((current) => setAtPath(current, "transactional.ownerNewOrderSubjectTemplate", event.target.value))
                    }
                  />
                </FormField>
                <div className="hidden sm:block" aria-hidden />
                <FormField className="sm:col-span-2" label="Body Template" description="Main email body copy for owner order alerts.">
                  <Textarea
                    rows={8}
                    value={getStringValue(draft, "transactional.ownerNewOrderBodyTemplate")}
                    onChange={(event) =>
                      setDraft((current) => setAtPath(current, "transactional.ownerNewOrderBodyTemplate", event.target.value))
                    }
                  />
                </FormField>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-3 rounded-md border border-border/70 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Shipping Updates</p>
                <p className="text-xs text-muted-foreground">Templates sent during shipment and delivery status changes.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Shipped Subject Template" description="Subject line for the shipped notification email.">
                  <Input
                    value={getStringValue(draft, "transactional.shippedSubjectTemplate")}
                    onChange={(event) =>
                      setDraft((current) => setAtPath(current, "transactional.shippedSubjectTemplate", event.target.value))
                    }
                  />
                </FormField>
                <FormField label="Delivered Subject Template" description="Subject line for the delivered notification email.">
                  <Input
                    value={getStringValue(draft, "transactional.deliveredSubjectTemplate")}
                    onChange={(event) =>
                      setDraft((current) => setAtPath(current, "transactional.deliveredSubjectTemplate", event.target.value))
                    }
                  />
                </FormField>
                <FormField className="sm:col-span-2" label="Shipped Body Template" description="Body copy for shipment notification emails.">
                  <Textarea
                    rows={6}
                    value={getStringValue(draft, "transactional.shippedBodyTemplate")}
                    onChange={(event) =>
                      setDraft((current) => setAtPath(current, "transactional.shippedBodyTemplate", event.target.value))
                    }
                  />
                </FormField>
                <FormField className="sm:col-span-2" label="Delivered Body Template" description="Body copy for delivery confirmation emails.">
                  <Textarea
                    rows={6}
                    value={getStringValue(draft, "transactional.deliveredBodyTemplate")}
                    onChange={(event) =>
                      setDraft((current) => setAtPath(current, "transactional.deliveredBodyTemplate", event.target.value))
                    }
                  />
                </FormField>
              </div>
            </div>
          </div>
        </SectionCard>

      </div>
      <DashboardFormActionBar
        formId={formId}
        saveLabel="Save"
        savePendingLabel="Saving..."
        discardLabel="Discard"
        savePending={saving}
        saveDisabled={!isDirty || saving || loading}
        discardDisabled={!isDirty || saving || loading}
        statusMessage={error}
        statusVariant="error"
      />
    </form>
  );
}
