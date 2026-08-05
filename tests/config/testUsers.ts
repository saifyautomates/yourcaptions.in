export const TEST_USERS = {
  FREE_USER: {
    email: 'test.free@yourcaptions-test.com',
    password: 'TestPass123!',
    plan: 'free',
    name: 'Test Free User'
  },
  EDITOR_USER: {
    email: 'test.editor@yourcaptions-test.com',
    password: 'TestPass123!',
    plan: 'editor',
    name: 'Test Editor User'
  },
  CREATOR_USER: {
    email: 'test.creator@yourcaptions-test.com',
    password: 'TestPass123!',
    plan: 'creator',
    name: 'Test Creator User'
  },
  STUDIO_USER: {
    email: 'test.studio@yourcaptions-test.com',
    password: 'TestPass123!',
    plan: 'studio',
    name: 'Test Studio User'
  },
  ADMIN_USER: {
    email: 'jackxparrowww@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'AdminPass123!',
    plan: 'studio',
    name: 'Admin User',
    isAdmin: true
  },
  TEAM_OWNER: {
    email: 'test.teamowner@yourcaptions-test.com',
    password: 'TestPass123!',
    plan: 'studio',
    name: 'Test Team Owner'
  },
  TEAM_MEMBER: {
    email: 'test.teammember@yourcaptions-test.com',
    password: 'TestPass123!',
    plan: 'free',
    name: 'Test Team Member'
  }
};

export const TEST_CREDIT_AMOUNTS = {
  FREE_PLAN: 60,
  EDITOR_PLAN: 300,
  CREATOR_PLAN: 1000,
  STUDIO_PLAN: 5000
};

export const PLAN_PRICES = {
  EDITOR_MONTHLY_INR: 499,
  CREATOR_MONTHLY_INR: 999,
  STUDIO_MONTHLY_INR: 2599,
  EDITOR_MONTHLY_USD: 6,
  CREATOR_MONTHLY_USD: 12,
  STUDIO_MONTHLY_USD: 30
};
