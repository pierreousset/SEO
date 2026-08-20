import Link from "next/link";
import type { PageLocale } from "@/app/dashboard/locale";
import { OnboardingPullButton } from "@/components/onboarding-pull-button";

type Step = {
  n: string;
  title: string;
  body: string;
  done: boolean;
  current: boolean;
  action: React.ReactNode;
};

export function OnboardingSetup({
  i,
  connected,
  keywordCount,
  authUrl,
  isOwner,
}: {
  i: PageLocale;
  connected: boolean;
  keywordCount: number;
  authUrl: string | null;
  isOwner: boolean;
}) {
  const current = !connected ? 1 : keywordCount === 0 ? 2 : 3;
  const o = i.onboarding;

  const steps: Step[] = [
    {
      n: "01",
      title: o.step1Title,
      body: o.step1Body,
      done: connected,
      current: current === 1,
      action: connected ? (
        <span className="text-caption text-sky-teal">{o.step1Done}</span>
      ) : !isOwner ? (
        <p className="text-caption text-ash-gray">{o.step1OwnerOnly}</p>
      ) : authUrl ? (
        <a
          href={authUrl}
          className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-button-black text-canvas-white text-sm shadow-button"
        >
          {o.step1Cta}
        </a>
      ) : (
        <p className="text-caption text-ash-gray">{o.step1MissingEnv}</p>
      ),
    },
    {
      n: "02",
      title: o.step2Title,
      body: o.step2Body,
      done: keywordCount > 0,
      current: current === 2,
      action:
        keywordCount > 0 ? (
          <Link
            href="/dashboard/keywords"
            className="text-sm text-sky-teal hover:underline"
          >
            {o.step2Cta}
          </Link>
        ) : connected ? (
          <Link
            href="/dashboard/keywords"
            className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-button-black text-canvas-white text-sm shadow-button"
          >
            {o.step2Add}
          </Link>
        ) : (
          <span className="text-caption text-ash-gray">{o.step1Title}</span>
        ),
    },
    {
      n: "03",
      title: o.step3Title,
      body: o.step3Body,
      done: connected && keywordCount > 0,
      current: current === 3,
      action:
        connected && keywordCount > 0 ? (
          <p className="text-body-sm text-deep-slate">{o.nextBrief}</p>
        ) : (
          <span className="text-caption text-ash-gray">—</span>
        ),
    },
  ];

  return (
    <div className="sheet max-w-[760px] px-6 py-8 md:px-10 md:py-10 space-y-10">
      <header>
        <p className="text-caption text-ash-gray">{o.kicker}</p>
        <h1 className="text-heading-lg mt-2 text-balance">{o.title}</h1>
        <p className="text-body text-ash-gray mt-3 max-w-[36rem]">{o.subtitle}</p>
      </header>

      {connected && keywordCount > 0 && (
        <div className="space-y-2">
          <OnboardingPullButton label={o.pullCta} />
          <p className="text-caption text-ash-gray">{o.pullHint}</p>
        </div>
      )}

      <ol>
        {steps.map((step) => (
          <li key={step.n} className="border-t border-hairline py-7 first:border-t-0">
            <div className="grid grid-cols-[auto_1fr] gap-x-5 items-start">
              <span
                className={`text-subheading font-semibold tabular-nums leading-none ${
                  step.current || step.done ? "text-ink-black" : "text-ash-gray"
                }`}
              >
                {step.n}
              </span>
              <div className="min-w-0">
                <h2 className="text-subheading font-semibold text-ink-black">
                  {step.title}
                </h2>
                <p className="text-body-sm text-ash-gray mt-1.5">{step.body}</p>
                <div className="mt-4">{step.action}</div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
