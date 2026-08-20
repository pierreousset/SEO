"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryAdsImport } from "@/lib/actions/ads";

export function RetryAdsImportButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await retryAdsImport();
          setPending(false);
          if (!res.ok) {
            setError(res.error ?? "import_failed");
            return;
          }
          router.refresh();
        }}
        className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-button-black text-canvas-white text-sm shadow-button disabled:opacity-50"
      >
        {pending ? "…" : label}
      </button>
      {error && <p className="text-caption text-hot-pink">{error}</p>}
    </div>
  );
}
