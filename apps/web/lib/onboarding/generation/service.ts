import { getServerEnv } from "@/lib/env";
import { applyOnboardingStarterPackage } from "@/lib/onboarding/generation/apply";
import { onboardingGenerationInputSchema, type OnboardingGenerationInput, type OnboardingGenerationProviderResult } from "@/lib/onboarding/generation/contracts";
import { generateDeterministicOnboardingStarterPackage } from "@/lib/onboarding/generation/deterministic-provider";
import { generateOpenAiOnboardingStarterPackage } from "@/lib/onboarding/generation/openai-provider";
import { createOnboardingGenerationRun, updateOnboardingGenerationRun } from "@/lib/onboarding/generation-runs";
import { updateOnboardingSession, type OnboardingSessionBundle } from "@/lib/onboarding/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ProductRow = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  seo_title: string | null;
  seo_description: string | null;
  image_alt_text: string | null;
};

type RunOnboardingGenerationInput = {
  bundle: OnboardingSessionBundle;
  ownerUserId: string;
  ownerEmail: string | null;
};

function sanitizeGeneratedPlaceholderText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  if (/is being prepared during onboarding\.?$/i.test(trimmed)) {
    return "";
  }

  return trimmed;
}

function resolvePreferredProvider() {
  const env = getServerEnv();
  const configuredProvider = env.MYRIVO_ONBOARDING_AI_PROVIDER?.trim();

  if (configuredProvider === "openai" && env.OPENAI_API_KEY?.trim()) {
    return { provider: "openai", model: env.MYRIVO_ONBOARDING_AI_MODEL?.trim() || "gpt-5-mini" } as const;
  }

  if (configuredProvider !== "openai" && env.OPENAI_API_KEY?.trim()) {
    return { provider: "openai", model: env.MYRIVO_ONBOARDING_AI_MODEL?.trim() || "gpt-5-mini" } as const;
  }

  return { provider: "deterministic", model: "deterministic-v1" } as const;
}

async function loadFirstProduct(storeId: string, productId: string | null) {
  if (!productId) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("id,title,description,price_cents,seo_title,seo_description,image_alt_text")
    .eq("store_id", storeId)
    .eq("id", productId)
    .maybeSingle<ProductRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function buildOnboardingGenerationInput(input: RunOnboardingGenerationInput): Promise<OnboardingGenerationInput> {
  const firstProduct = await loadFirstProduct(input.bundle.store.id, input.bundle.session.first_product_id ?? null);

  return onboardingGenerationInputSchema.parse({
    sessionId: input.bundle.session.id,
    storeId: input.bundle.store.id,
    ownerUserId: input.ownerUserId,
    ownerEmail: input.ownerEmail,
    store: input.bundle.store,
    answers: input.bundle.answers,
    firstProduct: firstProduct
      ? {
          id: firstProduct.id,
          title: firstProduct.title,
          description: sanitizeGeneratedPlaceholderText(firstProduct.description),
          priceCents: firstProduct.price_cents,
          seoTitle: firstProduct.seo_title,
          seoDescription: sanitizeGeneratedPlaceholderText(firstProduct.seo_description),
          imageAltText: firstProduct.image_alt_text
        }
      : null
  });
}

export async function generateOnboardingStarterPackage(input: OnboardingGenerationInput): Promise<OnboardingGenerationProviderResult> {
  const preferred = resolvePreferredProvider();

  if (preferred.provider === "openai") {
    try {
      return await generateOpenAiOnboardingStarterPackage(input);
    } catch {
      return generateDeterministicOnboardingStarterPackage(input);
    }
  }

  return generateDeterministicOnboardingStarterPackage(input);
}

export async function runOnboardingGeneration(input: RunOnboardingGenerationInput) {
  const generationInput = await buildOnboardingGenerationInput(input);
  const preferred = resolvePreferredProvider();
  const run = await createOnboardingGenerationRun({
    storeId: generationInput.storeId,
    sessionId: generationInput.sessionId,
    provider: preferred.provider,
    model: preferred.model,
    inputJson: generationInput as unknown as Record<string, unknown>
  });

  await updateOnboardingSession({
    sessionId: generationInput.sessionId,
    storeId: generationInput.storeId,
    status: "generation_running",
    currentStep: "review",
    lastCompletedStep: "review",
    generationRequestedAt: new Date().toISOString(),
    generationCompletedAt: null,
    generationFailedAt: null,
    generationErrorCode: null,
    generationErrorMessage: null
  });

  try {
    const generated = await generateOnboardingStarterPackage(generationInput);
    const appliedSnapshot = await applyOnboardingStarterPackage({
      generationInput,
      starterPackage: generated.output
    });

    await updateOnboardingGenerationRun({
      runId: run.id,
      status: "succeeded",
      outputJson: generated.output as unknown as Record<string, unknown>,
      appliedSnapshotJson: appliedSnapshot as Record<string, unknown>
    });

    await updateOnboardingSession({
      sessionId: generationInput.sessionId,
      storeId: generationInput.storeId,
      status: "reveal_ready",
      currentStep: "review",
      lastCompletedStep: "review",
      generationCompletedAt: new Date().toISOString(),
      generationFailedAt: null,
      generationErrorCode: null,
      generationErrorMessage: null
    });

    return {
      runId: run.id,
      provider: generated.provider,
      model: generated.model,
      appliedSnapshot
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the onboarding starter package.";

    await updateOnboardingGenerationRun({
      runId: run.id,
      status: "failed",
      errorCode: "onboarding_generation_failed",
      errorMessage: message
    });

    await updateOnboardingSession({
      sessionId: generationInput.sessionId,
      storeId: generationInput.storeId,
      status: "generation_failed",
      currentStep: "review",
      lastCompletedStep: "review",
      generationFailedAt: new Date().toISOString(),
      generationErrorCode: "onboarding_generation_failed",
      generationErrorMessage: message
    });

    throw error;
  }
}
