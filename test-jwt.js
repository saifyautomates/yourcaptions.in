const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const payloadStr = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
console.log(payloadStr);
try {
  const parsed = JSON.parse(atob(payloadStr));
  console.log("Parsed:", parsed);
} catch (e) {
  console.error("Error:", e);
}
