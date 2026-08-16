import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { logger, getRequestId } from '@/lib/logger';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  const start = Date.now();
  const url = env.supabaseUrl;
  const key = env.supabaseAnonKey;

  if (!url || !key) {
    logger.error('health_check_config_missing', { requestId, message: 'Missing Supabase env vars' });
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
      logger.warn('health_check_supabase_unreachable', { requestId, metadata: { status: res.status, latency_ms: latencyMs } });
      return NextResponse.json(
        { status: 'error', supabase: res.status, latencyMs },
        { status: 503 },
      );
    }

    logger.info('health_check_ok', { requestId, metadata: { latency_ms: latencyMs } });
    return NextResponse.json({
      status: 'ok',
      supabase: 'reachable',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('health_check_failed', { requestId, error: err as Error, metadata: { latency_ms: Date.now() - start }, message: 'Service unavailable' });
    return NextResponse.json(
      { status: 'error', message: 'Service indisponible', latencyMs: Date.now() - start },
      { status: 503 },
    );
  }
}