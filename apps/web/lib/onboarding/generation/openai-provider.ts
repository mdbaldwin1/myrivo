import { getServerEnv } from "@/lib/env";
import { generateDeterministicOnboardingStarterPackage } from "@/lib/onboarding/generation/deterministic-provider";
import { onboardingStarterPackageSchema, type OnboardingGenerationInput, type OnboardingGenerationProviderResult } from "@/lib/onboarding/generation/contracts";

type OpenAiResponsesApiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const forbiddenCustomerFacingPhrases = [
  "storefront preview",
  "preview-ready",
  "now taking shape",
  "first polished storefront draft",
  "first storefront draft",
  "first version",
  "draft",
  "draft ready",
  "starter package",
  "behind the scenes",
  "studio",
  "catalog",
  "reveal",
  "onboarding",
  "launch prep"
];

function buildSourceSummary(input: OnboardingGenerationInput) {
  const firstProduct = input.firstProduct;

  return {
    storeName: input.store.name,
    storeSlug: input.store.slug,
    roughStoreDescription: input.answers.storeProfile.description || "(none provided)",
    visualDirection: input.answers.branding.visualDirection ?? "ai_choice",
    hasLogo: Boolean(input.answers.branding.logoAssetPath),
    firstProduct: firstProduct
      ? {
          title: firstProduct.title,
          priceCents: firstProduct.priceCents,
          roughDescription: firstProduct.description || "(none provided)"
        }
      : null
  };
}

export function buildSystemPrompt() {
  return [
    "You generate the first polished storefront package for a brand-new ecommerce store.",
    "Return JSON only. Do not wrap the response in markdown fences.",
    "Stay grounded in the provided inputs. Do not invent regulated claims, sourcing claims, certifications, guarantees, or legal policy language.",
    "You may draft merchant-facing storefront, support, checkout, welcome-popup, and email copy.",
    "Do not author a privacy policy or terms and conditions body.",
    "Treat merchant-written descriptions as rough notes, not final copy. Clean them up, preserve concrete business facts, and ignore filler, awkward phrasing, or obvious joke copy unless it clearly defines the brand.",
    "Write public-facing copy as if the storefront were already live. Do not mention onboarding, preview, reveal, generation, starter package, launch prep, drafts, templates, the system, Myrivo, Studio, or Catalog.",
    "Do not describe the site as a first version or something that will be refined later.",
    "Make the copy sound like the store itself, not a SaaS product building a store.",
    "Use specific retail language for the actual category suggested by the inputs. If the store is about bait, tackle, fishing, worms, or outdoor gear, sound like that world instead of generic ecommerce language.",
    "Keep hero copy concise and shopper-facing. Avoid repeating long product descriptions verbatim in the hero.",
    "Content blocks should help a shopper understand the store and products, not the software or setup process.",
    "Transactional emails must stay concise and operational. Do not paste long product marketing prose into order confirmations or owner notifications.",
    "Welcome and signup copy should focus on products, offers, and reasons to subscribe, not vague launch-update language unless the store description clearly suggests prelaunch messaging.",
    "Keep copy optimistic, polished, and specific, but avoid sounding exaggerated, generic, or luxury-parody unless the merchant explicitly wants that tone.",
    "Every field in the requested JSON shape must be present.",
    "When unsure, prefer tasteful defaults over empty strings."
  ].join(" ");
}

export function buildUserPrompt(input: OnboardingGenerationInput) {
  const sourceSummary = buildSourceSummary(input);

  return [
    "Build the initial storefront starter package for this store.",
    "Your job is to turn rough onboarding notes into believable shopper-facing content and defaults.",
    "Preserve the merchant's chosen visual direction when one is present.",
    "If a logo is present, favor layouts that show it confidently.",
    "Use the store description and first product as source material, but rewrite them into cleaner, more natural copy.",
    "Do not echo awkward source text verbatim when you can improve it.",
    "Do not use internal product language like preview, reveal, setup, onboarding, Studio, Catalog, system, or platform in any customer-facing field.",
    "Field guidance:",
    "- hero and homepage content blocks: shopper-facing, category-specific, concrete, not meta",
    "- about page: explain what the store sells and its point of view in natural language",
    "- policies/support copy: practical and reassuring, not legalistic or generic SaaS copy",
    "- welcome popup and email capture: focus on products, updates, and offers customers would actually care about",
    "- transactional emails: brief, operational, and calm",
    "- owner new order email: operational only; never include long marketing paragraphs",
    "- footer tagline/note: brand-facing and customer-facing; never mention drafts or first versions",
    "",
    "Normalized source summary:",
    JSON.stringify(sourceSummary, null, 2),
    "",
    "Full onboarding payload:",
    JSON.stringify(input, null, 2)
  ].join("\n");
}

