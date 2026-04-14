"use client";

import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  async function handle() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button
      onClick={handle}
      className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
      Sign out
    </button>
  );
}
