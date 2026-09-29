"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass, UserPlus, UsersThree } from "@phosphor-icons/react";
import { filterPeople, searchPeople, type PeopleFilter } from "@hisabkitaab/shared";
import { useDebouncedValue, useHisab } from "@hisabkitaab/shared/react";
import { useDialogs } from "@/components/app/DialogsProvider";
import { LoadError } from "@/components/app/LoadError";
import { PersonRow } from "@/components/app/Rows";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, FilterTabs, RowSkeleton, SearchBar } from "@/components/ui/Display";

const FILTERS: PeopleFilter[] = ["ALL", "RECEIVE", "PAY", "OVERDUE", "SETTLED"];

export default function PeoplePage() {
  return (
    <Suspense>
      <People />
    </Suspense>
  );
}

function People() {
  const { t, people, status, error } = useHisab();
  const dialogs = useDialogs();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("filter") as PeopleFilter | null;
  const [filter, setFilterState] = useState<PeopleFilter>(initial && FILTERS.includes(initial) ? initial : "ALL");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 120);

  const setFilter = (next: PeopleFilter) => {
    setFilterState(next);
    router.replace(next === "ALL" ? pathname : `${pathname}?filter=${next}`, { scroll: false });
  };

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f, f === "ALL" ? 0 : filterPeople(people, f).length])),
    [people],
  );
  const results = useMemo(() => filterPeople(searchPeople(people, debounced), filter), [people, debounced, filter]);

  if (status === "error") return <LoadError error={error} />;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-tight text-ink lg:text-[32px]">{t("people.title")}</h1>
        <Button variant="secondary" icon={<UserPlus size={18} weight="bold" />} onClick={() => dialogs.open({ type: "person" })}>
          {t("people.add")}
        </Button>
      </header>

      <div className="flex flex-col gap-3">
        <SearchBar value={query} onChange={setQuery} placeholder={t("people.searchPlaceholder")} label={t("people.searchPlaceholder")} />
        <FilterTabs
          label={t("people.title")}
          value={filter}
          onChange={setFilter}
          counts={counts}
          options={FILTERS.map((f) => ({ value: f, label: t(`filters.${f}`) }))}
        />
      </div>

      <Card className="px-4 py-1 sm:px-5">
        {status === "loading" ? (
          <RowSkeleton rows={6} />
        ) : people.length === 0 ? (
          <EmptyState
            icon={<UsersThree size={30} weight="duotone" />}
            title={t("empty.noPeopleTitle")}
            body={t("empty.noPeopleBody")}
            action={
              <Button icon={<UserPlus size={18} weight="bold" />} onClick={() => dialogs.open({ type: "person" })}>
                {t("people.add")}
              </Button>
            }
          />
        ) : results.length === 0 ? (
          <EmptyState
            compact
            icon={<MagnifyingGlass size={28} weight="duotone" />}
            title={debounced ? t("empty.noResultsTitle") : t("empty.noEntriesTitle")}
            body={debounced ? t("empty.noResultsBody") : t("empty.noEntriesBody")}
          />
        ) : (
          <ul className="divide-y divide-line" aria-live="polite">
            {results.map((p) => (
              <PersonRow key={p.contact.id} contact={p.contact} balance={p.balance} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
