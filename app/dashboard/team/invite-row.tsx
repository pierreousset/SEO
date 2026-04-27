"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revokeInvite } from "@/lib/actions/team";
import { toast } from "sonner";

export function InviteRow({
  id,
  email,
  expiresAt,
}: {
  id: string;
  email: string;
  expiresAt: string;
}) {
  const [pending, start] = useTransition();
  const expired = new Date(expiresAt) < new Date();

  function onRevoke() {
    start(async () => {
      const res = await revokeInvite(id);
      if (res.error) toast.error(res.error);
      else toast.success("Invitation révoquée.");
    });
  }

  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm">{email}</div>
        <div className="text-[10px] text-muted-foreground font-mono tabular mt-0.5">
          {expired ? (
            <span className="text-[var(--down)]">Expirée</span>
          ) : (
            <>Expire le {new Date(expiresAt).toLocaleDateString()}</>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRevoke} disabled={pending}>
        {pending ? "…" : "Révoquer"}
      </Button>
    </div>
  );
}
