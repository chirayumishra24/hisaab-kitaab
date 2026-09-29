import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/app/AuthForms";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return <ForgotPasswordForm />;
}
