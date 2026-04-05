import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter (resets on cold start)
// For production scale, replace with Upstash Redis rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// Rate limit configs per route pattern
const RATE_LIMITS: { pattern: RegExp; maxRequests: number; windowMs: number }[] = [
  // Auth: strict limits to prevent brute force
  { pattern: /^\/api\/auth\/register$/, maxRequests: 5, windowMs: 60_000 },       // 5/min
  { pattern: /^\/api\/auth\/forgot-password$/, maxRequests: 3, windowMs: 60_000 }, // 3/min
  { pattern: /^\/api\/auth\/reset-password$/, maxRequests: 5, windowMs: 60_000 },  // 5/min
  { pattern: /^\/api\/auth\/check-username$/, maxRequests: 30, windowMs: 60_000 }, // 30/min

  // AI: moderate limits to control costs
  { pattern: /^\/api\/divine$/, maxRequests: 20, windowMs: 60_000 },       // 20/min
  { pattern: /^\/api\/divine-multi$/, maxRequests: 30, windowMs: 60_000 }, // 30/min (3 masters per round)
  { pattern: /^\/api\/chart$/, maxRequests: 20, windowMs: 60_000 },        // 20/min

  // TTS: strict limits (expensive)
  { pattern: /^\/api\/tts$/, maxRequests: 15, windowMs: 60_000 },          // 15/min

  // Credits: prevent abuse
  { pattern: /^\/api\/credits\/send$/, maxRequests: 10, windowMs: 60_000 }, // 10/min

  // Case studies
  { pattern: /^\/api\/case-studies$/, maxRequests: 5, windowMs: 60_000 },  // 5/min
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Find matching rate limit config
  const config = RATE_LIMITS.find((rl) => rl.pattern.test(pathname));
  if (!config) {
    return NextResponse.next();
  }

  // Use IP + pathname as the rate limit key
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const key = `${ip}:${pathname}`;

  if (!rateLimit(key, config.maxRequests, config.windowMs)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
