"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { appToast } from "@/components/ui-elements/toast-client";

type Props = {
  successMessage: string | null;
  errorMessage: string | null;
};

export function StaffToastFeedback({ successMessage, errorMessage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!successMessage && !errorMessage) return;

    if (successMessage) {
      appToast.success(successMessage, {
        toastId: `staff-success-${successMessage}`,
      });
    }

    if (errorMessage) {
      appToast.error(errorMessage, { toastId: `staff-error-${errorMessage}` });
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("success");
    params.delete("error");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [successMessage, errorMessage, pathname, router, searchParams]);

  return null;
}
