"use client";

import { useMemo } from "react";

/**
 * Simple markdown-to-HTML renderer for generated articles.
 * Handles headings, paragraphs, bold, italic, links, and lists.
 * No external dependency — keeps the bundle light.
 */
export function ArticleRenderer({ content }: { content: string }) {
  const html = useMemo(() => markdownToHtml(content), [content]);

  return (
    <div
      className="prose prose-invert prose-sm max-w-none
        prose-headings:font-display
        prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
        prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
        prose-p:leading-relaxed prose-p:text-foreground/80
        prose-a:text-primary prose-a:underline
        prose-strong:text-foreground
        prose-ul:list-disc prose-ol:list-decimal
        prose-li:text-foreground/80"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function markdownToHtml(md: string): string {
  // Escape HTML entities
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` ... ```)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).replace(/^\w*\n/, "");
    return `<pre class="bg-background rounded-xl p-4 overflow-x-auto text-xs"><code>${code}</code></pre>`;
  });

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>',
  );

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs: wrap lines that aren't already HTML tags
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<")) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}
