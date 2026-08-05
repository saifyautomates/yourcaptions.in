import { AuthHelper } from '../helpers/auth.helper';

async function setup() {
  console.log('Setting up test data...');
  await AuthHelper.createTestUsers();
  console.log('✅ Test data ready — users created');
}

setup().catch(console.error);
