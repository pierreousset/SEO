"use client";

import { useState, useTransition } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createGroup, deleteGroup } from "@/lib/actions/keyword-groups";
import type { GroupWithCount } from "@/lib/actions/keyword-groups";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#A855F7", "#0D9488", "#F59E0B", "#EF4444", "#3B82F6",
  "#EC4899", "#10B981", "#F97316",
];

type Props = {
  groups: GroupWithCount[];
  activeGroupId: string | null;
};

export function KeywordGroupBar({ groups, activeGroupId }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [pending, startTransition] = useTransition();

  function selectGroup(groupId: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (groupId) {
      params.set("group", groupId);
    } else {
      params.delete("group");
    }
    router.push(`/dashboard/keywords?${params.toString()}`);
  }

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createGroup(name.trim(), color);
        setName("");
        setShowForm(false);
        toast.success("Group created");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to create group");
      }
    });
  }

  function handleDelete(e: React.MouseEvent, groupId: string) {
    e.stopPropagation();
    if (!confirm("Delete this group? Keywords won't be removed.")) return;
    startTransition(async () => {
      try {
        await deleteGroup(groupId);
        if (activeGroupId === groupId) selectGroup(null);
        toast.success("Group deleted");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to delete group");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* "All" pill */}
      <button
        onClick={() => selectGroup(null)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
          !activeGroupId
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background hover:bg-muted/40 text-muted-foreground"
        }`}
      >
        All
      </button>

      {groups.map((g) => (
        <button
          key={g.id}
          onClick={() => selectGroup(g.id)}
          className={`group inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            activeGroupId === g.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background hover:bg-muted/40 text-muted-foreground"
          }`}
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: g.color ?? "#A855F7" }}
          />
          {g.name}
          <span className="font-mono text-[10px] opacity-60">{g.memberCount}</span>
          <span
            onClick={(e) => handleDelete(e, g.id)}
            className="hidden group-hover:inline-flex ml-0.5 hover:text-red-400"
            title="Delete group"
          >
            <Trash2 className="h-2.5 w-2.5" strokeWidth={1.5} />
          </span>
        </button>
      ))}

      {/* Create new group */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-full border border-dashed border-border hover:border-muted-foreground transition-colors"
        >
          <Plus className="h-3 w-3" strokeWidth={1.5} />
          Group
        </button>
      ) : (
        <div className="inline-flex items-center gap-1.5 bg-card border border-border rounded-full px-2 py-1">
          <div className="flex items-center gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                  color === c ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Group name"
            autoFocus
            className="bg-transparent text-xs w-24 outline-none placeholder:text-muted-foreground/50"
          />
          <button
            onClick={handleCreate}
            disabled={pending || !name.trim()}
            className="text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-40"
          >
            Add
          </button>
          <button
            onClick={() => { setShowForm(false); setName(""); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
