/**
 * GET /api/ergoauth/request/[sessionId]
 * Wallet fetches the ErgoAuthRequest to display signing prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getErgoAuthSession,
  type ErgoAuthRequest,
} from '@/lib/ergo/ergoauth';

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
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
    const ergoAuthRequest: ErgoAuthRequest = {
      signingMessage: session.signingMessage,
      sigmaBoolean: Buffer.from(session.address).toString('base64'),
      userMessage: `Join CyberPets Race\n\nRace ID: ${session.raceId}\nYour NFT: ${session.nftTokenId.slice(0, 12)}...`,
      messageSeverity: 'INFORMATION',
      replyToUrl: `${baseUrl}/api/ergoauth/response/${sessionId}`,
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
