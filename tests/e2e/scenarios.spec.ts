import { expect, test } from '@playwright/test'

test('сценарий 1: сборка композиции по метафоре показывает причины и размещает объекты', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('tab', { name: 'По метафоре' }).click()

  await page.getByLabel('Метафора или заголовок').fill('Идея, которая зажигает')
  await page.getByRole('button', { name: 'Собрать' }).click()

  const items = page.locator('.canvas-item')
  await expect(items.first()).toBeVisible()
  const itemCount = await items.count()
  expect(itemCount).toBeGreaterThanOrEqual(2)
  expect(itemCount).toBeLessThanOrEqual(5)

  await expect(page.locator('.scenario-metaphor__item-reason').first()).toBeVisible()

  const anotherLayoutButton = page.getByRole('button', { name: 'Другой вариант' })
  await expect(anotherLayoutButton).toBeEnabled()
  const transformsBefore = await items.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('transform')),
  )
  await anotherLayoutButton.click()
  const transformsAfter = await items.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('transform')),
  )
  expect(transformsAfter).not.toEqual(transformsBefore)
  await expect(items).toHaveCount(itemCount)
})

test('сценарий 2: распознавание компонентов по чипам и сборка композиции', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('tab', { name: 'По компонентам' }).click()

  await page.getByLabel('Названия компонентов').fill('книга, телефон, наушники')
  await page.getByRole('button', { name: 'Распознать' }).click()

  const chips = page.locator('.scenario-components__chip')
  await expect(chips).toHaveCount(3)
  await expect(chips).toContainText(['Книга', 'Телефон', 'Наушники'])

  await page.getByRole('button', { name: 'Собрать' }).click()

  const items = page.locator('.canvas-item')
  await expect(items).toHaveCount(3)

  const anotherLayoutButton = page.getByRole('button', { name: 'Другой вариант' })
  await expect(anotherLayoutButton).toBeEnabled()
  const transformsBefore = await items.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('transform')),
  )
  await anotherLayoutButton.click()
  const transformsAfter = await items.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('transform')),
  )
  expect(transformsAfter).not.toEqual(transformsBefore)
})

test('переключение между вкладками сценариев сохраняет каждый сценарий отдельно', async ({
  page,
}) => {
  await page.goto('/')

  const metaphorTab = page.getByRole('tab', { name: 'По метафоре' })
  const componentsTab = page.getByRole('tab', { name: 'По компонентам' })

  await expect(metaphorTab).toHaveAttribute('aria-selected', 'true')
  await expect(componentsTab).toHaveAttribute('aria-selected', 'false')

  await componentsTab.click()
  await expect(componentsTab).toHaveAttribute('aria-selected', 'true')
  await expect(metaphorTab).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByLabel('Названия компонентов')).toBeVisible()

  await metaphorTab.click()
  await expect(metaphorTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Метафора или заголовок')).toBeVisible()
})

test('сценарий 2: неизвестный компонент не блокирует распознавание остальных', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('tab', { name: 'По компонентам' }).click()
  await page.getByLabel('Названия компонентов').fill('книга, абырвалг, телефон')
  await page.getByRole('button', { name: 'Распознать' }).click()

  const chips = page.locator('.scenario-components__chip')
  await expect(chips).toHaveCount(2)
  await expect(chips).toContainText(['Книга', 'Телефон'])
  await expect(page.getByText('Не распознано: абырвалг')).toBeVisible()
})
