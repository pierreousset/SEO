"use client";

import { useRef, useState, useTransition } from "react";

type Status = {
  anthropic: boolean;
  googleGemini: boolean;
  huggingface: boolean;
  nvidia: boolean;
  ollama: boolean;
  lmStudio: boolean;
  byokEnabled: boolean;
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
      {/* BYOK toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
        <div>
          <div className="text-sm font-medium">Use my own API keys</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            When enabled, AI features use your keys (no credits charged). You get 30 DataForSEO credits/month included.
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            name="byokEnabled"
            defaultChecked={status.byokEnabled}
            className="peer sr-only"
          />
          <div className="h-6 w-11 rounded-full bg-border peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>

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

      {/* Local models section */}
      <div className="border-t border-[#2A2A2A] pt-5 mt-5">
        <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-4">Local Models</div>

        {/* Ollama */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${status.ollama ? "bg-emerald-500" : "bg-neutral-600"}`} />
            <span className="text-sm font-medium text-neutral-300">Ollama</span>
          </div>
          <input
            name="ollamaKey"
            type="password"
            autoComplete="off"
            placeholder={status.ollama ? "******** (configured)" : "API key (cloud) — optional for local"}
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-mono"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="ollamaUrl"
              type="text"
              autoComplete="off"
              placeholder={status.ollama ? "configured" : "http://localhost:11434"}
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-mono"
            />
            <input
              name="ollamaModel"
              type="text"
              autoComplete="off"
              placeholder="llama3"
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-mono"
            />
          </div>
          <p className="text-[11px] text-neutral-500">Cloud: API key + URL. Local: just URL + model. OpenAI-compatible API.</p>
        </div>

        {/* LM Studio */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${status.lmStudio ? "bg-emerald-500" : "bg-neutral-600"}`} />
            <span className="text-sm font-medium text-neutral-300">LM Studio</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="lmStudioUrl"
              type="text"
              autoComplete="off"
              placeholder={status.lmStudio ? "configured" : "http://localhost:1234"}
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-mono"
            />
            <input
              name="lmStudioModel"
              type="text"
              autoComplete="off"
              placeholder="local-model"
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-mono"
            />
          </div>
          <p className="text-[11px] text-neutral-500">URL + model name. LM Studio exposes an OpenAI-compatible API.</p>
        </div>
      </div>

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
