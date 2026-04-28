"use client";

import { useTransition, useState } from "react";
import { createApiToken, deleteApiToken } from "@/lib/actions/api-tokens";
import { Trash2, Copy, Check } from "lucide-react";

type Token = {
  id: string;
  name: string;
  lastUsedAt: Date | null;
  createdAt: Date | null;
};

export function ApiTokenSection({ tokens }: { tokens: Token[] }) {
  const [isPending, startTransition] = useTransition();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");

  function handleCreate() {
    setError(null);
    setNewKey(null);
    startTransition(async () => {
      const result = await createApiToken(name);
      if ("error" in result) {
        setError(result.error);
      } else {
        setNewKey(result.key);
        setName("");
      }
    });
  }

  function handleCopy() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-muted-foreground mb-1">
            Token name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CI pipeline"
            className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={isPending || !name.trim()}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium hover:opacity-85 transition disabled:opacity-50 shrink-0"
        >
          {isPending ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && <p className="text-xs text-[var(--down)]">{error}</p>}

      {newKey && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-primary font-semibold mb-2">
            Copy this key now -- it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-secondary/80 rounded-lg px-3 py-2 truncate select-all">
              {newKey}
            </code>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-secondary transition shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[var(--up)]" strokeWidth={2} />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Existing tokens */}
      {tokens.length > 0 && (
        <div className="space-y-2 mt-4">
          {tokens.map((t) => (
            <ApiTokenRow key={t.id} token={t} />
          ))}
        </div>
      )}

      {tokens.length === 0 && !newKey && (
        <p className="text-xs text-muted-foreground">No API keys created yet.</p>
      )}
    </div>
  );
}

function ApiTokenRow({ token }: { token: Token }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{token.name}</p>
        <p className="text-xs text-muted-foreground font-mono">
          Created {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : "unknown"}
          {token.lastUsedAt && (
            <> · Last used {new Date(token.lastUsedAt).toLocaleDateString()}</>
          )}
        </p>
      </div>
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deleteApiToken(token.id);
          })
        }
        className="p-1.5 rounded-full hover:bg-[var(--down)]/10 text-muted-foreground hover:text-[var(--down)] transition disabled:opacity-50 shrink-0"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
