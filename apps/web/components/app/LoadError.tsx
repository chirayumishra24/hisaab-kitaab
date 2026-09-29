"use client";

import { CloudSlash } from "@phosphor-icons/react";
import { describeError } from "@hisabkitaab/shared/data";
import { useHisab } from "@hisabkitaab/shared/react";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/Display";

/** Full-section error state for failed listeners (network, permissions). */
export function LoadError({ error }: { error: Error | null }) {
  const { t } = useHisab();
  return (
    <EmptyState
      icon={<CloudSlash size={30} weight="duotone" />}
      title={t("errors.loadFailed")}
      body={describeError(t, error)}
      action={
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {t("common.retry")}
        </Button>
      }
    />
  );
}
