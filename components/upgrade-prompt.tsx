import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradePrompt({
  feature,
  description,
}: {
  feature: string;
  description: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 text-center max-w-md mx-auto">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{feature}</h3>
      <p className="text-sm text-muted-foreground mt-2">{description}</p>
      <Link href="/dashboard/billing">
        <Button className="mt-4" size="sm">
          Upgrade to Pro
        </Button>
      </Link>
    </div>
  );
}
