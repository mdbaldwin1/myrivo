export type LegalUpdateContentInput = {
  documentTitle: string;
  documentKey: string;
  versionLabel: string;
  effectiveAt: string | null;
  actionUrl: string;
};

export type LegalUpdateContent = {
  title: string;
  body: string;
  emailSubject: string;
  emailText: string;
};

export function buildLegalUpdateContent(input: LegalUpdateContentInput): LegalUpdateContent {
  const effectiveAtLabel = input.effectiveAt ? new Date(input.effectiveAt).toLocaleString() : "immediately";
  const title = `Legal update: ${input.documentTitle} ${input.versionLabel}`;
  const body = `${input.documentTitle} has a published update (${input.versionLabel}) effective ${effectiveAtLabel}. Review and accept the latest version.`;
  const emailSubject = `[Myrivo] ${input.documentTitle} update (${input.versionLabel})`;
  const emailText = [
    `A legal update is now available for ${input.documentTitle}.`,
    `Version: ${input.versionLabel}`,
    `Effective: ${effectiveAtLabel}`,
    "",
    `Review and accept the update here: ${input.actionUrl}`,
    "",
    "This notice was sent because your account may be affected by required legal updates."
  ].join("\n");

  return { title, body, emailSubject, emailText };
}
