import { getAppUrl } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email-provider";
import { resolvePlatformNotificationFromAddress, resolvePlatformNotificationReplyTo } from "@/lib/notifications/sender";

type SendPlatformTeamInviteEmailInput = {
  recipientEmail: string;
  inviterName?: string | null;
  role: "admin" | "support";
  inviteToken: string;
  expiresAt: string;
};

export async function sendPlatformTeamInviteEmail(input: SendPlatformTeamInviteEmailInput) {
  const inviteUrl = `${getAppUrl()}/invite/${input.inviteToken}`;
  const inviterLabel = input.inviterName?.trim() || "A Myrivo administrator";
  const subject = "You're invited to join the Myrivo admin team";
  const text = [
    `${inviterLabel} invited you to join the Myrivo admin workspace as ${input.role}.`,
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
