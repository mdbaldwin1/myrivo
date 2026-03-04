import { BrandingSettingsForm } from "@/components/dashboard/branding-settings-form";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { Button } from "@/components/ui/button";
import { getOwnedStoreBundle } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardStoreSettingsBrandingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundle(user.id);
  if (!bundle) {
    return null;
  }

  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Branding"
        description="Global design tokens and storefront structural styling."
        action={
          <div className="flex items-center gap-2">
            <Button type="submit" form="branding-form" name="intent" value="discard" variant="outline">
              Discard
            </Button>
            <Button type="submit" form="branding-form" name="intent" value="save">
              Save
            </Button>
          </div>
        }
      />
      <BrandingSettingsForm initialBranding={bundle.branding} />
    </section>
  );
}

