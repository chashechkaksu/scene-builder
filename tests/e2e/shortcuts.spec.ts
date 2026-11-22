import { expect, test } from '@playwright/test'

test('окно горячих клавиш открывается по "?" и кнопке, закрывается по Esc', async ({ page }) => {
  await page.goto('/')

  const dialog = page.getByRole('dialog', { name: 'Горячие клавиши' })
  await expect(dialog).toBeHidden()

  await page.keyboard.press('Shift+Slash')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Отменить')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: 'Горячие клавиши' }).click()
  await expect(dialog).toBeVisible()

  await page.getByRole('button', { name: 'Закрыть окно горячих клавиш' }).click()
  await expect(dialog).toBeHidden()
})

test('"?" внутри текстового поля не открывает окно горячих клавиш', async ({ page }) => {
  await page.goto('/')

  await page.locator('#scenario-metaphor-input').fill('Вопрос?')
  await expect(page.getByRole('dialog', { name: 'Горячие клавиши' })).toBeHidden()
})
