import { itemTransform, sliceTransform, type Rect } from '@/features/canvas/geometry'
import { ROLES, roleToHex, type Palette, type Role } from '@/core/palette/schema'
import { resolveFormat, type FormatDefinition } from '@/shared/formats'
import type { ObjectState, Scene, Size } from '@/shared/types'

const EXPORT_CLIP_ID = 'export-clip'
const COLOR_ATTRS = ['fill', 'stroke'] as const
const ROLE_VAR_PATTERN = /^var\(--role-([a-z0-9-]+)\s*,\s*#[0-9a-fA-F]{6}\)$/i

export interface SymbolMarkup {
  viewBox: [number, number, number, number]
  innerMarkup: string
}

export interface ExportAssetSource {
  getObjectSymbol(objectId: string, size: Size, state: ObjectState): SymbolMarkup | undefined
  getObjectBBox(objectId: string, size: Size, state: ObjectState): Rect | undefined
  getBackgroundSymbol(): SymbolMarkup | undefined
}

function collectElements(root: Element): Element[] {
  const result: Element[] = []
  const stack: Element[] = [root]
  while (stack.length > 0) {
    const el = stack.pop()
    if (!el) continue
    result.push(el)
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children.item(i)
      if (child) stack.push(child)
    }
  }
  return result
}

function prefixInstanceIds(elements: Element[], idPrefix: string): void {
  const idMap = new Map<string, string>()
  for (const el of elements) {
    const id = el.getAttribute('id')
    if (!id) continue
    const newId = `${idPrefix}${id}`
    idMap.set(id, newId)
    el.setAttribute('id', newId)
  }
  if (idMap.size === 0) return
  for (const el of elements) {
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes.item(i)
      if (!attr) continue
      const rewritten = attr.value.replace(/url\(#([^)]+)\)/g, (match, refId: string) => {
        const mapped = idMap.get(refId)
        return mapped ? `url(#${mapped})` : match
      })
      if (rewritten !== attr.value) el.setAttribute(attr.name, rewritten)
    }
  }
}

function resolveRoleVar(value: string, palette: Palette): string | undefined {
  const match = ROLE_VAR_PATTERN.exec(value.trim())
  if (!match) return undefined
  const role = match[1]
  if (!role || !(ROLES as readonly string[]).includes(role)) {
    throw new Error(`core/export: неизвестная роль цвета "${String(role)}" в разметке объекта`)
  }
  return roleToHex(palette, role as Role)
}

function resolveInstanceColors(elements: Element[], palette: Palette): void {
  for (const el of elements) {
    for (const attrName of COLOR_ATTRS) {
      const raw = el.getAttribute(attrName)
      if (!raw) continue
      const resolved = resolveRoleVar(raw, palette)
      if (resolved !== undefined) el.setAttribute(attrName, resolved)
    }
    if (el.hasAttribute('data-role')) el.removeAttribute('data-role')
  }
}

function serializeChildren(root: Element): string {
  const serializer = new XMLSerializer()
  let result = ''
  for (let i = 0; i < root.childNodes.length; i++) {
    const node = root.childNodes.item(i)
    if (!node) continue
    if (node.nodeType === Node.ELEMENT_NODE) {
      result += serializer.serializeToString(node)
    } else if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? ''
    }
  }
  return result
}

function parseFragment(innerMarkup: string): Element {
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${innerMarkup}</svg>`
  const doc = new DOMParser().parseFromString(wrapped, 'image/svg+xml')
  const root = doc.documentElement
  if (!root) throw new Error('core/export: не удалось разобрать разметку объекта')
  const parseError = root.querySelector('parsererror')
  if (parseError) {
    throw new Error(
      `core/export: ошибка парсинга разметки объекта: ${parseError.textContent ?? ''}`,
    )
  }
  return root
}

function renderSymbolInstance(symbol: SymbolMarkup, palette: Palette, idPrefix: string): string {
  const root = parseFragment(symbol.innerMarkup)
  const elements = collectElements(root)
  prefixInstanceIds(elements, idPrefix)
  resolveInstanceColors(elements, palette)
  return serializeChildren(root)
}

function renderBackground(
  palette: Palette,
  showBackground: boolean,
  assets: ExportAssetSource,
  format: FormatDefinition,
): string {
  const symbol = showBackground ? assets.getBackgroundSymbol() : undefined
  if (!symbol) {
    const bg1 = roleToHex(palette, 'bg-1')
    return `<rect x="0" y="0" width="${format.width}" height="${format.height}" fill="${bg1}" />`
  }
  const [, , viewWidth, viewHeight] = symbol.viewBox
  const transform = sliceTransform(viewWidth, viewHeight, {
    x: 0,
    y: 0,
    width: format.width,
    height: format.height,
  })
  const content = renderSymbolInstance(symbol, palette, 'bgframe-')
  return `<g transform="${transform}">${content}</g>`
}

function renderObjectGroup(
  item: Scene['items'][number],
  index: number,
  scene: Scene,
  palette: Palette,
  assets: ExportAssetSource,
): string {
  const symbol = assets.getObjectSymbol(item.objectId, scene.size, item.state)
  const bbox = assets.getObjectBBox(item.objectId, scene.size, item.state)
  if (!symbol || !bbox) {
    throw new Error(
      `core/export: не найден ассет объекта "${item.objectId}" (${scene.size}/${item.state})`,
    )
  }
  const transform = itemTransform(item, bbox)
  const content = renderSymbolInstance(symbol, palette, `obj${index}-`)
  const groupId = `obj-${item.objectId}-${index}`
  return `<g id="${groupId}" data-object="${item.objectId}" data-state="${item.state}" transform="${transform}">${content}</g>`
}

export function exportSceneToSvg(
  scene: Scene,
  palette: Palette,
  showBackground: boolean,
  assets: ExportAssetSource,
): string {
  const format = resolveFormat(scene)
  const backgroundMarkup = renderBackground(palette, showBackground, assets, format)
  const objectGroups = scene.items.map((item, index) =>
    renderObjectGroup(item, index, scene, palette, assets),
  )

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${format.width} ${format.height}" width="${format.width}" height="${format.height}">`,
    `<defs><clipPath id="${EXPORT_CLIP_ID}"><rect x="0" y="0" width="${format.width}" height="${format.height}" /></clipPath></defs>`,
    `<g clip-path="url(#${EXPORT_CLIP_ID})">`,
    backgroundMarkup,
    ...objectGroups,
    '</g>',
    '</svg>',
  ].join('')
}
