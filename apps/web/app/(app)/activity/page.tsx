"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { filterEntries, type EntryFilter } from "@hisabkitaab/shared";
import { useHisab, usePaidEntries, useRecentActivity } from "@hisabkitaab/shared/react";
import { LoadError } from "@/components/app/LoadError";
import { EntryRow, PaymentRow } from "@/components/app/Rows";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, FilterTabs, RowSkeleton } from "@/components/ui/Display";

const FILTERS: EntryFilter[] = ["ALL", "RECEIVE", "PAY", "OVERDUE", "PAID"];

export default function ActivityPage() {
  return (
    <Suspense>
      <Activity />
    </Suspense>
  );
}

function Activity() {
  const { t, openEntries, today, status, error } = useHisab();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("filter") as EntryFilter | null;
  const [filter, setFilterState] = useState<EntryFilter>(initial && FILTERS.includes(initial) ? initial : "ALL");
  const setFilter = (next: EntryFilter) => {
    setFilterState(next);
    router.replace(next === "ALL" ? pathname : `${pathname}?filter=${next}`, { scroll: false });
  };

  const recent = useRecentActivity(25, 25);
  const paid = usePaidEntries(filter === "PAID");

  const openFiltered = useMemo(
    () =>
      filter === "RECEIVE" || filter === "PAY" || filter === "OVERDUE"
        ? filterEntries(openEntries, filter, today).sort((a, b) =>
            filter === "OVERDUE" ? 0 : b.createdAt - a.createdAt,
          )
        : [],
    [openEntries, filter, today],
  );
  const counts = useMemo(
    () => ({
      RECEIVE: filterEntries(openEntries, "RECEIVE", today).length,
      PAY: filterEntries(openEntries, "PAY", today).length,
      OVERDUE: filterEntries(openEntries, "OVERDUE", today).length,
    }),
    [openEntries, today],
  );

  if (status === "error") return <LoadError error={error} />;

  let content: React.ReactNode;
  if (filter === "ALL") {
    content =
      recent.status === "loading" ? (
        <RowSkeleton rows={6} />
      ) : recent.timeline.length === 0 ? (
        <EmptyState icon={<ClockCounterClockwise size={30} weight="duotone" />} title={t("empty.noActivityTitle")} body={t("empty.noActivityBody")} />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {recent.timeline.map((item) =>
              item.kind === "entry" ? (
                <EntryRow key={`e-${item.id}`} entry={item.entry} showPerson />
              ) : (
                <PaymentRow key={`p-${item.id}`} payment={item.payment} showPerson />
              ),
            )}
          </ul>
          {recent.hasMore ? <LoadMore onClick={recent.loadMore} label={t("common.loadMore")} /> : null}
        </>
      );
  } else if (filter === "PAID") {
    content =
      paid.status === "loading" ? (
        <RowSkeleton rows={5} />
      ) : paid.entries.length === 0 ? (
        <EmptyState compact icon={<ClockCounterClockwise size={28} weight="duotone" />} title={t("empty.noEntriesTitle")} body={t("empty.noEntriesBody")} />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {paid.entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} showPerson />
            ))}
          </ul>
          {paid.hasMore ? <LoadMore onClick={paid.loadMore} label={t("common.loadMore")} /> : null}
        </>
      );
  } else {
    content =
      status === "loading" ? (
        <RowSkeleton rows={5} />
      ) : openFiltered.length === 0 ? (
        <EmptyState
          compact
          icon={<ClockCounterClockwise size={28} weight="duotone" />}
          title={filter === "OVERDUE" ? t("empty.noOverdueTitle") : t("empty.noPendingTitle")}
          body={filter === "OVERDUE" ? t("empty.noOverdueBody") : t("empty.noPendingBody")}
        />
      ) : (
        <ul className="divide-y divide-line">
          {openFiltered.map((entry) => (
            <EntryRow key={entry.id} entry={entry} showPerson />
          ))}
        </ul>
      );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[28px] font-extrabold tracking-tight text-ink lg:text-[32px]">{t("nav.activity")}</h1>
      <FilterTabs
        label={t("nav.activity")}
        value={filter}
        onChange={setFilter}
        counts={counts}
        options={FILTERS.map((f) => ({ value: f, label: t(`filters.${f}`) }))}
      />
      <Card className="px-3 py-1 sm:px-4">{content}</Card>
    </div>
  );
}

function LoadMore({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="flex justify-center py-3">
      <Button variant="ghost" size="sm" onClick={onClick}>
        {label}
      </Button>
    </div>
  );
}
