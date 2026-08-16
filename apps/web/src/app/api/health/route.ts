import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const runtime = 'edge';

export async function GET() {
  const start = Date.now();
  const url = env.supabaseUrl;
  const key = env.supabaseAnonKey;

  if (!url || !key) {
    return NextResponse.json(
      { status: 'error', message: 'Missing Supabase env vars' },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return NextResponse.json(
        { status: 'error', supabase: res.status, latencyMs },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: 'ok',
      supabase: 'reachable',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: String(err), latencyMs: Date.now() - start },
      { status: 503 },
    );
  }
}
