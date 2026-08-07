require('dotenv').config();
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const payload = anonKey.split('.')[1];
const decoded = Buffer.from(payload, 'base64').toString('utf8');
console.log(decoded);
