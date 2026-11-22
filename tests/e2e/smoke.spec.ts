import { expect, test } from '@playwright/test'

test('app shell renders the title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Конструктор векторных композиций' })).toBeVisible()
})
