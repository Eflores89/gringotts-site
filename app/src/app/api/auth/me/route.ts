import { isAuthenticated } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const authed = await isAuthenticated();
    if (!authed) return fail("Unauthorized", 401);
    return ok({ authenticated: true });
  });
}
