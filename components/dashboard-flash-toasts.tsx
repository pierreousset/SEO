"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { retryAdsImport } from "@/lib/actions/ads";

export type FlashToast = {
  type: "success" | "warning" | "error";
  message: string;
  action?: "apicenter" | "retry-ads";
  actionLabel?: string;
};

export function DashboardFlashToasts({ flashes }: { flashes: FlashToast[] }) {
  const router = useRouter();
  const once = useRef(false);

  useEffect(() => {
    if (once.current || flashes.length === 0) return;
    once.current = true;

    for (const flash of flashes) {
      const action =
        flash.action === "apicenter"
          ? {
              label: flash.actionLabel ?? "API Center",
              onClick: () =>
                window.open("https://ads.google.com/aw/apicenter", "_blank", "noopener"),
            }
          : flash.action === "retry-ads"
            ? {
                label: flash.actionLabel ?? "Retry",
                onClick: () => {
                  void retryAdsImport().then((res) => {
                    if (res.ok) {
                      toast.success("OK");
                      router.refresh();
                    } else {
                      toast.error(res.error ?? "import_failed");
                    }
                  });
                },
              }
            : undefined;

      const opts = { duration: 8000, action };
      if (flash.type === "success") toast.success(flash.message, opts);
      else if (flash.type === "warning") toast.warning(flash.message, opts);
      else toast.error(flash.message, opts);
    }

    router.replace("/dashboard", { scroll: false });
  }, [flashes, router]);

  return null;
}
