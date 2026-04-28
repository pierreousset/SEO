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
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <Breadcrumbs />
      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          settings
        </p>
        <h1 className="text-2xl font-semibold text-white">API Keys</h1>
      </div>

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
