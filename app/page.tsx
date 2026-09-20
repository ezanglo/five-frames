import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">FiveFrames</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Five photos per guest. That&rsquo;s the whole idea.
      </p>
      <div className="flex gap-2">
        <Button nativeButton={false} render={<Link href="/login" />}>
          Host sign in
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/signup" />}
        >
          Create host account
        </Button>
      </div>
    </div>
  );
}
