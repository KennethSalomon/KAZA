import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getRequestId } from '@/lib/logger';

interface CSPReport {
  'csp-report': {
    'document-uri': string;
    referrer: string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    disposition: 'enforce' | 'report';
    'blocked-uri': string;
    'line-number': number;
    'column-number': number;
    'source-file': string;
    'status-code': number;
    'script-sample': string;
  };
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);

  try {
    const body = (await request.json()) as CSPReport;
    const report = body['csp-report'];

    if (!report) {
      return NextResponse.json({ error: 'Invalid CSP report' }, { status: 400 });
    }

    const logData = {
      request_id: requestId,
      type: 'csp_violation',
      document_uri: report['document-uri'],
      referrer: report.referrer,
      violated_directive: report['violated-directive'],
      effective_directive: report['effective-directive'],
      blocked_uri: report['blocked-uri'],
      line_number: report['line-number'],
      column_number: report['column-number'],
      source_file: report['source-file'],
      status_code: report['status-code'],
      disposition: report.disposition,
    };

    Sentry.captureMessage('CSP Violation', {
      level: 'warning',
      extra: logData,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}