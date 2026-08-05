import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Simple polyfill to load .env since we might not run with --env-file
try {
  const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
} catch (e) {
  console.log('No .env file found or could not read it.');
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY in environment");
  process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
  console.log(`Testing connection to Supabase...`);
  console.log(`URL: ${url}`);
  console.log(`Key Prefix: ${key.substring(0, 15)}...`);
  
  console.log('\n1. Testing Auth Session...');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("❌ Session fetch error:", sessionError.message);
  } else {
    console.log("✅ Session fetch successful. Current session:", sessionData.session ? "Active" : "None");
  }
  
  console.log('\n2. Testing Database (projects table)...');
  const { data: projectsData, error: projectsError } = await supabase.from('projects').select('id').limit(1);
  if (projectsError) {
    console.error("❌ Projects fetch error:", projectsError.message, projectsError.code, projectsError.details);
  } else {
    console.log("✅ Projects fetch successful. Table 'projects' is accessible.");
  }
}

testConnection();
