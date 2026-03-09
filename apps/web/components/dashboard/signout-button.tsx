"use client";

import { Button } from "@/components/ui/button";

export function SignoutButton() {
  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <Button type="button" variant="outline" className="w-full justify-start" onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}
