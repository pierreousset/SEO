import { resolveAccountContext } from "@/lib/account-context";
import { db, schema } from "@/db/client";
import { and, eq, isNull } from "drizzle-orm";
import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";
import { InviteRow } from "./invite-row";
import { LeaveButton } from "./leave-button";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await resolveAccountContext();

  if (ctx.isOwner) {
    // Owner view: manage members + invites
    const members = await db
      .select({
        id: schema.teamMembers.id,
        userId: schema.teamMembers.userId,
        joinedAt: schema.teamMembers.joinedAt,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.teamMembers)
      .innerJoin(schema.users, eq(schema.teamMembers.userId, schema.users.id))
      .where(eq(schema.teamMembers.ownerId, ctx.sessionUserId));

    const pendingInvites = await db
      .select()
      .from(schema.teamInvites)
      .where(
        and(
          eq(schema.teamInvites.ownerId, ctx.sessionUserId),
          isNull(schema.teamInvites.acceptedAt),
        ),
      );

    return (
      <div className="px-4 md:px-9 py-7 max-w-[800px] mx-auto space-y-8">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">Settings</p>
          <h1 className="font-display text-[40px] mt-2">Team</h1>
          <p className="text-sm text-muted-foreground mt-3">
            Invitez d'autres personnes à accéder à vos données SEO. Elles auront les mêmes
            droits que vous (sauf la facturation qui reste à votre charge).
          </p>
        </header>

        {/* Invite form */}
        <section className="rounded-2xl bg-card p-6">
          <h2 className="text-sm font-semibold mb-4">Inviter un membre</h2>
          <InviteForm />
        </section>

        {/* Current members */}
        {members.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] text-muted-foreground mb-3">
              membres ({members.length})
            </h2>
            <div className="border border-border rounded-2xl overflow-hidden bg-card divide-y divide-border">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  id={m.id}
                  email={m.email}
                  name={m.name}
                  joinedAt={m.joinedAt.toISOString()}
                />
              ))}
            </div>
          </section>
        )}

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <section>
            <h2 className="font-mono text-[10px] text-muted-foreground mb-3">
              invitations en attente ({pendingInvites.length})
            </h2>
            <div className="border border-border rounded-2xl overflow-hidden bg-card divide-y divide-border">
              {pendingInvites.map((inv) => (
                <InviteRow
                  key={inv.id}
                  id={inv.id}
                  email={inv.email}
                  expiresAt={inv.expiresAt.toISOString()}
                />
              ))}
            </div>
          </section>
        )}

        {members.length === 0 && pendingInvites.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Pas encore de membres. Utilisez le formulaire ci-dessus pour inviter quelqu'un.
          </div>
        )}
      </div>
    );
  }

  // Member view: show whose account they're viewing + leave option
  const [owner] = await db
    .select({ email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, ctx.ownerId))
    .limit(1);

  return (
    <div className="px-4 md:px-9 py-7 max-w-[800px] mx-auto space-y-8">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">Settings</p>
        <h1 className="font-display text-[40px] mt-2">Team</h1>
      </header>

      <div className="rounded-2xl bg-card p-6 space-y-4">
        <p className="text-sm">
          Vous êtes membre du compte de{" "}
          <strong>{owner?.name || owner?.email}</strong>.
        </p>
        <p className="text-xs text-muted-foreground">
          Vous avez accès aux mêmes données (sites, keywords, briefs, audits, etc.).
          La facturation est gérée par le propriétaire du compte.
        </p>
        <LeaveButton ownerId={ctx.ownerId} />
      </div>
    </div>
  );
}
