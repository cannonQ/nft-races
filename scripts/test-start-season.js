// Quick test script for admin/seasons/start endpoint
// Run: node scripts/test-start-season.js

const BASE = 'http://localhost:3000';
const CRON_SECRET = 'cyberpets-admin-2026-xK9mP3';
const COLLECTION_ID = 'ca4a69bd-ce9d-43f3-9f05-dbc6d2f19fa5';

async function main() {
  console.log('Testing POST /api/v2/admin/seasons/start...\n');

  const res = await fetch(`${BASE}/api/v2/admin/seasons/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ collectionId: COLLECTION_ID }),
  });

  const data = await res.json();
  console.log(`Status: ${res.status}`);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
