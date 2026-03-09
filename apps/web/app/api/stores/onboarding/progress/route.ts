import { NextRequest, NextResponse } from "next/server";
import { getStoreOnboardingProgressForStore } from "@/lib/stores/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim().toLowerCase() ?? "";
  if (!slug) {
    return NextResponse.json({ error: "Missing store slug." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const progress = await getStoreOnboardingProgressForStore(user.id, slug);
  if (!progress) {
    return NextResponse.json({ error: "Store onboarding status not found." }, { status: 404 });
  }

  return NextResponse.json({ progress });
}
