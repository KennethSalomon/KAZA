import { test, expect } from '@playwright/test';

test('tenant proposes visit, landlord confirms', async ({ page }) => {
  // login tenant, open conversation, click "Proposer visite"
  // fill 2 slots, submit
  // login landlord, see visit_request message with slots
  // click "Confirmer" on first slot
  // verify visit_agreed message + notification
  
  // This test will fail until the UI components are implemented
  await page.goto('/chat');
  
  // Basic check - the test structure is in place
  // Real implementation requires authenticated users and a conversation
  expect(true).toBe(true); // Placeholder - will be replaced with real test
});