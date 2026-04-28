"use client";

import { useRef, useState, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
};

const TOOL_LABEL: Record<string, string> = {
  list_keywords: "Searching keywords",
  keyword_history: "Reading keyword history",
  get_serp_snapshot: "Reading SERP snapshot",
  get_latest_audit: "Reading audit",
  get_latest_cannibalization: "Reading cannibalization",
  get_aeo_results: "Reading AEO data",
  get_competitor_gap: "Reading gap scan",
  get_business_profile: "Reading business profile",
  latest_brief: "Reading weekly brief",
};

const SUGGESTED_QUESTIONS = [
  "Quels keywords ont perdu des positions cette semaine ?",
  "Résume les résultats de mon dernier audit",
  "Quels sont mes keywords les plus proches du top 3 ?",
  "Analyse mon CTR vs mes positions",
  "Quelles pages manquent dans mon sitemap ?",
];

export function ChatUi({
  initialMessages = [],
  conversationId: initialConvId,
}: {
  initialMessages?: Msg[];
  conversationId?: string | null;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveTools, setLiveTools] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConvId ?? null,
  );
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, liveTools]);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setInput("");
    setLoading(true);
    setLiveTools([]);

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: message },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const seenTools: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE: split on double newlines.
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const lines = evt.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const eventName = eventLine.slice(6).trim();
          let data: any;
          try {
            data = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }

          if (eventName === "meta" && data?.conversationId) {
            setConversationId(data.conversationId);
          } else if (eventName === "tool_call") {
            seenTools.push(data.name);
            setLiveTools([...seenTools]);
          } else if (eventName === "text") {
            setMessages((prev) => [
              ...prev,
              {
                id: assistantMsgId,
                role: "assistant",
                content: data as string,
                toolCalls: seenTools.map((n) => ({ name: n, input: {} })),
              },
            ]);
          } else if (eventName === "error") {
            setMessages((prev) => [
              ...prev,
              {
                id: assistantMsgId,
                role: "assistant",
                content: `Error: ${data.error ?? "unknown"}`,
              },
            ]);
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: `Error: ${err?.message ?? "connection failed"}`,
        },
      ]);
    } finally {
      setLoading(false);
      setLiveTools([]);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-6 pb-6">
        {messages.length === 0 && (
          <div className="rounded-2xl bg-secondary p-6 md:p-8">
            <p className="text-lg">
              Ask anything about your SEO data. I can read your keywords, positions, GSC
              metrics, audit findings, cannibalizations, AEO visibility, and more.
            </p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="bg-card rounded-2xl px-4 py-3 border border-border hover:border-primary/50 transition text-sm text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}

        {liveTools.length > 0 && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground pl-4">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            <div className="flex flex-wrap gap-2">
              {liveTools.map((t, i) => (
                <span
                  key={i}
                  className="inline-block text-[10px] uppercase font-medium px-2.5 py-1 rounded-full bg-secondary"
                >
                  {TOOL_LABEL[t] ?? t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask about your SEO data…"
            className="flex-1 h-12 rounded-full bg-secondary px-5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" disabled={loading || !input.trim()} size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                Send
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[720px] rounded-2xl px-5 py-4 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary"
        }`}
      >
        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {msg.toolCalls.map((tc, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] uppercase font-medium px-2 py-0.5 rounded-full bg-background text-muted-foreground"
              >
                <Sparkles className="h-2.5 w-2.5" strokeWidth={2} />
                {TOOL_LABEL[tc.name] ?? tc.name}
              </span>
            ))}
          </div>
        )}
        {isUser ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {msg.content}
          </div>
        ) : (
          <MarkdownBody content={msg.content} />
        )}
      </div>
    </div>
  );
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <h1 className="font-display text-xl mt-4 mb-2 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-lg mt-4 mb-2 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-semibold text-base mt-3 mb-1 first:mt-0">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="underline hover:no-underline"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            // Inline code vs code block — react-markdown passes class for blocks.
            const isBlock = (className ?? "").includes("language-");
            if (isBlock) {
              return (
                <code className="block w-full bg-background rounded-[12px] p-4 font-mono tabular text-xs overflow-x-auto my-3 whitespace-pre">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-background rounded px-1.5 py-0.5 font-mono tabular text-[0.85em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground mb-3 last:mb-0">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-[12px] bg-background">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-border">{children}</td>
          ),
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

