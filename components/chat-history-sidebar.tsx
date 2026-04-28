"use client";

import { MessageSquare, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

type ConversationItem = {
  id: string;
  title: string;
  updatedAt: string;
};

export function ChatHistorySidebar({
  conversations,
  activeId,
}: {
  conversations: ConversationItem[];
  activeId: string | null;
}) {
  const router = useRouter();

  return (
    <aside className="w-[240px] shrink-0 bg-card border-r border-border flex flex-col h-full overflow-hidden">
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          History
        </span>
        <button
          type="button"
          onClick={() => router.push("/dashboard/chat?new=1")}
          className="p-1.5 rounded-md hover:bg-muted/40 transition-colors"
          title="New conversation"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="px-4 py-6 text-xs text-muted-foreground">
            No conversations yet.
          </p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            onClick={() => router.push(`/dashboard/chat?c=${conv.id}`)}
            className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors ${
              conv.id === activeId ? "bg-muted/40" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{conv.title}</p>
                <p className="text-[10px] text-muted-foreground font-mono tabular mt-1">
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
