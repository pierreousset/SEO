"use client";

import { useRef, useState, useTransition } from "react";

type Status = {
  anthropic: boolean;
  googleGemini: boolean;
  huggingface: boolean;
  nvidia: boolean;
};

type Provider = {
  key: string;
  label: string;
  placeholder: string;
  statusKey: keyof Status;
};

const PROVIDERS: Provider[] = [
  {
    key: "anthropicKey",
    label: "Anthropic (Claude)",
    placeholder: "sk-ant-...",
    statusKey: "anthropic",
  },
  {
    key: "googleGeminiKey",
    label: "Google (Gemini)",
    placeholder: "AIza...",
    statusKey: "googleGemini",
  },
  {
    key: "huggingfaceKey",
    label: "Hugging Face",
    placeholder: "hf_...",
    statusKey: "huggingface",
  },
  {
    key: "nvidiaKey",
    label: "Nvidia",
    placeholder: "nvapi-...",
    statusKey: "nvidia",
  },
];

export function ApiKeysForm({
  status,
  saveApiKeys,
}: {
  status: Status;
  saveApiKeys: (formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveApiKeys(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Clear password fields after save
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {PROVIDERS.map((p) => (
        <div key={p.key} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                status[p.statusKey] ? "bg-emerald-500" : "bg-neutral-600"
              }`}
            />
            <label
              htmlFor={p.key}
              className="text-sm font-medium text-neutral-300"
            >
              {p.label}
            </label>
          </div>
          <input
            id={p.key}
            name={p.key}
            type="password"
            autoComplete="off"
            placeholder={status[p.statusKey] ? "******** (configured)" : p.placeholder}
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-mono"
          />
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save keys"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400">Saved</span>
        )}
      </div>
    </form>
  );
}
