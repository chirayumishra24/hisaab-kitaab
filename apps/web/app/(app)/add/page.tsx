"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDialogs } from "@/components/app/DialogsProvider";

/** Deep link (/add) that opens the Add Hisab sheet over the dashboard. */
export default function AddPage() {
  const dialogs = useDialogs();
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
    dialogs.open({ type: "addHisab" });
  }, [dialogs, router]);
  return null;
}
