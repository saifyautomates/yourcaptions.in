import { AuthHelper } from '../helpers/auth.helper';
import { DBHelper } from '../helpers/db.helper';

async function cleanup() {
  console.log('Cleaning up test data...');
  // await AuthHelper.deleteTestUsers();
  const db = new DBHelper();
  await db.cleanupTestData();
  console.log('✅ Cleanup complete — test data removed');
}

cleanup().catch(console.error);
