"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ff/error-screen";

/** Route-level error boundary for every segment under the root layout. */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen digest={error.digest} retry={retry} />;
}
