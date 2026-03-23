import { getExternalAppUrl } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email-provider";
import { resolvePlatformNotificationFromAddress, resolvePlatformNotificationReplyTo } from "@/lib/notifications/sender";

type SendStoreMembershipInviteEmailInput = {
  recipientEmail: string;
  storeName: string;
  inviterName?: string | null;
  role: "admin" | "staff";
  inviteToken: string;
  expiresAt: string;
};

export async function sendStoreMembershipInviteEmail(input: SendStoreMembershipInviteEmailInput) {
  const inviteUrl = `${getExternalAppUrl()}/invite/${input.inviteToken}`;
  const inviterLabel = input.inviterName?.trim() || "A store administrator";
  const subject = `You're invited to join ${input.storeName} on Myrivo`;
  const text = [
    `${inviterLabel} invited you to join ${input.storeName} on Myrivo as ${input.role}.`,
    "",
    `Accept invite: ${inviteUrl}`,
    `This invite expires on ${new Date(input.expiresAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    })}.`,
    "",
    "If you weren't expecting this invitation, you can ignore this email."
  ].join("\n");

  return sendTransactionalEmail({
    from: resolvePlatformNotificationFromAddress(),
    to: [input.recipientEmail],
    subject,
    text,
    replyTo: resolvePlatformNotificationReplyTo()
  });
}
