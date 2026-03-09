import { InviteAcceptCard } from "@/components/auth/invite-accept-card";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeInviteToken } from "@/lib/auth/invite-token";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const inviteToken = sanitizeInviteToken(token);

  if (!inviteToken) {
    return (
      <PageShell maxWidthClassName="max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Invitation Link Invalid</CardTitle>
            <CardDescription>This invite link is malformed or incomplete.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Request a new invitation link from the store owner and try again.</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <PageShell maxWidthClassName="max-w-lg">
      <InviteAcceptCard inviteToken={inviteToken} isAuthenticated={Boolean(user)} userEmail={user?.email ?? null} />
    </PageShell>
  );
}
