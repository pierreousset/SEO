"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  startProCheckout,
  startProAnnualCheckout,
  startCreditsCheckout,
  openBillingPortal,
  updateAutoRefill,
} from "@/lib/actions/billing";
import { toast } from "sonner";

export function SubscribeButton({ label = "Upgrade to Pro" }: { label?: string }) {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      try {
        const { url } = await startProCheckout();
        window.location.href = url;
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't start checkout");
      }
    });
  }
  return (
    <Button onClick={onClick} disabled={pending} size="lg">
      {pending ? "Loading…" : label}
    </Button>
  );
}

export function BuyCreditsButton({
  priceId,
  label,
  variant = "outline",
  disabled: disabledProp,
}: {
  priceId: string;
  label: string;
  variant?: "default" | "outline";
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      try {
        const { url } = await startCreditsCheckout(priceId);
        window.location.href = url;
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't start checkout");
      }
    });
  }
  return (
    <Button
      onClick={onClick}
      disabled={pending || !priceId || disabledProp}
      variant={variant}
      size="sm"
    >
      {pending ? "Loading…" : disabledProp ? "Pro only" : label}
    </Button>
  );
}

export function SubscribeAnnualButton({ label = "Upgrade to Pro — 150€/yr" }: { label?: string }) {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      try {
        const { url } = await startProAnnualCheckout();
        window.location.href = url;
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't start checkout");
      }
    });
  }
  return (
    <Button onClick={onClick} disabled={pending} size="lg">
      {pending ? "Loading…" : label}
    </Button>
  );
}

export function PlanToggle({
  billing,
  onToggle,
}: {
  billing: "monthly" | "annual";
  onToggle: (v: "monthly" | "annual") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full bg-muted p-1 text-xs">
      <button
        type="button"
        onClick={() => onToggle("monthly")}
        className={`rounded-full px-3 py-1 font-medium transition-colors ${
          billing === "monthly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onToggle("annual")}
        className={`rounded-full px-3 py-1 font-medium transition-colors ${
          billing === "annual"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        Annual
        <span className="ml-1 text-[var(--up)]">save 2mo</span>
      </button>
    </div>
  );
}

export function ProPlanCard() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  return (
    <div className="space-y-4">
      <PlanToggle billing={billing} onToggle={setBilling} />
      <div className="mt-2 flex items-baseline gap-2">
        {billing === "monthly" ? (
          <>
            <span className="font-display text-5xl">15&euro;</span>
            <span className="text-muted-foreground">/mois</span>
          </>
        ) : (
          <>
            <span className="font-display text-5xl">150&euro;</span>
            <span className="text-muted-foreground">/an</span>
            <span className="text-xs text-[var(--up)] ml-2">save 30&euro;</span>
          </>
        )}
      </div>
      <div className="mt-6">
        {billing === "monthly" ? (
          <SubscribeButton />
        ) : (
          <SubscribeAnnualButton />
        )}
      </div>
    </div>
  );
}

export function AutoRefillForm({
  initialEnabled,
  initialThreshold,
  initialPackPriceId,
  creditPacks,
}: {
  initialEnabled: boolean;
  initialThreshold: number;
  initialPackPriceId: string | null;
  creditPacks: Array<{ label: string; priceId: string }>;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [threshold, setThreshold] = useState(initialThreshold);
  const [packPriceId, setPackPriceId] = useState(
    initialPackPriceId ?? creditPacks[0]?.priceId ?? "",
  );
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await updateAutoRefill(enabled, threshold, packPriceId);
        toast.success("Auto-refill settings saved");
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't save settings");
      }
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-sm">Notify me when credits are low</span>
      </label>

      {enabled && (
        <div className="space-y-3 pl-6">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              When balance drops below
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm font-mono tabular-nums"
            />
            <span className="text-xs text-muted-foreground ml-2">credits</span>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Remind me to buy
            </label>
            <select
              value={packPriceId}
              onChange={(e) => setPackPriceId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              {creditPacks.map((p) => (
                <option key={p.priceId} value={p.priceId}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <Button onClick={save} disabled={pending} variant="outline" size="sm">
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

export function ReferralSection({
  referralUrl,
  referrals,
  totalRewards,
}: {
  referralUrl: string;
  referrals: Array<{
    referredEmail: string;
    status: "pending" | "subscribed" | "rewarded";
    createdAt: Date;
  }>;
  totalRewards: number;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Earn 20 credits for each friend who subscribes to Pro.
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={referralUrl}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono text-muted-foreground"
        />
        <Button onClick={copyLink} variant="outline" size="sm">
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      {totalRewards > 0 && (
        <p className="text-xs text-muted-foreground">
          Total earned: <span className="font-mono tabular-nums text-foreground">{totalRewards}</span> credits
        </p>
      )}

      {referrals.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.referredEmail} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{r.referredEmail}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        r.status === "rewarded"
                          ? "bg-[var(--up)]/10 text-[var(--up)]"
                          : r.status === "subscribed"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono tabular-nums text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ManageBillingButton() {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      try {
        const { url } = await openBillingPortal();
        window.location.href = url;
      } catch (e: any) {
        toast.error(e?.message ?? "Couldn't open portal");
      }
    });
  }
  return (
    <Button variant="outline" onClick={onClick} disabled={pending} size="sm">
      {pending ? "Loading…" : "Manage subscription"}
    </Button>
  );
}
