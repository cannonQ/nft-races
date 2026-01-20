/**
 * GET /api/ergoauth/request/[sessionId]
 * Wallet fetches the ErgoAuthRequest to display signing prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getErgoAuthSession,
  addressToSigmaBoolean,
  type ErgoAuthRequest,
} from '@/lib/ergo/ergoauth';

function getBaseUrl(request: NextRequest): string {
  // CRITICAL: For ErgoAuth, the replyTo URL MUST be on the same host
  // that Terminus used to fetch this request. Use the request URL's origin.
  const url = new URL(request.url);

  // On Vercel, the internal URL might be different, so check headers
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  if (forwardedHost) {
    // Behind a proxy - use forwarded values
    const protocol = forwardedProto || 'https';
    return `${protocol}://${forwardedHost}`;
  }

  // Use the request URL's origin directly
  return url.origin;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const session = getErgoAuthSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { userMessage: 'Session not found. Please try again.' },
        { status: 404 }
      );
    }

    if (session.status === 'expired') {
      return NextResponse.json(
        { userMessage: 'Session expired. Please start over.' },
        { status: 410 }
      );
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { userMessage: 'Session already completed.' },
        { status: 409 }
      );
    }

    // Build the ErgoAuthRequest response
    const baseUrl = getBaseUrl(request);
    const replyToUrl = `${baseUrl}/api/ergoauth/response/${sessionId}`;

    // Debug logging
    console.log('ErgoAuth request debug:', {
      requestUrl: request.url,
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
      host: request.headers.get('host'),
      computedBaseUrl: baseUrl,
      replyToUrl,
    });

    const ergoAuthRequest: ErgoAuthRequest = {
      signingMessage: session.signingMessage,
      sigmaBoolean: addressToSigmaBoolean(session.address),
      userMessage: `Join CyberPets Race\n\nRace ID: ${session.raceId}\nYour NFT: ${session.nftTokenId.slice(0, 12)}...`,
      messageSeverity: 'INFORMATION',
      replyToUrl,
    };

    return NextResponse.json(ergoAuthRequest);

  } catch (error) {
    console.error('ErgoAuth request fetch error:', error);
    return NextResponse.json(
      { userMessage: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
