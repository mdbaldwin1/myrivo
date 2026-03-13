"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppAlert } from "@/components/ui/app-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getStorePrivacyRequestTypeLabel,
  getStorePrivacyRequestTypes,
  type StorePrivacyRequestType,
  type ResolvedStorePrivacyProfile
} from "@/lib/privacy/store-privacy";

type StorefrontPrivacyRequestFormProps = {
  storeSlug: string;
  storeName: string;
  privacyProfile: ResolvedStorePrivacyProfile | null;
};

export function StorefrontPrivacyRequestForm({
  storeSlug,
  storeName,
  privacyProfile
}: StorefrontPrivacyRequestFormProps) {
  const searchParams = useSearchParams();
  const initialType = useMemo(() => {
    const candidate = searchParams.get("type");
    return getStorePrivacyRequestTypes().includes(candidate as StorePrivacyRequestType) ? (candidate as StorePrivacyRequestType) : "access";
  }, [searchParams]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState<StorePrivacyRequestType>(initialType);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/storefront/privacy-requests?store=${encodeURIComponent(storeSlug)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          requestType,
          details
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit privacy request.");
      }

      setFullName("");
      setEmail("");
      setDetails("");
      setSuccess(
        `Your request was sent to ${storeName}. ${
          privacyProfile?.privacyRightsEmail?.trim() ? `If needed, follow up at ${privacyProfile.privacyRightsEmail}.` : ""
        }`
      );
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit privacy request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Full name" description="Optional, but helpful if the store needs to confirm your request.">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
        </FormField>
        <FormField label="Email address" description="Required so the store can respond to this request.">
          <Input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </FormField>
      </div>

      <FormField label="Request type" description="Choose the privacy-related request you want to submit.">
        <Select value={requestType} onChange={(event) => setRequestType(event.target.value as StorePrivacyRequestType)}>
          {getStorePrivacyRequestTypes().map((type) => (
            <option key={type} value={type}>
              {getStorePrivacyRequestTypeLabel(type)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Details" description="Add any context that will help the store handle your request.">
        <Textarea
          rows={6}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Tell the store what you need, any relevant order or account details, and how they should contact you."
        />
      </FormField>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Submitting..." : "Submit privacy request"}
      </Button>

      <AppAlert variant="error" compact message={error} />
      <AppAlert variant="success" compact message={success} />
    </form>
  );
}
