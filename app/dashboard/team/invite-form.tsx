"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendInvite } from "@/lib/actions/team";
import { toast } from "sonner";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    start(async () => {
      const res = await sendInvite(email.trim());
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invitation envoyée à ${email}`);
      setEmail("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-3">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@exemple.com"
        className="h-9 rounded-full max-w-xs"
        required
      />
      <Button type="submit" size="sm" disabled={pending || !email.trim()}>
        {pending ? "Envoi…" : "Inviter"}
      </Button>
    </form>
  );
}
