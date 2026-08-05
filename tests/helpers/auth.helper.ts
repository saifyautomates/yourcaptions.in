import { createClient } from '@supabase/supabase-js';
import { TEST_USERS } from '../config/testUsers';
import { env } from '../config/env.test';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export class AuthHelper {
  static async createTestUsers(): Promise<void> {
    for (const user of Object.values(TEST_USERS)) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });
      if (error) console.error(`Failed to create ${user.email}`, error);
    }
  }

  static async deleteTestUsers(): Promise<void> {
    for (const user of Object.values(TEST_USERS)) {
      const { data } = await supabase.from('profiles').select('id').eq('email', user.email).single();
      if (data) {
        await supabase.auth.admin.deleteUser(data.id);
      }
    }
  }

  static async getToken(email: string, password: string): Promise<string> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error('Failed to get token');
    return data.session.access_token;
  }

  static async getAuthHeaders(userKey: keyof typeof TEST_USERS): Promise<Record<string, string>> {
    const user = TEST_USERS[userKey];
    const token = await this.getToken(user.email, user.password);
    return { Authorization: `Bearer ${token}` };
  }

  static async verifyAdminRedirect(email: string): Promise<boolean> {
    const { data } = await supabase.from('profiles').select('is_admin').eq('email', email).single();
    return !!data?.is_admin;
  }

  static async setUserPlan(email: string, plan: string): Promise<void> {
    await supabase.from('profiles').update({ plan }).eq('email', email);
  }

  static async getUserProfile(email: string): Promise<any> {
    const { data } = await supabase.from('profiles').select('*').eq('email', email).single();
    return data;
  }

  static async saveAuthState(page: any, userKey: string): Promise<void> {
    await page.context().storageState({ path: `tests/auth-states/${userKey}.json` });
  }

  static async loadAuthState(browser: any, userKey: string): Promise<any> {
    return await browser.newContext({ storageState: `tests/auth-states/${userKey}.json` });
  }
}
