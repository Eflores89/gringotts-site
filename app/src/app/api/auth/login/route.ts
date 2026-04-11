import { z } from "zod";
import { checkPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/api";

const schema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  return handle(async () => {
    const body = schema.parse(await request.json());
    if (!checkPassword(body.password)) {
      return fail("Invalid password", 401);
    }
    const token = await createSessionToken();
    await setSessionCookie(token);
    return ok({ authenticated: true });
  });
}
