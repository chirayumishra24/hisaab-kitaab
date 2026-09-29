import { Logo } from "../ui/Logo";

/** Shown to developers when Firebase env vars are missing. */
export function NotConfigured() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <Logo className="h-8 self-start" />
      <h1 className="text-2xl font-bold">Firebase isn&apos;t configured</h1>
      <p className="text-body">
        Copy <code className="rounded bg-sunken px-1.5 py-0.5">apps/web/.env.example</code> to{" "}
        <code className="rounded bg-sunken px-1.5 py-0.5">apps/web/.env.local</code> and either fill in your Firebase web
        config or set <code className="rounded bg-sunken px-1.5 py-0.5">NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true</code> and run{" "}
        <code className="rounded bg-sunken px-1.5 py-0.5">npm run emulators</code>.
      </p>
    </div>
  );
}
