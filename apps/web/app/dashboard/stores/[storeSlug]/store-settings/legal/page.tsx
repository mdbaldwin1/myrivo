import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { StoreLegalDocumentsForm } from "@/components/dashboard/store-legal-documents-form";
import { StorePrivacyRequestsPanel } from "@/components/dashboard/store-privacy-requests-panel";
import { getOwnedStoreBundleForSlug } from "@/lib/stores/owner-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ storeSlug: string }> };

export default async function StoreWorkspaceLegalSettingsPage({ params }: PageProps) {
  const { storeSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundle = await getOwnedStoreBundleForSlug(user.id, storeSlug, "admin");
  if (!bundle) {
    return null;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <StoreLegalDocumentsForm
          header={
            <DashboardPageHeader
              title="Legal"
              description="Formal Privacy Policy and Terms & Conditions belong in Store Settings, separate from the storefront policy summaries."
            />
          }
        />
        <div className="border-t border-border/60 bg-muted/10 p-3">
          <StorePrivacyRequestsPanel />
        </div>
      </div>
    </section>
  );
}
