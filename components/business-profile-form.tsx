"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveBusinessProfile } from "@/lib/actions/business";
import { toast } from "sonner";

type Initial = {
  businessName: string;
  primaryService: string;
  secondaryServices: string;
  targetCities: string;
  targetCustomer: string;
  averageCustomerValueEur: number | string;
  competitorUrls: string;
  biggestSeoProblem: string;
  preferredLanguage: string;
};

export function BusinessProfileForm({ initial }: { initial: Initial }) {
  const [pending, start] = useTransition();
  const [v, setV] = useState(initial);

  function on<K extends keyof Initial>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setV((prev) => ({ ...prev, [k]: e.target.value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(v).forEach(([k, val]) => fd.set(k, String(val ?? "")));
    start(async () => {
      const res = await saveBusinessProfile(fd);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Business context saved. Brief AI will use it from next run.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Identity">
        <Field label="Business name" hint="As you'd say it on the phone">
          <Input value={v.businessName} onChange={on("businessName")} placeholder="Acme Plumbing" />
        </Field>
        <Field label="Preferred language" hint="Used for AI brief tone">
          <select
            value={v.preferredLanguage}
            onChange={on("preferredLanguage")}
            className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </Field>
      </Section>

      <Section title="Services">
        <Field label="Primary service" hint="What you do in 3-5 words">
          <Input
            value={v.primaryService}
            onChange={on("primaryService")}
            placeholder="Rénovation parquet"
          />
        </Field>
        <Field label="Secondary services" hint="Comma-separated, max 10">
          <Input
            value={v.secondaryServices}
            onChange={on("secondaryServices")}
            placeholder="ponçage, vitrification, restauration"
          />
        </Field>
        <Field label="Target cities / areas" hint="Comma-separated, max 10">
          <Input
            value={v.targetCities}
            onChange={on("targetCities")}
            placeholder="Paris 11, Paris 12, Vincennes"
          />
        </Field>
      </Section>

      <Section title="Customer">
        <Field label="Target customer" hint="Who's your best customer? 1-2 sentences">
          <textarea
            value={v.targetCustomer}
            onChange={on("targetCustomer")}
            placeholder="Propriétaires d'appartements haussmanniens 60-150m² en rénovation."
            rows={2}
            className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm"
          />
        </Field>
        <Field
          label="Average customer value (€)"
          hint="Used to estimate ROI of recommendations (optional)"
        >
          <Input
            type="number"
            min={0}
            value={v.averageCustomerValueEur}
            onChange={on("averageCustomerValueEur")}
            placeholder="2500"
          />
        </Field>
      </Section>

      <Section title="Competitive landscape">
        <Field label="Top 3 competitor URLs" hint="One per line, max 3">
          <textarea
            value={v.competitorUrls}
            onChange={on("competitorUrls")}
            placeholder="https://competitor1.com&#10;https://competitor2.com"
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm font-mono tabular text-xs"
          />
        </Field>
        <Field
          label="Biggest SEO problem right now"
          hint="One sentence, the AI uses this to focus the brief"
        >
          <Input
            value={v.biggestSeoProblem}
            onChange={on("biggestSeoProblem")}
            placeholder="Mes pages produit sont en page 2 depuis 3 mois"
          />
        </Field>
      </Section>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save business context"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      <div className="border border-border rounded-md bg-card p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
