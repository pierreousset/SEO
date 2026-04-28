"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BriefPdfButton({ briefId }: { briefId: string }) {
  return (
    <a href={`/brief-print?id=${briefId}`} target="_blank" rel="noopener">
      <Button variant="outline" size="sm">
        <FileDown data-icon="inline-start" className="h-3.5 w-3.5" />
        PDF
      </Button>
    </a>
  );
}
