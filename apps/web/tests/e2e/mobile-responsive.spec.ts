import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'iPhone 13 (390x844)', width: 390, height: 844 },
  { name: 'iPhone 15 Pro Max (430x932)', width: 430, height: 932 },
  { name: 'iPad Portrait (768x1024)', width: 768, height: 1024 },
  { name: 'MacBook (1440x900)', width: 1440, height: 900 },
];

const ROUTES = [
  '/',
  '/imports',
  '/orders',
  '/suppliers',
  '/pharmacies',
  '/regulatory',
  '/traceability',
];

for (const vp of VIEWPORTS) {
  test.describe(`Mobile & Responsive Layout: ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test(`verifies route "${route}" has zero horizontal overflow`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        // Check horizontal overflow
        const overflow = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
          };
        });

        expect(overflow.hasOverflow).toBe(false);
      });
    }

    if (vp.width < 1024) {
      test('verifies mobile drawer navigation opens and closes smoothly', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        // Hamburger button should be visible on mobile/tablet
        const menuBtn = page.getByRole('button', { name: /Open navigation/i });
        await expect(menuBtn).toBeVisible();

        // Open menu
        await menuBtn.click();
        const dialog = page.getByRole('dialog', { name: 'Navigation' });
        await expect(dialog).toBeVisible();

        // Close menu via drawer close button
        const closeBtn = dialog.getByLabel('Close navigation');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await expect(dialog).not.toBeVisible();
      });
    }
  });
}
