const url = process.env.VITE_SUPABASE_URL + '/auth/v1/token?grant_type=password';
console.log("Fetching:", url);
try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': process.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
} catch(e) {
  console.error("Fetch error:", e);
}
