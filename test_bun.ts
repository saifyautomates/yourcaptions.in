globalThis.Deno = {
  env: { get: (k) => process.env[k], set: (k,v) => process.env[k]=v },
  serve: (handler) => { console.log("Handler registered"); }
};
await import('./supabase/functions/admin-api/index.ts');
