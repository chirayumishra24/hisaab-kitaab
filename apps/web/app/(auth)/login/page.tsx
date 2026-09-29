import type { Metadata } from "next";
import { LoginForm } from "@/components/app/AuthForms";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return <LoginForm />;
}
