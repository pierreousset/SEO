"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/actions/team";
import { toast } from "sonner";

export function AcceptInviteForm({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onClick() {
    start(async () => {
      const res = await acceptInvite(token);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Invitation acceptée !");
      router.push("/dashboard");
    });
  }

  return (
    <div className="mt-6 flex gap-3">
      <Button onClick={onClick} disabled={pending}>
        {pending ? "Acceptation…" : "Accepter l'invitation"}
      </Button>
      <Button variant="outline" onClick={() => router.push("/dashboard")} disabled={pending}>
        Ignorer
      </Button>
    </div>
  );
}
