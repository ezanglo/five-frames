import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Supabase sends a failed email link (expired, already used) to the Site URL with
  // `error_code` in the query when its redirect target can't be used. Land it on sign-in
  // with the "link expired" note instead of a page that silently ignores it.
  const { pathname, searchParams } = request.nextUrl;
  if (searchParams.has("error_code") && !pathname.startsWith("/auth/") && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login?link=expired", request.url));
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
