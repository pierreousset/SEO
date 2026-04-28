import { Inngest } from "inngest";

const isDev = process.env.NODE_ENV !== "production";

export const inngest = new Inngest({
  id: "seo-dashboard",
  // In dev, leave eventKey undefined so the SDK targets the local dev server (8288).
  // In prod, INNGEST_EVENT_KEY must be set from the Inngest dashboard.
  eventKey: isDev ? undefined : process.env.INNGEST_EVENT_KEY,
  isDev,
});

export type Events = {
  "serp/fetch.daily": { data: { userId?: string; runId?: string } };
  "serp/task.ready": { data: { userId: string; taskIds: string[]; date: string } };
  "brief/generate.weekly": { data: { userId: string; runId?: string } };
  "gsc/history.pull": { data: { userId: string; runId?: string; days?: number } };
  "audit/run": { data: { userId: string; runId: string; siteId?: string } };
  "meta-crawl/run": { data: { userId: string; runId: string } };
  "content/generate.article": { data: { userId: string; articleId: string; keywordId?: string; topic?: string } };
  "onboarding/welcome": { data: { userId: string; email: string; name?: string | null } };
};
