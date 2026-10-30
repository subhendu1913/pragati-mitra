import { Suspense } from "react";
import ResetForm from "@/components/reset-form";
import { Spinner } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner /></div>}>
      <ResetForm />
    </Suspense>
  );
}
