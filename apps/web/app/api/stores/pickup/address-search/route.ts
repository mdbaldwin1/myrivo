import { NextRequest, NextResponse } from "next/server";
import { requireStoreRole } from "@/lib/auth/authorization";
import { searchPickupAddressSuggestions } from "@/lib/pickup/geocode";

export async function GET(request: NextRequest) {
  const auth = await requireStoreRole("staff", request.nextUrl.searchParams.get("storeSlug"));
  if (auth.response) {
    return auth.response;
  }
  if (!auth.context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (query.length < 4) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await searchPickupAddressSuggestions({
    query,
    city: request.nextUrl.searchParams.get("city"),
    stateRegion: request.nextUrl.searchParams.get("stateRegion"),
    postalCode: request.nextUrl.searchParams.get("postalCode"),
    countryCode: request.nextUrl.searchParams.get("countryCode")
  });

  return NextResponse.json({ suggestions });
}
