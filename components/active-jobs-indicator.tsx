"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

type Job = { label: string; status: string };

export function ActiveJobsIndicator() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    async function poll() {
      if (!aliveRef.current) return;
      try {
        const res = await fetch("/api/jobs/active");
        if (res.ok) {
          const data = await res.json();
          const fetched: Job[] = data.jobs ?? [];
          if (aliveRef.current) setJobs(fetched);
          const delay = fetched.length > 0 ? 5_000 : 15_000;
          if (aliveRef.current) setTimeout(poll, delay);
          return;
        }
      } catch {}
      if (aliveRef.current) setTimeout(poll, 15_000);
    }

    poll();
    return () => { aliveRef.current = false; };
  }, []);

  if (jobs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
      <div className="flex items-center gap-3">
        {jobs.map((j) => (
          <span key={j.label} className="flex items-center gap-1.5 text-[11px]">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            <span className="text-muted-foreground font-mono truncate">{j.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
