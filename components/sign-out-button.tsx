"use client";

import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();
  async function handle() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={handle}
      className="inline-flex items-center gap-1.5 text-caption text-ash-gray hover:text-ink-black transition-colors"
    >
      <LogOut className="size-3.5" strokeWidth={1.5} />
      {label}
    </button>
  );
}
