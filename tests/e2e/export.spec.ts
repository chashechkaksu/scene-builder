import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('экспорт SVG через кнопку «Скачать SVG» скачивает валидный непустой векторный файл', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Добавить на холст: Книга' }).click()
  await page.getByRole('button', { name: 'Добавить на холст: Лампа' }).click()

  const items = page.locator('.canvas-item')
  await expect(items).toHaveCount(2)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('composition.svg')

  const filePath = await download.path()
  expect(filePath).not.toBeNull()
  if (!filePath) throw new Error('unreachable')
  const content = readFileSync(filePath, 'utf-8')

  expect(content.length).toBeGreaterThan(0)
  expect(content).toContain('<svg')
  expect(content).not.toContain('<image')
  expect(content).not.toContain('data:')
  expect(content).not.toContain('var(')
  expect(content).not.toContain('<use')

  const groupCount = (content.match(/data-object="/g) ?? []).length
  expect(groupCount).toBe(2)

  await expect(page.getByText('Не удалось собрать SVG для экспорта', { exact: false })).toHaveCount(
    0,
  )
})

test('экспорт с выключенной подложкой не содержит декоративных линий фона', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Добавить на холст: Пазл' }).click()
  await page.getByLabel('Подложка').uncheck()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG' }).click()
  const download = await downloadPromise

  const filePath = await download.path()
  if (!filePath) throw new Error('unreachable')
  const content = readFileSync(filePath, 'utf-8')

  expect(content).toMatch(/<rect[^>]*fill="#[0-9a-fA-F]{6}"/)
  expect(content).not.toContain('stroke-width="2"')
})
