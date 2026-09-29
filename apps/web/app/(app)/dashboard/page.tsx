"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Confetti, Notebook, WarningCircle } from "@phosphor-icons/react";
import { addDays, describePeopleCount, filterPeople, upcomingDue } from "@hisabkitaab/shared";
import { useHisab, useRecentActivity } from "@hisabkitaab/shared/react";
import { AddHisabButton } from "@/components/app/AppShell";
import { LoadError } from "@/components/app/LoadError";
import { ActivityLine, EntryRow, PersonRow } from "@/components/app/Rows";
import { AnimatedAmount, Card, EmptyState, RowSkeleton, SectionHeader, Skeleton } from "@/components/ui/Display";
import { cn } from "@/components/ui/cn";

export default function DashboardPage() {
  const { t, status, error, summary, people, profile, openEntries, today } = useHisab();
  const firstName = (profile?.displayName ?? "").split(" ")[0];

  if (status === "error") return <LoadError error={error} />;

  const owesYou = filterPeople(people, "RECEIVE")
    .sort((a, b) => b.balance.overdueReceive - a.balance.overdueReceive || b.balance.toReceive - a.balance.toReceive)
    .slice(0, 5);
  const youOwe = filterPeople(people, "PAY")
    .sort((a, b) => b.balance.toPay - a.balance.toPay)
    .slice(0, 5);
  const dueSoon = upcomingDue(openEntries, today, addDays(today, 7)).slice(0, 4);
  const loading = status === "loading";
  const noPeople = !loading && people.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">{firstName ? t("dashboard.greeting", { name: firstName }) : " "}</p>
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-ink lg:text-[32px]">{t("dashboard.title")}</h1>
        </div>
      </header>

      {/* Money at a glance */}
      <section aria-label={t("dashboard.title")} className="grid grid-cols-2 gap-3 lg:grid-cols-[1.35fr_1fr_1fr] lg:gap-4">
        <div className="col-span-2 flex flex-col justify-between rounded-[var(--radius-card)] bg-navy p-5 text-white shadow-[var(--shadow-card)] lg:col-span-1 lg:p-6 dark:ring-1 dark:ring-white/10">
          <p className="text-sm font-bold tracking-wide text-[#5FE3AE]">{t("money.toReceive")}</p>
          {loading ? (
            <Skeleton className="mt-3 h-11 w-44 opacity-30" />
          ) : (
            <AnimatedAmount paise={summary.toReceive} className="mt-2 block text-[40px] leading-none font-extrabold tracking-tight lg:text-[44px]" />
          )}
          <p className="mt-3 text-sm text-white/75">
            {loading ? " " : summary.toReceive > 0 ? describePeopleCount(t, summary.peopleToReceive) : t("empty.noPendingBody")}
          </p>
        </div>
        <StatCard
          label={t("money.toPay")}
          paise={summary.toPay}
          sub={summary.toPay > 0 ? describePeopleCount(t, summary.peopleToPay) : t("money.allClear")}
          tone={summary.toPay > 0 ? "pay" : "muted"}
          loading={loading}
          href="/people?filter=PAY"
        />
        <StatCard
          label={t("money.overdue")}
          paise={summary.overdueReceive}
          sub={summary.overdueReceive > 0 ? t("filters.OVERDUE") : t("empty.noOverdueTitle")}
          tone={summary.overdueReceive > 0 ? "overdue" : "muted"}
          loading={loading}
          href="/people?filter=OVERDUE"
          icon={summary.overdueReceive > 0 ? <WarningCircle size={18} weight="fill" aria-hidden /> : null}
        />
      </section>

      {noPeople ? (
        <Card className="px-6">
          <EmptyState
            icon={<Notebook size={30} weight="duotone" />}
            title={t("empty.noHisabTitle")}
            body={t("empty.noHisabBody")}
            action={<AddHisabButton size="lg" />}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="flex flex-col gap-6">
            <Card className="px-4 pt-3 pb-1 sm:px-5">
              <SectionHeader
                title={t("dashboard.whoOwesYou")}
                action={
                  owesYou.length > 0 ? (
                    <Link href="/people?filter=RECEIVE" className="flex items-center gap-1 text-sm font-bold text-primary">
                      {t("common.seeAll")} <ArrowRight size={14} weight="bold" aria-hidden />
                    </Link>
                  ) : null
                }
              />
              {loading ? (
                <RowSkeleton rows={3} />
              ) : owesYou.length === 0 ? (
                <EmptyState compact icon={<Confetti size={28} weight="duotone" />} title={t("empty.noPendingTitle")} body={t("empty.noPendingBody")} />
              ) : (
                <ul className="divide-y divide-line">
                  {owesYou.map((p) => (
                    <PersonRow key={p.contact.id} contact={p.contact} balance={p.balance} side="receive" showRemind />
                  ))}
                </ul>
              )}
            </Card>

            {!loading && youOwe.length > 0 ? (
              <Card className="px-4 pt-3 pb-1 sm:px-5">
                <SectionHeader
                  title={t("dashboard.whoYouOwe")}
                  action={
                    <Link href="/people?filter=PAY" className="flex items-center gap-1 text-sm font-bold text-primary">
                      {t("common.seeAll")} <ArrowRight size={14} weight="bold" aria-hidden />
                    </Link>
                  }
                />
                <ul className="divide-y divide-line">
                  {youOwe.map((p) => (
                    <PersonRow key={p.contact.id} contact={p.contact} balance={p.balance} side="pay" />
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>

          <div className="flex flex-col gap-6">
            {dueSoon.length > 0 ? (
              <Card className="px-4 pt-3 pb-1 sm:px-5">
                <SectionHeader
                  title={t("dashboard.upcoming")}
                  action={<CalendarCheck size={20} className="text-info" aria-hidden />}
                />
                <ul>
                  {dueSoon.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} showPerson />
                  ))}
                </ul>
              </Card>
            ) : null}
            <RecentActivity />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  paise,
  sub,
  tone,
  loading,
  href,
  icon,
}: {
  label: string;
  paise: number;
  sub: string;
  tone: "pay" | "overdue" | "muted";
  loading: boolean;
  href: string;
  icon?: React.ReactNode;
}) {
  const colors = { pay: "text-pay", overdue: "text-overdue", muted: "text-ink" };
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col justify-between rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-card)] transition-colors lg:p-6",
        tone === "overdue" ? "border-overdue/30 bg-overdue-soft" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <p className={cn("flex items-center gap-1.5 text-sm font-bold", tone === "muted" ? "text-muted" : colors[tone])}>
        {icon}
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <AnimatedAmount paise={paise} className={cn("mt-2 block text-[26px] leading-none font-extrabold tracking-tight lg:text-[30px]", colors[tone])} />
      )}
      <p className="mt-2 truncate text-[13px] text-muted">{loading ? " " : sub}</p>
    </Link>
  );
}

function RecentActivity() {
  const { t } = useHisab();
  const { timeline, status } = useRecentActivity(8);
  return (
    <Card className="px-4 pt-3 pb-2 sm:px-5">
      <SectionHeader
        title={t("dashboard.recentActivity")}
        action={
          <Link href="/activity" className="flex items-center gap-1 text-sm font-bold text-primary">
            {t("common.seeAll")} <ArrowRight size={14} weight="bold" aria-hidden />
          </Link>
        }
      />
      {status === "loading" ? (
        <RowSkeleton rows={3} />
      ) : timeline.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t("empty.noActivityBody")}</p>
      ) : (
        <ul>
          {timeline.slice(0, 8).map((item) => (
            <ActivityLine key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}
