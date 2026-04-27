"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  startProCheckout,
  startCreditsCheckout,
  openBillingPortal,
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
