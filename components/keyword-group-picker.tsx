"use client";

import { useRef, useState, useTransition } from "react";
import { Tag } from "lucide-react";
import { addKeywordToGroup, removeKeywordFromGroup } from "@/lib/actions/keyword-groups";
import type { GroupWithCount } from "@/lib/actions/keyword-groups";
import { toast } from "sonner";

type Props = {
  keywordId: string;
  groups: GroupWithCount[];
  /** Group IDs this keyword currently belongs to */
  memberOf: string[];
};

export function KeywordGroupPicker({ keywordId, groups, memberOf }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState<Set<string>>(new Set(memberOf));
  const ref = useRef<HTMLDivElement>(null);

  function toggle(groupId: string) {
    const isChecked = checked.has(groupId);
    // Optimistic update
    setChecked((prev) => {
      const next = new Set(prev);
      if (isChecked) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

    startTransition(async () => {
      try {
        if (isChecked) {
          await removeKeywordFromGroup(keywordId, groupId);
        } else {
          await addKeywordToGroup(keywordId, groupId);
        }
      } catch (e: any) {
        // Revert
        setChecked((prev) => {
          const next = new Set(prev);
          if (isChecked) next.add(groupId);
          else next.delete(groupId);
          return next;
        });
        toast.error(e?.message ?? "Failed to update group");
      }
    });
  }

  if (groups.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground disabled:opacity-40 p-0.5 rounded hover:bg-muted/40"
        aria-label="Assign to group"
        disabled={pending}
      >
        <Tag className="h-3 w-3" strokeWidth={1.5} />
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 w-48 rounded-lg border border-border bg-card shadow-lg py-1">
            {groups.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/40 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked.has(g.id)}
                  onChange={() => toggle(g.id)}
                  className="h-3 w-3 rounded border-border accent-primary"
                />
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: g.color ?? "#A855F7" }}
                />
                <span className="truncate">{g.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