function extractOutputText(response: OpenAiResponsesApiResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  for (const outputItem of response.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (typeof contentItem.text === "string" && contentItem.text.trim()) {
        return contentItem.text;
      }
    }
  }

  return null;
}

function hasForbiddenPhrase(value: string) {
  const normalized = value.toLowerCase();
  return forbiddenCustomerFacingPhrases.some((phrase) => normalized.includes(phrase));
}

function shouldReplaceWithFallback(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    hasForbiddenPhrase(normalized) ||
    normalized.includes(" is shaping ") ||
    normalized.includes(" to keep improving") ||
    normalized.includes(" feels polished now") ||
    normalized.includes("easy to refine") ||
    normalized.includes("what the store is building") ||
    normalized.includes("why this first version matters") ||
    normalized.includes("product one included") ||
    normalized.includes("signature direction")
  );
}

export function sanitizeOpenAiStarterPackage(input: OnboardingGenerationInput, output: OnboardingGenerationProviderResult["output"]) {
  const fallback = generateDeterministicOnboardingStarterPackage(input).output;
  const sanitized = structuredClone(output);
  const fallbackContentBlock = fallback.home.contentBlocks[fallback.home.contentBlocks.length - 1];
  const fallbackAboutParagraph = fallback.about.articleParagraphs[fallback.about.articleParagraphs.length - 1];
  const fallbackAboutSection = fallback.about.sections[fallback.about.sections.length - 1];
  const fallbackWelcomeParagraph = fallback.emails.welcomeDiscount.bodyParagraphs[fallback.emails.welcomeDiscount.bodyParagraphs.length - 1];
  const fallbackOwnerParagraph = fallback.emails.ownerNewOrder.bodyParagraphs[fallback.emails.ownerNewOrder.bodyParagraphs.length - 1];

  if (shouldReplaceWithFallback(sanitized.home.hero.eyebrow)) {
    sanitized.home.hero.eyebrow = fallback.home.hero.eyebrow;
  }
  if (shouldReplaceWithFallback(sanitized.home.hero.headline)) {
    sanitized.home.hero.headline = fallback.home.hero.headline;
  }
  if (shouldReplaceWithFallback(sanitized.home.hero.subcopy)) {
    sanitized.home.hero.subcopy = fallback.home.hero.subcopy;
  }
  if (shouldReplaceWithFallback(sanitized.home.hero.badgeOne)) {
    sanitized.home.hero.badgeOne = fallback.home.hero.badgeOne;
  }
  if (shouldReplaceWithFallback(sanitized.home.hero.badgeTwo)) {
    sanitized.home.hero.badgeTwo = fallback.home.hero.badgeTwo;
  }
  if (shouldReplaceWithFallback(sanitized.home.hero.badgeThree)) {
    sanitized.home.hero.badgeThree = fallback.home.hero.badgeThree;
  }

  sanitized.home.contentBlocks = sanitized.home.contentBlocks.map((block, index) => {
    const fallbackBlock = fallback.home.contentBlocks[index] ?? fallbackContentBlock ?? block;
    return {
      ...block,
      eyebrow: shouldReplaceWithFallback(block.eyebrow) ? fallbackBlock.eyebrow : block.eyebrow,
      title: shouldReplaceWithFallback(block.title) ? fallbackBlock.title : block.title,
      body: shouldReplaceWithFallback(block.body) ? fallbackBlock.body : block.body
    };
  });

  sanitized.about.articleParagraphs = sanitized.about.articleParagraphs.map((paragraph, index) => {
    const replacement = fallback.about.articleParagraphs[index] ?? fallbackAboutParagraph ?? paragraph;
    return shouldReplaceWithFallback(paragraph) ? replacement : paragraph;
  });

  sanitized.about.sections = sanitized.about.sections.map((section, index) => {
    const fallbackSection = fallback.about.sections[index] ?? fallbackAboutSection ?? section;
    return {
      ...section,
      title: shouldReplaceWithFallback(section.title) ? fallbackSection.title : section.title,
      body: shouldReplaceWithFallback(section.body) ? fallbackSection.body : section.body
    };
  });

  if (shouldReplaceWithFallback(sanitized.settings.announcement)) {
    sanitized.settings.announcement = fallback.settings.announcement;
  }
  if (shouldReplaceWithFallback(sanitized.settings.footerNote)) {
    sanitized.settings.footerNote = fallback.settings.footerNote;
  }
  if (shouldReplaceWithFallback(sanitized.settings.emailCaptureDescription)) {
    sanitized.settings.emailCaptureDescription = fallback.settings.emailCaptureDescription;
  }
  if (shouldReplaceWithFallback(sanitized.settings.welcomePopupBody)) {
    sanitized.settings.welcomePopupBody = fallback.settings.welcomePopupBody;
  }

  sanitized.emails.welcomeDiscount.bodyParagraphs = sanitized.emails.welcomeDiscount.bodyParagraphs
    .map((paragraph, index) => {
      const replacement = fallback.emails.welcomeDiscount.bodyParagraphs[index] ?? fallbackWelcomeParagraph ?? paragraph;
      return shouldReplaceWithFallback(paragraph) ? replacement : paragraph;
    })
    .filter((paragraph): paragraph is string => Boolean(paragraph));

  sanitized.emails.ownerNewOrder.bodyParagraphs = sanitized.emails.ownerNewOrder.bodyParagraphs
    .map((paragraph, index) => {
      const replacement = fallback.emails.ownerNewOrder.bodyParagraphs[index] ?? fallbackOwnerParagraph ?? paragraph;
      return shouldReplaceWithFallback(paragraph) ? replacement : paragraph;
    })
    .filter((paragraph): paragraph is string => Boolean(paragraph));

  if (shouldReplaceWithFallback(sanitized.branding.theme.heroEyebrow)) {
    sanitized.branding.theme.heroEyebrow = fallback.branding.theme.heroEyebrow;
  }
  if (shouldReplaceWithFallback(sanitized.branding.theme.heroHeadline)) {
    sanitized.branding.theme.heroHeadline = fallback.branding.theme.heroHeadline;
  }
  if (shouldReplaceWithFallback(sanitized.branding.theme.heroSubcopy)) {
    sanitized.branding.theme.heroSubcopy = fallback.branding.theme.heroSubcopy;
  }
  if (shouldReplaceWithFallback(sanitized.branding.theme.heroBadgeOne)) {
    sanitized.branding.theme.heroBadgeOne = fallback.branding.theme.heroBadgeOne;
  }
  if (shouldReplaceWithFallback(sanitized.branding.theme.heroBadgeTwo)) {
    sanitized.branding.theme.heroBadgeTwo = fallback.branding.theme.heroBadgeTwo;
  }
  if (shouldReplaceWithFallback(sanitized.branding.theme.heroBadgeThree)) {
    sanitized.branding.theme.heroBadgeThree = fallback.branding.theme.heroBadgeThree;
  }

  if (input.answers.branding.visualDirection === "ai_choice") {
    sanitized.branding.primaryColor = fallback.branding.primaryColor;
    sanitized.branding.accentColor = fallback.branding.accentColor;
    sanitized.branding.theme.backgroundColor = fallback.branding.theme.backgroundColor;
    sanitized.branding.theme.surfaceColor = fallback.branding.theme.surfaceColor;
    sanitized.branding.theme.textColor = fallback.branding.theme.textColor;
    sanitized.branding.theme.headerBackgroundColor = fallback.branding.theme.headerBackgroundColor;
    sanitized.branding.theme.headerForegroundColor = fallback.branding.theme.headerForegroundColor;
  }

  return sanitized;
}

export async function generateOpenAiOnboardingStarterPackage(
  input: OnboardingGenerationInput
): Promise<OnboardingGenerationProviderResult> {
  const env = getServerEnv();
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = env.MYRIVO_ONBOARDING_AI_MODEL?.trim() || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildSystemPrompt() }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: buildUserPrompt(input) }]
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI onboarding generation failed: ${response.status} ${body}`.slice(0, 600));
  }

  const payload = (await response.json()) as OpenAiResponsesApiResponse;
  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI onboarding generation returned no text output.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(outputText);
  } catch (error) {
    throw new Error(error instanceof Error ? `Unable to parse OpenAI onboarding JSON: ${error.message}` : "Unable to parse OpenAI onboarding JSON.");
  }

  const parsed = onboardingStarterPackageSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`OpenAI onboarding output did not match the starter package schema: ${parsed.error.issues[0]?.message ?? "unknown validation error"}`);
  }

  const sanitizedOutput = sanitizeOpenAiStarterPackage(input, parsed.data);

  return {
    provider: "openai",
    model,
    output: sanitizedOutput
  };
}
