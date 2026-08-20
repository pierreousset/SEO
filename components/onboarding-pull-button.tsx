"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { triggerGscHistoryPull } from "@/lib/actions/keywords";

export function OnboardingPullButton({ label }: { label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const res = (await triggerGscHistoryPull(90)) as {
              error?: string;
              cappedDays?: number;
            };
            if (res?.error) {
              toast.error(res.error);
              return;
            }
            toast.success("Chargement GSC lancé.");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Échec du chargement GSC");
          }
        })
      }
      className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-hairline text-sm text-ink-black disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}
