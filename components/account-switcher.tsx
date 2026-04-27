"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchAccount } from "@/lib/actions/account";
import type { AccountInfo } from "@/lib/account-context";

export function AccountSwitcher({
  accounts,
  activeOwnerId,
}: {
  accounts: AccountInfo[];
  activeOwnerId: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (id === activeOwnerId) return;
    start(async () => {
      await switchAccount(id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] bg-secondary p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        Account
      </div>
      <select
        value={activeOwnerId}
        onChange={onChange}
        disabled={pending}
        className="w-full h-8 rounded-full bg-background border border-input px-3 text-xs truncate"
      >
        {accounts.map((a) => (
          <option key={a.ownerId} value={a.ownerId}>
            {a.isOwnAccount ? "My account" : a.ownerName || a.ownerEmail}
            {" "}({a.ownerEmail})
          </option>
        ))}
      </select>
    </div>
  );
}
