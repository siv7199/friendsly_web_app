async function test() {
  const response = await fetch("http://localhost:3000/api/creator-signup-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Test User",
      email: "test_" + Date.now() + "@example.com",
      phone: "1234567890",
      socialLink: "https://instagram.com/test",
      notes: "testing logs from script"
    })
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
