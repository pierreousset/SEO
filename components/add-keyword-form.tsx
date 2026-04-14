"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addKeyword } from "@/lib/actions/keywords";
import { toast } from "sonner";

export function AddKeywordForm() {
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const fd = new FormData();
    fd.set("query", query);
    start(async () => {
      const res = await addKeyword(fd);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success("Keyword added.");
        setQuery("");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        type="text"
        placeholder="add a keyword…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={pending}
        className="h-9 w-72"
      />
      <Button type="submit" disabled={pending || !query.trim()} size="sm">
        {pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
