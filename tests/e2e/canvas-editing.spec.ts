import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1600, height: 1150 } })

function parseTranslateAndRotation(transform: string): { x: number; y: number; rotation: number } {
  const translateMatch = transform.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/)
  const rotateMatch = transform.match(/rotate\(([-\d.]+)\)/)
  if (!translateMatch || !rotateMatch)
    throw new Error(`Не удалось разобрать transform: ${transform}`)
  return {
    x: Number(translateMatch[1]),
    y: Number(translateMatch[2]),
    rotation: Number(rotateMatch[1]),
  }
}

test('добавление, перемещение, поворот, дублирование, удаление и смена порядка слоёв', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Добавить на холст: Книга' }).click()

  const items = page.locator('.canvas-item')
  await expect(items).toHaveCount(1)
  const bookItem = items.first()
  const bookUid = await bookItem.getAttribute('data-uid')
  expect(bookUid).toBeTruthy()

  const initialTransform = await bookItem.getAttribute('transform')
  expect(initialTransform).not.toBeNull()
  const initial = parseTranslateAndRotation(initialTransform ?? '')
  expect(initial).toMatchObject({ x: 500, y: 500, rotation: 0 })

  const itemBox = await bookItem.boundingBox()
  expect(itemBox).not.toBeNull()
  if (!itemBox) throw new Error('unreachable')
  const startX = itemBox.x + itemBox.width / 2
  const startY = itemBox.y + itemBox.height / 2
  const svgBox = await page.locator('svg.canvas-svg').boundingBox()
  const scale = (svgBox?.width ?? 1000) / 1000
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 200 * scale, startY + 300 * scale, { steps: 10 })
  await page.mouse.up()

  const movedTransform = await bookItem.getAttribute('transform')
  const moved = parseTranslateAndRotation(movedTransform ?? '')
  expect(moved.x).toBeCloseTo(initial.x + 200, 0)
  expect(moved.y).toBeCloseTo(initial.y + 300, 0)
  expect(moved.rotation).toBe(0)

  const rotateHandle = page.locator('[data-role="rotate-handle"]')
  await expect(rotateHandle).toHaveCount(1)
  const handleBox = await rotateHandle.boundingBox()
  expect(handleBox).not.toBeNull()
  if (!handleBox) throw new Error('unreachable')
  const handleX = handleBox.x + handleBox.width / 2
  const handleY = handleBox.y + handleBox.height / 2
  await page.mouse.move(handleX, handleY)
  await page.mouse.down()
  await page.keyboard.down('Shift')
  await page.mouse.move(handleX + 300, handleY, { steps: 10 })
  await page.keyboard.up('Shift')
  await page.mouse.up()

  const rotatedTransform = await bookItem.getAttribute('transform')
  const rotated = parseTranslateAndRotation(rotatedTransform ?? '')
  expect(rotated.rotation).not.toBe(0)
  expect(Math.abs(rotated.rotation % 15)).toBeLessThan(0.01)

  await page.keyboard.press('Control+d')
  await expect(items).toHaveCount(2)
  await expect(page.locator('.selection-box')).toHaveCount(1)

  await page.keyboard.press('Delete')
  await expect(items).toHaveCount(1)
  await expect(page.locator(`.canvas-item[data-uid="${bookUid}"]`)).toHaveCount(1)

  await page.getByRole('button', { name: 'Добавить на холст: Ручка' }).click()
  await expect(items).toHaveCount(2)
  const penItem = page.locator('.canvas-item').last()
  const penUid = await penItem.getAttribute('data-uid')
  expect(penUid).toBeTruthy()

  let uidsInOrder = await items.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-uid')),
  )
  expect(uidsInOrder).toEqual([bookUid, penUid])

  await page.locator(`.canvas-item[data-uid="${bookUid}"]`).click()
  await page.keyboard.press(']')
  uidsInOrder = await items.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-uid')),
  )
  expect(uidsInOrder).toEqual([penUid, bookUid])

  await page.keyboard.press('[')
  uidsInOrder = await items.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-uid')),
  )
  expect(uidsInOrder).toEqual([bookUid, penUid])
})

test('undo/redo откатывает и повторяет изменения сцены', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Добавить на холст: Лампа' }).click()
  const items = page.locator('.canvas-item')
  await expect(items).toHaveCount(1)

  await page.keyboard.press('Delete')
  await expect(items).toHaveCount(0)

  await page.keyboard.press('Control+z')
  await expect(items).toHaveCount(1)

  await page.keyboard.press('Control+Shift+z')
  await expect(items).toHaveCount(0)
})

test('клик по объекту без перемещения не создаёт лишний шаг истории undo', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Добавить на холст: Лампа' }).click()
  const items = page.locator('.canvas-item')
  await expect(items).toHaveCount(1)

  const box = await items.first().boundingBox()
  expect(box).not.toBeNull()
  if (!box) throw new Error('unreachable')
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2

  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.up()
  await page.mouse.down()
  await page.mouse.up()

  await page.keyboard.press('Control+z')
  await expect(items).toHaveCount(0)
})

test('холст остаётся отзывчивым с 50 объектами на сцене', async ({ page }) => {
  await page.goto('/')

  const addLamp = page.getByRole('button', { name: 'Добавить на холст: Лампа' })
  for (let i = 0; i < 50; i++) {
    await addLamp.click()
  }

  const items = page.locator('.canvas-item')
  await expect(items).toHaveCount(50)

  const lastItem = items.last()
  const box = await lastItem.boundingBox()
  expect(box).not.toBeNull()
  if (!box) throw new Error('unreachable')
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX + 80, centerY + 40, { steps: 5 })
  await page.mouse.up()

  const transform = await lastItem.getAttribute('transform')
  expect(transform).not.toBeNull()
})
