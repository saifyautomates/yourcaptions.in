import * as dotenv from 'dotenv';
import * as path from 'path';

// Load the .env.test file
dotenv.config({ path: path.resolve(process.cwd(), 'tests/.env.test') });

export const env = {
  BASE_URL: process.env.BASE_URL || 'https://yourcaptions.com',
  API_URL: process.env.API_URL || 'https://api.yourcaptions.com',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  RAZORPAY_TEST_KEY_ID: process.env.RAZORPAY_TEST_KEY_ID || '',
  RAZORPAY_TEST_KEY_SECRET: process.env.RAZORPAY_TEST_KEY_SECRET || '',
  STRIPE_TEST_SECRET_KEY: process.env.STRIPE_TEST_SECRET_KEY || '',
};
