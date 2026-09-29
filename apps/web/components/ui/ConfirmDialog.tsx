"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "primary" | "danger";
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Promise-based confirmation for important actions: `if (await confirm({...})) doIt()`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={options !== null}
        onClose={() => finish(false)}
        title={options?.title ?? ""}
        size="sm"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => finish(false)}>
              {options?.cancelLabel}
            </Button>
            <Button variant={options?.tone === "danger" ? "danger" : "primary"} onClick={() => finish(true)} data-autofocus>
              {options?.confirmLabel}
            </Button>
          </div>
        }
      >
        {options?.body ? <div className="text-[15px] leading-relaxed text-body">{options.body}</div> : null}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
