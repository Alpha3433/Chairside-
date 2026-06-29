import { NextResponse } from "next/server";
import { parseSpec, SpecValidationError } from "@/lib/specSerialize";
import { renderIllustration, isRenderEnabled } from "@/lib/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Produce an ILLUSTRATIVE render URL for a spec (or null when disabled).
 *
 * Note the one-way data flow: a Spec goes in, an image URL comes out. The
 * response NEVER contains spec fields — the render can't feed back into a spec.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  let spec;
  try {
    spec = parseSpec((body as { spec?: unknown })?.spec);
  } catch (e) {
    if (e instanceof SpecValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const url = await renderIllustration(spec);
  return NextResponse.json({ url, enabled: isRenderEnabled() });
}
