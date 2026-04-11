import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "./auth";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * Wrap a route handler body so auth errors → 401, zod errors → 400,
 * anything else → 500 with the error message. Keeps handlers terse.
 */
export async function handle<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return ok(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return fail("Unauthorized", 401);
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid input", issues: err.issues },
        { status: 400 },
      );
    }
    if (err instanceof Error) {
      console.error("[api]", err);
      return fail(err.message, 500);
    }
    console.error("[api] unknown error", err);
    return fail("Internal server error", 500);
  }
}
