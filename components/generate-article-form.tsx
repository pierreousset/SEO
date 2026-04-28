"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triggerArticleGeneration } from "@/lib/actions/content";

type Props = {
  keywords: Array<{ id: string; query: string }>;
};

export function GenerateArticleForm({ keywords }: Props) {
  const [mode, setMode] = useState<"keyword" | "topic">("keyword");
  const [keywordId, setKeywordId] = useState("");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "keyword"
          ? await triggerArticleGeneration(keywordId || undefined, undefined)
          : await triggerArticleGeneration(undefined, topic || undefined);

      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("keyword")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === "keyword"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          From tracked keyword
        </button>
        <button
          type="button"
          onClick={() => setMode("topic")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === "topic"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          Custom topic
        </button>
      </div>

      {mode === "keyword" ? (
        <select
          value={keywordId}
          onChange={(e) => setKeywordId(e.target.value)}
          className="w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Select a keyword...</option>
          {keywords.map((k) => (
            <option key={k.id} value={k.id}>
              {k.query}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic, e.g. &quot;best practices for local SEO in 2025&quot;"
          className="w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || (mode === "keyword" ? !keywordId : !topic.trim())}
        className="rounded-xl bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Generating..." : "Generate article \u00b7 5 credits"}
      </button>
    </div>
  );
}
