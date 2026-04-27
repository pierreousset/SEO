"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { leaveTeam } from "@/lib/actions/team";
import { toast } from "sonner";

export function LeaveButton({ ownerId }: { ownerId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onClick() {
    start(async () => {
      const res = (await leaveTeam(ownerId)) as { ok?: boolean; error?: string };
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Vous avez quitté l'équipe.");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      {pending ? "…" : "Quitter cette équipe"}
    </Button>
  );
}
