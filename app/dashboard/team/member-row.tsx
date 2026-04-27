"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeTeamMember } from "@/lib/actions/team";
import { toast } from "sonner";

export function MemberRow({
  id,
  email,
  name,
  joinedAt,
}: {
  id: string;
  email: string;
  name: string | null;
  joinedAt: string;
}) {
  const [pending, start] = useTransition();

  function onRemove() {
    start(async () => {
      const res = await removeTeamMember(id);
      if (res.error) toast.error(res.error);
      else toast.success(`${email} retiré de l'équipe.`);
    });
  }

  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm">{name || email}</div>
        {name && <div className="text-xs text-muted-foreground">{email}</div>}
        <div className="text-[10px] text-muted-foreground font-mono tabular mt-0.5">
          Rejoint le {new Date(joinedAt).toLocaleDateString()}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRemove} disabled={pending}>
        {pending ? "…" : "Retirer"}
      </Button>
    </div>
  );
}
