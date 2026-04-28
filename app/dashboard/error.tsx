"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center px-8 py-20">
      <div className="bg-card rounded-2xl p-8 max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--down)]/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-[var(--down)]" />
        </div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {error.message || "An unexpected error occurred."}
        </p>
        <Button onClick={reset} className="mt-6" size="sm">
          Try again
        </Button>
      </div>
    </div>
  );
}
