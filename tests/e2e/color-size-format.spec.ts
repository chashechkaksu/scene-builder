import { expect, test } from '@playwright/test'

function parseTranslate(transform: string): { x: number; y: number } {
  const match = transform.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/)
  if (!match) throw new Error(`Не удалось разобрать transform: ${transform}`)
  return { x: Number(match[1]), y: Number(match[2]) }
}

test('смена размера L/S сохраняет позицию объекта', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Добавить на холст: Книга' }).click()
  const item = page.locator('.canvas-item').first()
  const before = parseTranslate((await item.getAttribute('transform')) ?? '')

  await page.getByRole('button', { name: 'S', exact: true }).click()
  const afterS = parseTranslate((await item.getAttribute('transform')) ?? '')
  expect(afterS).toEqual(before)

  await page.getByRole('button', { name: 'L', exact: true }).click()
  const afterL = parseTranslate((await item.getAttribute('transform')) ?? '')
  expect(afterL).toEqual(before)
})

test('смена палитры перекрашивает через CSS-переменные без перерисовки объектов', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Добавить на холст: Книга' }).click()
  await page.getByRole('button', { name: 'Добавить на холст: Ручка' }).click()

  const items = page.locator('.canvas-item')
  await expect(items).toHaveCount(2)
  const uidsBefore = await items.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('data-uid')),
  )
  const useCountBefore = await page.locator('.canvas-item use').count()

  const svg = page.locator('svg.canvas-svg')
  const bg1Before = await svg.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('--role-bg-1').trim(),
  )

  await page.locator('#toolbar-palette').selectOption('orange')

  const bg1After = await svg.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('--role-bg-1').trim(),
  )
  expect(bg1After).not.toBe(bg1Before)
  expect(bg1After.toLowerCase()).toBe('#fdd7b9')

  await expect(items).toHaveCount(2)
  const uidsAfter = await items.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-uid')))
  expect(uidsAfter).toEqual(uidsBefore)
  const useCountAfter = await page.locator('.canvas-item use').count()
  expect(useCountAfter).toBe(useCountBefore)
})

test('загрузка невалидного JSON палитры показывает понятную ошибку', async ({ page }) => {
  await page.goto('/')

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{not json'),
  })

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('JSON')
})

test('смена формата меняет viewBox холста', async ({ page }) => {
  await page.goto('/')

  const svg = page.locator('svg.canvas-svg')
  await expect(svg).toHaveAttribute('viewBox', '0 0 1000 1000')

  await page.getByRole('button', { name: 'Горизонталь' }).click()
  await expect(svg).toHaveAttribute('viewBox', '0 0 1200 630')
  await expect(page.locator('.canvas-background')).toBeVisible()

  await page.getByRole('button', { name: 'Вертикаль' }).click()
  await expect(svg).toHaveAttribute('viewBox', '0 0 800 1200')
  await expect(page.locator('.canvas-background')).toBeVisible()
})

test('выключение подложки оставляет сплошную заливку bg-1, а не пустоту', async ({ page }) => {
  await page.goto('/')

  const background = page.locator('.canvas-background')
  await expect(background).toBeVisible()
  await expect(background.locator('use')).toHaveCount(1)

  await page.getByLabel('Подложка').uncheck()

  await expect(background).toBeVisible()
  await expect(background.locator('use')).toHaveCount(0)
  await expect(background.locator('rect')).toHaveCount(1)
})

test('ползунки ширины и высоты меняют размер холста', async ({ page }) => {
  await page.goto('/')

  const svg = page.locator('svg.canvas-svg')
  await page.locator('#canvas-width').fill('1400')
  await expect(svg).toHaveAttribute('viewBox', '0 0 1400 1000')

  await page.locator('#canvas-height').fill('700')
  await expect(svg).toHaveAttribute('viewBox', '0 0 1400 700')

  await page.getByRole('button', { name: 'Квадрат' }).click()
  await expect(svg).toHaveAttribute('viewBox', '0 0 1000 1000')
})

test('перетаскивание слайдера ширины не раздувает историю undo множеством шагов', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Добавить на холст: Книга' }).click()
  const item = page.locator('.canvas-item').first()
  const beforeDrag = await item.getAttribute('transform')

  const itemBox = await item.boundingBox()
  if (!itemBox) throw new Error('unreachable')
  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(itemBox.x + itemBox.width / 2 + 40, itemBox.y + itemBox.height / 2 + 20, {
    steps: 5,
  })
  await page.mouse.up()
  const afterMove = await item.getAttribute('transform')
  expect(afterMove).not.toBe(beforeDrag)

  await page.locator('#canvas-width').evaluate((element) => {
    const input = element as HTMLInputElement
    for (let width = 410; width <= 2400; width += 10) {
      input.value = String(width)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page.locator('svg.canvas-svg')).toHaveAttribute('viewBox', '0 0 2400 1000')

  await page.keyboard.press('Control+z')
  await expect(page.locator('svg.canvas-svg')).toHaveAttribute('viewBox', '0 0 1000 1000')
  await expect(item).toHaveAttribute('transform', afterMove ?? '')

  await page.keyboard.press('Control+z')
  await expect(item).toHaveAttribute('transform', beforeDrag ?? '')
})

test('ручка у правого края холста меняет ширину', async ({ page }) => {
  await page.goto('/')

  const svg = page.locator('svg.canvas-svg')
  const handle = page.locator('.canvas-handle--right')
  const box = await handle.boundingBox()
  if (!box) throw new Error('Нет ручки изменения размера')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()

  const viewBox = (await svg.getAttribute('viewBox')) ?? ''
  const width = Number(viewBox.split(' ')[2])
  expect(width).toBeLessThan(1000)
})

test('редактор палитры открывается в окне и применяет цвета', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Редактор палитры' }).click()
  const dialog = page.getByRole('dialog', { name: 'Редактор палитры' })
  await expect(dialog).toBeVisible()

  await dialog.getByLabel('Hex-код: Фон 1').fill('#FFEEDD')
  await dialog.getByRole('button', { name: 'Применить к холсту' }).click()
  await expect(dialog).toContainText('Применено к холсту')

  await page.getByRole('button', { name: 'Закрыть редактор палитры' }).click()
  await expect(dialog).toBeHidden()
})

test('ползунок масштаба меняет масштаб холста', async ({ page }) => {
  await page.goto('/')

  const slider = page.locator('#canvas-zoom-slider')
  await slider.fill('150')
  await expect(page.locator('.canvas-zoom__value')).toHaveText('150%')
})

test('ползунок масштаба объектов меняет масштаб, «Авто» возвращает автоматический', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Добавить на холст: Книга' }).click()
  const item = page.locator('.canvas-item').first()
  const autoTransform = await item.getAttribute('transform')

  await page.locator('#object-scale').fill('0.4')
  await expect(item).toHaveAttribute('transform', /scale\(0\.4 0\.4\)/)
  await expect(page.getByText('40%')).toBeVisible()

  await page.getByRole('button', { name: 'Авто', exact: true }).click()
  await expect(item).toHaveAttribute('transform', autoTransform ?? '')
})
