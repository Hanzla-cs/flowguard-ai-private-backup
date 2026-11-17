import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Read-only delivery of the original checked-in artifacts. No upload endpoint. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  if (asset !== "csv" && asset !== "manifest")
    return new Response("Not found", { status: 404 });
  const file = `flowguard-paired-wait-shift-v1.${asset === "csv" ? "csv" : "manifest.json"}`;
  const bytes = await readFile(join(process.cwd(), "data", "synthetic", file));
  return new Response(bytes, {
    headers: {
      "Content-Type":
        asset === "csv" ? "text/csv; charset=utf-8" : "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
