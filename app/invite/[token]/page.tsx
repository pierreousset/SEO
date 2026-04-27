import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/client";
import { AcceptInviteForm } from "./accept-form";

export const dynamic = "force-dynamic";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Look up invite
  const [invite] = await db
    .select()
    .from(schema.teamInvites)
    .where(eq(schema.teamInvites.token, token))
    .limit(1);

  if (!invite) {
    return (
      <CenterCard>
        <h1 className="font-display text-2xl">Invitation introuvable</h1>
        <p className="text-sm text-muted-foreground mt-3">
          Ce lien d'invitation n'existe pas ou a été révoqué.
        </p>
      </CenterCard>
    );
  }

  if (invite.acceptedAt) {
    return (
      <CenterCard>
        <h1 className="font-display text-2xl">Invitation déjà acceptée</h1>
        <p className="text-sm text-muted-foreground mt-3">
          Vous pouvez accéder au dashboard directement.
        </p>
        <a href="/dashboard" className="mt-4 text-primary text-sm hover:underline">
          Aller au dashboard →
        </a>
      </CenterCard>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <CenterCard>
        <h1 className="font-display text-2xl">Invitation expirée</h1>
        <p className="text-sm text-muted-foreground mt-3">
          Demandez au propriétaire du compte de renvoyer une invitation.
        </p>
      </CenterCard>
    );
  }

  // Check if user is logged in
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    // Not logged in — redirect to sign-in with return URL
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    redirect(`/?redirect=${returnUrl}`);
  }

  // Fetch inviter info
  const [owner] = await db
    .select({ email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, invite.ownerId))
    .limit(1);

  return (
    <CenterCard>
      <h1 className="font-display text-2xl">Rejoindre un compte</h1>
      <p className="text-sm text-muted-foreground mt-3">
        <strong>{owner?.name || owner?.email}</strong> vous invite à rejoindre son compte
        SEO Dashboard. Vous aurez accès aux mêmes données.
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        Connecté en tant que {session.user.email}
      </p>
      <AcceptInviteForm token={token} />
    </CenterCard>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="rounded-2xl bg-card border border-border p-8 max-w-md w-full">
        {children}
      </div>
    </div>
  );
}
