"use client";

import { useEffect } from "react";
import "./globals.css";
import { ErrorScreen } from "@/components/ff/error-screen";
import { cn } from "@/lib/utils";
import { fontVariables } from "./fonts";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the root layout, so it
 * brings its own document, global styles and brand fonts (Next.js error.js "Global Error").
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={cn("antialiased", fontVariables)}>
      <body>
        <title>Something went wrong · FiveFrames</title>
        <ErrorScreen digest={error.digest} retry={retry} />
      </body>
    </html>
  );
}
