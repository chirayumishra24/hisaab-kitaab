import Image from "next/image";
import Link from "next/link";
import {
  AndroidLogo,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BellRinging,
  CheckCircle,
  ClockCountdown,
  CloudCheck,
  Copy,
  EyeSlash,
  HandCoins,
  House,
  LockKey,
  MagnifyingGlass,
  Storefront,
  UserPlus,
  WarningCircle,
  WhatsappLogo,
  WifiSlash,
} from "@phosphor-icons/react/ssr";
import { buildMessage, createTranslator, formatINR } from "@hisabkitaab/shared";
import { buttonClasses } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/components/ui/cn";

const t = createTranslator("en");
const APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL;

/* Sample data for the product preview. Clearly illustrative, rendered with the real design tokens. */
const SAMPLE_PEOPLE = [
  { name: "Aisha Khan", initials: "AK", amount: 320000, due: "Overdue by 4 days", overdue: true, tint: "bg-[#FBE7EE] text-[#8C2451]" },
  { name: "Rahul Sharma", initials: "RS", amount: 150000, due: "Due in 3 days", overdue: false, tint: "bg-[#E4EEF6] text-[#1D4F75]" },
  { name: "Meera Iyer", initials: "MI", amount: 85000, due: "Due 12 Oct", overdue: false, tint: "bg-[#E3F4EC] text-[#0B6040]" },
];

const sampleMessage = buildMessage(t, {
  kind: "REMINDER",
  contactName: "Rahul Sharma",
  amount: 150000,
  note: "Groceries",
  dueDate: "2026-10-10",
  today: "2026-09-29",
  senderName: "Sharma Kirana Store",
});

