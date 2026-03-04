import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { PageShell } from "@/components/layout/page-shell";
import { isPublicSignupAllowed } from "@/lib/auth/owner-access";

export default function SignupPage() {
  if (!isPublicSignupAllowed()) {
    redirect("/login");
  }

  return (
    <PageShell maxWidthClassName="max-w-lg">
      <SignupForm />
    </PageShell>
  );
}
