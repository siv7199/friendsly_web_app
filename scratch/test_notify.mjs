

async function testEdgeFunction() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/super-worker`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("Calling", url);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'apikey': key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fullName: "Test User",
      email: "sid.vangara@gmail.com",
      phone: "1234567890",
      notes: "Testing notification",
      createdAt: new Date().toISOString(),
      reviewToken: "test_token_123"
    })
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

testEdgeFunction().catch(console.error);