export default function LandingPage() {
  return (
    <div className="bg-canvas">
      <SiteNav />
      <main id="main">
        <Hero />
        <Problem />
        <Story />
        <HowItWorks />
        <Features />
        <Audiences />
        <Reminders />
        <Privacy />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function SiteNav() {
  return (
    <header className="safe-top sticky top-0 z-40 border-b border-line/60 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="HisabKitaab home">
          <Logo className="h-6 sm:h-7" priority />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-[15px] font-semibold text-body md:flex">
          <a href="#how" className="hover:text-ink">
            {t("landing.navHow")}
          </a>
          <a href="#features" className="hover:text-ink">
            {t("landing.navFeatures")}
          </a>
          <a href="#privacy" className="hover:text-ink">
            {t("landing.navSecurity")}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonClasses("ghost", "sm")}>
            {t("landing.login")}
          </Link>
          <Link href="/signup" className={buttonClasses("primary", "sm")}>
            {t("landing.cta")}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20 lg:pb-24">
      <div className="animate-rise">
        <p className="inline-flex h-8 items-center gap-2 rounded-full bg-receive-soft px-3 text-[13px] font-bold text-receive">
          <Storefront size={16} weight="bold" aria-hidden />
          For local shops and families
        </p>
        <h1 className="mt-5 text-[42px] leading-[1.05] font-extrabold tracking-tight text-ink sm:text-[52px] lg:text-[60px]">
          No confusion.
          <br />
          Just Hisab.
        </h1>
        <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-body sm:text-xl">{t("landing.heroBody")}</p>
        <div className="mt-8 grid gap-3 sm:flex sm:flex-row">
          <Link href="/signup" className={buttonClasses("accent", "lg", "shadow-[var(--shadow-fab)]")}>
            {t("landing.cta")}
            <ArrowRight size={20} weight="bold" aria-hidden />
          </Link>
          <a href="#how" className={buttonClasses("secondary", "lg")}>
            {t("landing.ctaSecondary")}
          </a>
        </div>
      </div>
      <ProductPreview />
    </section>
  );
}

/** A real, static rendering of the dashboard components with sample data. */
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[440px] animate-rise [animation-delay:120ms]" aria-label="Example of the HisabKitaab dashboard" role="img">
      <div className="rounded-[28px] border border-line bg-surface p-4 shadow-[var(--shadow-raised)] sm:p-5">
        <div className="rounded-[var(--radius-card)] bg-navy p-5 text-white">
          <p className="text-sm font-bold text-[#5FE3AE]">{t("money.toReceive")}</p>
          <p className="tabular mt-1.5 text-[38px] leading-none font-extrabold tracking-tight">{formatINR(2450000)}</p>
          <p className="mt-2 text-sm text-white/70">from 8 people</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line p-3.5">
            <p className="text-[13px] font-bold text-pay">{t("money.toPay")}</p>
            <p className="tabular mt-1 text-xl font-extrabold text-pay">{formatINR(720000)}</p>
          </div>
          <div className="rounded-2xl border border-overdue/30 bg-overdue-soft p-3.5">
            <p className="flex items-center gap-1 text-[13px] font-bold text-overdue">
              <WarningCircle size={14} weight="fill" aria-hidden /> {t("money.overdue")}
            </p>
            <p className="tabular mt-1 text-xl font-extrabold text-overdue">{formatINR(350000)}</p>
          </div>
        </div>
        <p className="mt-5 mb-1 px-1 text-[15px] font-bold text-ink">{t("dashboard.whoOwesYou")}</p>
        <ul className="divide-y divide-line">
          {SAMPLE_PEOPLE.map((p) => (
            <li key={p.name} className="flex items-center gap-3 px-1 py-2.5">
              <span className={cn("flex size-10 items-center justify-center rounded-full text-[13px] font-bold", p.tint)}>{p.initials}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">{p.name}</span>
                <span className={cn("block text-[12px]", p.overdue ? "font-semibold text-overdue" : "text-info")}>{p.due}</span>
              </span>
              <span className="tabular text-[15px] font-extrabold text-receive">{formatINR(p.amount)}</span>
              <span className="flex h-8 items-center gap-1 rounded-full bg-sunken px-2.5 text-[12px] font-bold text-primary">
                <BellRinging size={13} weight="bold" aria-hidden /> Remind
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-16 -left-3 hidden max-w-[250px] rounded-2xl rounded-bl-md border border-line bg-surface p-3.5 shadow-[var(--shadow-raised)] sm:block lg:-left-10">
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-receive">
          <CheckCircle size={14} weight="fill" aria-hidden /> Reminder shared
        </p>
        <p className="mt-1 text-[13px] leading-snug text-body">Hi Rahul, just a reminder that {formatINR(150000)} is pending…</p>
      </div>
    </div>
  );
}

function Problem() {
  const pains = [
    { icon: ClockCountdown, title: "People forget", body: "Small amounts given on credit slip out of memory within weeks." },
    { icon: WarningCircle, title: "Disputes start", body: "Without a clear record, it is your word against theirs." },
    { icon: HandCoins, title: "Money is lost", body: "Unpaid credit quietly eats into the shop's profit and the family budget." },
  ];
  return (
    <section className="bg-navy text-white">
      <div className="reveal mx-auto grid max-w-[1200px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:py-24">
        <h2 className="text-[30px] leading-[1.15] font-extrabold tracking-tight sm:text-[38px]">
          Many local shops struggle to manage the money they receive, and sometimes get cheated.
        </h2>
        <ul className="flex flex-col gap-6">
          {pains.map(({ icon: IconCmp, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#5FE3AE]">
                <IconCmp size={22} weight="bold" aria-hidden />
              </span>
              <span>
                <span className="block text-lg font-bold">{title}</span>
                <span className="block text-white/75">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section className="reveal mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
      <h2 className="max-w-[24ch] text-[28px] leading-tight font-extrabold tracking-tight text-ink sm:text-[38px]">
        It started as a wooden box that cost {formatINR(140000)}.
      </h2>
      <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-body">
        Our first HisabKitaab was a physical box for keeping a shop&apos;s records in one place. The app keeps that same
        simple idea, and adds totals, reminders and a record that never gets lost.
      </p>
      <figure className="mt-10 overflow-hidden rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-card)]">
        <Image
          src="/brand/prototype-box.jpg"
          alt="The original HisabKitaab prototype: a wooden box with compartments for records, labelled 'No confusion. Just Hisab.'"
          width={852}
          height={347}
          className="h-auto w-full"
          sizes="(min-width: 1200px) 1152px, 100vw"
        />
      </figure>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: UserPlus, title: "Add a person", body: "Name and mobile number. That's it." },
    { icon: ArrowDownLeft, title: "Record the money", body: "They owe you, or you owe them. Add a note or due date if you like." },
    { icon: WhatsappLogo, title: "Send a reminder", body: "A polite message, ready to go on WhatsApp or SMS." },
    { icon: CheckCircle, title: "Mark it paid", body: "Full or part payment. The history stays." },
  ];
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-surface">
      <div className="reveal mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="max-w-[22ch] text-[28px] leading-tight font-extrabold tracking-tight text-ink sm:text-[36px]">
          Add a record in under 20 seconds.
        </h2>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {steps.map(({ icon: IconCmp, title, body }, i) => (
            <li key={title} className="relative">
              {i < steps.length - 1 ? (
                <span aria-hidden className="absolute top-6 left-14 hidden h-px w-[calc(100%-3.5rem)] bg-line-strong lg:block" />
              ) : null}
              <span className="relative flex size-12 items-center justify-center rounded-full bg-receive-soft text-receive">
                <IconCmp size={24} weight="bold" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-1 text-body">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="reveal mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
      <h2 className="max-w-[24ch] text-[28px] leading-tight font-extrabold tracking-tight text-ink sm:text-[36px]">
        Everything you need. Nothing you don&apos;t.
      </h2>
      <div className="mt-10 grid gap-4 md:grid-cols-6">
        <div className="flex flex-col justify-between rounded-[var(--radius-card)] bg-navy p-6 text-white md:col-span-4 md:row-span-2 lg:p-8">
          <div>
            <h3 className="text-2xl font-extrabold">Your money, in one look</h3>
            <p className="mt-2 max-w-[40ch] text-white/75">To Receive, To Pay and Overdue at the top. No spreadsheets, no accounting words.</p>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              [t("money.toReceive"), formatINR(2450000), "text-[#5FE3AE]"],
              [t("money.toPay"), formatINR(720000), "text-[#FF9C8E]"],
              [t("money.overdue"), formatINR(350000), "text-[#FDB022]"],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-2xl bg-white/[0.07] p-3 sm:p-4">
                <p className="text-[12px] font-bold text-white/70 sm:text-sm">{label}</p>
                <p className={cn("tabular mt-1 text-lg font-extrabold sm:text-2xl", color)}>{value}</p>
              </div>
            ))}
          </div>
        </div>
        <FeatureTile className="md:col-span-2" icon={MagnifyingGlass} title="Find anyone fast" body="Search by name or phone number as you type." />
        <FeatureTile className="bg-receive-soft md:col-span-2" icon={HandCoins} title="Part payments" body="Rahul pays ₹2,000 of ₹5,000? Record it. ₹3,000 stays pending." />
        <FeatureTile className="md:col-span-3" icon={WarningCircle} title="Overdue stands out" body="Late payments are highlighted, so you know whom to call first." />
        <FeatureTile className="md:col-span-3" icon={WifiSlash} title="Works on slow networks" body="Your records open instantly and sync when the network is back." />
      </div>
    </section>
  );
}

function FeatureTile({
  icon: IconCmp,
  title,
  body,
  className,
}: {
  icon: typeof MagnifyingGlass;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-line bg-surface p-6", className)}>
      <IconCmp size={26} weight="duotone" className="text-primary" aria-hidden />
      <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1 text-body">{body}</p>
    </div>
  );
}

function Audiences() {
  const groups = [
    {
      icon: Storefront,
      title: "For small shops",
      body: "Kirana stores, tailors, repair shops and anyone who sells on credit.",
      points: ["Track every customer's udhaar", "Remind politely without awkward calls", "See today's overdue list at a glance"],
      tone: "bg-info-soft",
    },
    {
      icon: House,
      title: "For families",
      body: "Money lent to relatives and friends, shared expenses, and family loans.",
      points: ["Never forget who borrowed what", "Keep the family budget protected", "Settle up without arguments"],
      tone: "bg-receive-soft",
    },
  ];
  return (
    <section className="reveal mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:pb-24">
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(({ icon: IconCmp, title, body, points, tone }) => (
          <div key={title} className={cn("rounded-[var(--radius-card)] p-6 sm:p-8", tone)}>
            <IconCmp size={32} weight="duotone" className="text-primary" aria-hidden />
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{title}</h2>
            <p className="mt-2 text-body">{body}</p>
            <ul className="mt-5 flex flex-col gap-2.5">
              {points.map((point) => (
                <li key={point} className="flex items-center gap-2.5 font-semibold text-ink">
                  <CheckCircle size={20} weight="fill" className="shrink-0 text-receive" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Reminders() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="reveal mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:py-24">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="rounded-2xl rounded-tl-md border border-line bg-receive-soft/60 p-5 dark:bg-sunken">
            <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink">{sampleMessage}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              [WhatsappLogo, "WhatsApp"],
              [ArrowUpRight, "SMS"],
              [Copy, "Copy"],
            ].map(([IconCmp, label]) => {
              const I = IconCmp as typeof WhatsappLogo;
              return (
                <span key={label as string} className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-body">
                  <I size={18} weight="bold" aria-hidden /> {label as string}
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <h2 className="text-[28px] leading-tight font-extrabold tracking-tight text-ink sm:text-[36px]">Reminders that don&apos;t feel awkward.</h2>
          <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-body">
            HisabKitaab writes a short, polite message with the amount, the reason and the due date. Send it on WhatsApp,
            SMS or any app. You always see exactly what goes out.
          </p>
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  const points = [
    { icon: LockKey, title: "Only you can see your Hisab", body: "Every record is locked to your account." },
    { icon: EyeSlash, title: "No ads, no selling data", body: "Your customers' numbers stay yours." },
    { icon: CloudCheck, title: "Safely backed up", body: "Change phones without losing a single entry." },
  ];
  return (
    <section id="privacy" className="reveal mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
      <h2 className="text-[28px] leading-tight font-extrabold tracking-tight text-ink sm:text-[36px]">Your records stay private.</h2>
      <ul className="mt-10 grid divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface md:grid-cols-3 md:divide-x md:divide-y-0">
        {points.map(({ icon: IconCmp, title, body }) => (
          <li key={title} className="flex gap-4 p-6">
            <IconCmp size={28} weight="duotone" className="shrink-0 text-primary" aria-hidden />
            <span>
              <span className="block font-bold text-ink">{title}</span>
              <span className="mt-1 block text-body">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="reveal px-4 pb-16 sm:px-6 lg:pb-24">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-8 rounded-[28px] bg-navy px-6 py-12 text-white sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:py-16">
        <div>
          <Logo onDark className="h-8" />
          <p className="mt-4 max-w-[26ch] text-[28px] leading-tight font-extrabold tracking-tight sm:text-[34px]">
            Open it. See who owes you. Done.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/signup" className={buttonClasses("accent", "lg")}>
            {t("landing.cta")}
            <ArrowRight size={20} weight="bold" aria-hidden />
          </Link>
          {APK_URL ? (
            <a href={APK_URL} className={buttonClasses("secondary", "lg", "border-white/25 bg-transparent text-white hover:bg-white/10")}>
              <AndroidLogo size={20} weight="fill" aria-hidden />
              Download for Android
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="safe-bottom border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-5" />
          <span>{t("brand.tagline")}</span>
        </div>
        <nav aria-label="Footer" className="flex gap-5 font-semibold">
          <Link href="/login" className="hover:text-ink">
            {t("landing.login")}
          </Link>
          <Link href="/signup" className="hover:text-ink">
            Sign up
          </Link>
          {APK_URL ? (
            <a href={APK_URL} className="hover:text-ink">
              Android app
            </a>
          ) : null}
        </nav>
        <p>Built by The Golden Innovaters</p>
      </div>
    </footer>
  );
}
