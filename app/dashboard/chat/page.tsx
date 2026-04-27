import Link from "next/link";
import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { ChatUi } from "@/components/chat-ui";
import { getUserPlan } from "@/lib/billing-helpers";
import { CHAT_LIMITS } from "@/lib/billing-constants";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const ctx = await resolveAccountContext();
  const plan = await getUserPlan(ctx.ownerId);

  // Build quota banner.
  let quotaBanner: React.ReactNode = null;
  if (plan === "free") {
    const [lifetimeRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.chatMessages)
      .where(
        and(
          eq(schema.chatMessages.userId, ctx.ownerId),
          eq(schema.chatMessages.role, "user"),
        ),
      );
    const used = lifetimeRow?.count ?? 0;
    const trialLeft = Math.max(0, CHAT_LIMITS.freeLifetimeMessages - used);
    if (trialLeft > 0) {
      quotaBanner = (
        <div className="rounded-[12px] border border-border bg-secondary px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between gap-3">
          <span>
            Free trial: <span className="font-mono tabular text-foreground">{trialLeft}</span> of {CHAT_LIMITS.freeLifetimeMessages} messages left.
          </span>
          <Link href="/dashboard/billing" className="text-primary hover:underline">
            Upgrade for {CHAT_LIMITS.proMonthlyIncluded}/mo →
          </Link>
        </div>
      );
    } else {
      // Trial used up. If they hold credits, 1 credit/msg. Otherwise it's over.
      quotaBanner = (
        <div className="rounded-[12px] border border-border bg-secondary px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between gap-3">
          <span>
            Trial used. Each message now costs 1 credit (if you have any). Subscribe to Pro for {CHAT_LIMITS.proMonthlyIncluded}/mo included.
          </span>
          <Link href="/dashboard/billing" className="text-primary hover:underline">
            Upgrade →
          </Link>
        </div>
      );
    }
  } else {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const [monthRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.chatMessages)
      .where(
        and(
          eq(schema.chatMessages.userId, ctx.ownerId),
          eq(schema.chatMessages.role, "user"),
          gte(schema.chatMessages.createdAt, startOfMonth),
        ),
      );
    const used = monthRow?.count ?? 0;
    const remaining = Math.max(0, CHAT_LIMITS.proMonthlyIncluded - used);
    if (remaining < 50) {
      quotaBanner = (
        <div className="rounded-[12px] border border-border bg-secondary px-4 py-2.5 text-xs text-muted-foreground">
          {remaining > 0
            ? `${remaining} of ${CHAT_LIMITS.proMonthlyIncluded} included messages left this month. Overage: 1 credit/message.`
            : `Monthly quota reached. Each message now costs 1 credit.`}
        </div>
      );
    }
  }

  // Load the most recent conversation as initial state. Fresh convo = empty UI.
  const [latestConv] = await db
    .select()
    .from(schema.chatConversations)
    .where(eq(schema.chatConversations.userId, ctx.ownerId))
    .orderBy(desc(schema.chatConversations.updatedAt))
    .limit(1);

  const prior = latestConv
    ? await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.conversationId, latestConv.id))
        .orderBy(schema.chatMessages.createdAt)
    : [];

  const initialMessages = prior.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    toolCalls: (m.toolCalls as Array<{ name: string; input: Record<string, unknown> }>) ?? [],
  }));

  return (
    <div className="h-screen flex flex-col px-8 lg:px-12 pt-8 pb-6 max-w-[1000px] mx-auto">
      <header className="mb-4 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          Ask your SEO data
        </p>
        <h1 className="font-display text-[40px] mt-2">Chat</h1>
      </header>

      {quotaBanner ? <div className="mb-4 shrink-0">{quotaBanner}</div> : null}

      <div className="flex-1 min-h-0">
        <ChatUi
          initialMessages={initialMessages}
          conversationId={latestConv?.id ?? null}
        />
      </div>
    </div>
  );
}
