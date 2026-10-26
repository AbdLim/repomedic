import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = /^repairs(?:\/[a-zA-Z0-9_-]+(?:\/(?:events|patch))?)?$/;

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const pathname = path.join("/");
  if (!ALLOWED.test(pathname)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isCollection = pathname === "repairs";
  if (request.method === "POST" && !isCollection) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }
  if (request.method !== "POST" && request.method !== "GET") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }
  const base = process.env.BACKEND_API_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Backend URL not configured" },
      { status: 500 },
    );
  }
  // Forbid a browser-controlled Host, token, or custom backend destination.
  const target = new URL(`/api/v1/${pathname}`, `${base.replace(/\/$/, "")}/`);
  const headers = new Headers({ Accept: "application/json, text/plain" });
  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };
  if (request.method === "POST") {
    headers.set("Content-Type", "application/json");
    // Never log this body: it may contain environment credentials.
    init.body = await request.text();
  }
  try {
    const response = await fetch(target, init);
    const contentType =
      response.headers.get("content-type") ?? "application/json";
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forward(request, context);
}
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forward(request, context);
}
