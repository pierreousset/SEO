import { redirect } from "next/navigation";
import { resolveAccountContext } from "@/lib/account-context";
import { getApiKeyStatus, saveApiKeys } from "@/lib/actions/api-keys";
import { ApiKeysForm } from "./api-keys-form";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const ctx = await resolveAccountContext();
  if (!ctx.isOwner) redirect("/dashboard");

  const status = await getApiKeyStatus(ctx.ownerId);

  return (
    <div className="px-4 md:px-9 py-7 max-w-2xl mx-auto space-y-8">
      <Breadcrumbs />
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          settings
        </p>
        <h1 className="font-display text-[40px] mt-2">API Keys</h1>
      </header>

      {/* Form card */}
      <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-6">
        <ApiKeysForm status={status} saveApiKeys={saveApiKeys} />
      </div>

      {/* Note */}
      <p className="text-sm leading-relaxed text-neutral-500">
        Your keys are encrypted at rest. When configured, your own keys are used
        instead of ours.
      </p>
    </div>
  );
}
