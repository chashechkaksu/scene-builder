import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DOMParser, XMLSerializer, type Node as XmlDomNode } from '@xmldom/xmldom'
import {
  circleBBox,
  ellipseBBox,
  lineBBox,
  mergeBBoxes,
  pathBBox,
  pointsBBox,
  rectBBox,
  type BBox,
} from '../src/core/geometry/bbox'
import orangePalette from '../src/palettes/orange.json'
import purplePalette from '../src/palettes/purple.json'
import tealPalette from '../src/palettes/teal.json'
import { parsePalette, roleToHex, ROLES, type Palette, type Role } from '../src/core/palette/schema'
import type {
  AssetRef,
  BackgroundFrame,
  LibraryManifest,
  LibraryObject,
  ObjectState,
  Size,
} from '../src/shared/types'

const ROOT = process.cwd()
const ASSETS_SRC = join(ROOT, 'assets-src')
const LIBRARY_DIR = join(ROOT, 'src/library')

const SIZES: Size[] = ['L', 'S']
const STATES: ObjectState[] = ['main', 'bg']

const OBJECTS: ReadonlyArray<{ id: string; nameRu: string; file: string }> = [
  { id: 'book', nameRu: 'Книга', file: 'Книга.svg' },
  { id: 'phone', nameRu: 'Телефон', file: 'Телефон.svg' },
  { id: 'puzzle', nameRu: 'Пазл', file: 'Пазлы.svg' },
  { id: 'coin', nameRu: 'Монета', file: 'Монета.svg' },
  { id: 'headphones', nameRu: 'Наушники', file: 'Наушники.svg' },
  { id: 'lamp', nameRu: 'Лампа', file: 'Лампа.svg' },
  { id: 'tulips', nameRu: 'Тюльпаны', file: 'Тюльпаны.svg' },
  { id: 'wallet', nameRu: 'Кошелёк', file: 'Кошелек.svg' },
  { id: 'folder', nameRu: 'Папка', file: 'Папка.svg' },
  { id: 'pen', nameRu: 'Ручка', file: 'Ручка.svg' },
]

const PALETTES_BY_SCHEME: Record<string, Palette> = {
  purple: parsePalette(purplePalette),
  teal: parsePalette(tealPalette),
  orange: parsePalette(orangePalette),
}

const BACKGROUND_SCHEMES: ReadonlyArray<{ schemeId: string; file: string }> = [
  { schemeId: 'purple', file: 'Фон.svg' },
  { schemeId: 'teal', file: 'Фон-1.svg' },
  { schemeId: 'orange', file: 'Фон-2.svg' },
]

function roleMapFromPalette(palette: Palette): Record<string, Role> {
  const map: Record<string, Role> = {}
  for (const role of ROLES) {
    map[roleToHex(palette, role).toUpperCase()] = role
  }
  return map
}

const OBJECT_ROLE_MAP: Record<string, Role> = roleMapFromPalette(PALETTES_BY_SCHEME.purple)
const BACKGROUND_ROLE_MAP_BY_SCHEME: Record<string, Record<string, Role>> = Object.fromEntries(
  Object.entries(PALETTES_BY_SCHEME).map(([schemeId, palette]) => [
    schemeId,
    roleMapFromPalette(palette),
  ]),
)

const BG_ALLOWED_ROLES = new Set<Role>(['bg-1', 'bg-2', 'bg-3', 'ink'])
const COLOR_ATTRS = ['fill', 'stroke']
const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'])

export class BuildError extends Error {}

export interface UnclassifiedColor {
  file: string
  value: string
}

export function normalizeHex(value: string): string | undefined {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'white') return '#FFFFFF'
  const shortMatch = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(trimmed)
  if (shortMatch) {
    const [, r, g, b] = shortMatch
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  const longMatch = /^#[0-9a-f]{6}$/.exec(trimmed)
  if (longMatch) return trimmed.toUpperCase()
  return undefined
}

export function validateRawSvg(fileLabel: string, raw: string): void {
  if (/<\s*image[\s>]/i.test(raw)) {
    throw new BuildError(`${fileLabel}: найден <image>, растровые вложения запрещены`)
  }
  if (/data:(image|application)\//i.test(raw)) {
    throw new BuildError(`${fileLabel}: найден data: URI, встроенный растр запрещён`)
  }
  if (/(?:xlink:)?href\s*=\s*"https?:\/\//i.test(raw)) {
    throw new BuildError(`${fileLabel}: найдена внешняя ссылка href, запрещено`)
  }
}

export function parseSvg(fileLabel: string, raw: string): Document {
  const errors: string[] = []
  const parser = new DOMParser({
    errorHandler: (level: string, message: string) => {
      if (level === 'error' || level === 'fatalError') errors.push(message)
    },
  })
  const doc = parser.parseFromString(raw, 'image/svg+xml') as unknown as Document
  if (errors.length > 0) {
    throw new BuildError(`${fileLabel}: ошибка парсинга XML: ${errors.join('; ')}`)
  }
  return doc
}

function stripComments(node: Element | Document): void {
  const toRemove: ChildNode[] = []
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes.item(i) as ChildNode
    if (child.nodeType === 8) {
      toRemove.push(child)
    } else if (child.nodeType === 1) {
      stripComments(child as unknown as Element)
    }
  }
  for (const child of toRemove) node.removeChild(child)
}

function collectElements(root: Element): Element[] {
  const result: Element[] = []
  const stack: Element[] = [root]
  while (stack.length > 0) {
    const el = stack.pop()
    if (!el) continue
    result.push(el)
    const children = el.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children.item(i)
      if (child && child.nodeType === 1) stack.push(child as unknown as Element)
    }
  }
  return result
}

export function prefixIds(root: Element, prefix: string): void {
  const elements = collectElements(root)
  const idMap = new Map<string, string>()
  for (const el of elements) {
    const id = el.getAttribute('id')
    if (id) {
      const newId = `${prefix}${id}`
      idMap.set(id, newId)
      el.setAttribute('id', newId)
    }
  }
  if (idMap.size === 0) return
  for (const el of elements) {
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes.item(i)
      if (!attr) continue
      const value = attr.value
      const rewritten = value.replace(/url\(#([^)]+)\)/g, (match, refId: string) => {
        const mapped = idMap.get(refId)
        return mapped ? `url(#${mapped})` : match
      })
      if (rewritten !== value) el.setAttribute(attr.name, rewritten)
    }
  }
}

function isInsideDefs(el: Element): boolean {
  let current: Element | null = el.parentNode as unknown as Element | null
  while (current) {
    if (current.tagName === 'defs') return true
    current = current.parentNode as unknown as Element | null
  }
  return false
}

function shapeBBox(el: Element): BBox | undefined {
  const num = (name: string): number => Number.parseFloat(el.getAttribute(name) ?? '0')
  switch (el.tagName) {
    case 'path': {
      const d = el.getAttribute('d')
      return d ? pathBBox(d) : undefined
    }
    case 'rect':
      return rectBBox(num('x'), num('y'), num('width'), num('height'))
    case 'circle':
      return circleBBox(num('cx'), num('cy'), num('r'))
    case 'ellipse':
      return ellipseBBox(num('cx'), num('cy'), num('rx'), num('ry'))
    case 'line':
      return lineBBox(num('x1'), num('y1'), num('x2'), num('y2'))
    case 'polygon':
    case 'polyline': {
      const points = el.getAttribute('points')
      return points ? pointsBBox(points) : undefined
    }
    default:
      return undefined
  }
}

interface ProcessResult {
  roles: Role[]
  bbox: BBox
  viewBox: [number, number, number, number]
  unclassified: UnclassifiedColor[]
}

export function processDocument(
  fileLabel: string,
  doc: Document,
  prefix: string,
  options: { freezeLiteralWhite: boolean; roleMap: Record<string, Role> },
): ProcessResult {
  const root = doc.documentElement
  if (!root) throw new BuildError(`${fileLabel}: пустой документ`)

  const viewBoxAttr = root.getAttribute('viewBox')
  if (!viewBoxAttr) throw new BuildError(`${fileLabel}: отсутствует viewBox на корневом <svg>`)
  const viewBox = viewBoxAttr.split(/\s+/).map(Number) as [number, number, number, number]
  if (viewBox.length !== 4 || viewBox.some((n) => Number.isNaN(n))) {
    throw new BuildError(`${fileLabel}: некорректный viewBox "${viewBoxAttr}"`)
  }

  stripComments(doc as unknown as Element)
  prefixIds(root, prefix)

  const roles = new Set<Role>()
  const boxes: Array<BBox | undefined> = []
  const unclassified: UnclassifiedColor[] = []

  for (const el of collectElements(root)) {
    if (!SHAPE_TAGS.has(el.tagName)) continue
    const insideDefs = isInsideDefs(el)
    if (!insideDefs) boxes.push(shapeBBox(el))

    for (const attrName of COLOR_ATTRS) {
      const raw = el.getAttribute(attrName)
      if (!raw || raw === 'none' || insideDefs) continue
      const normalized = normalizeHex(raw)
      if (!normalized) {
        unclassified.push({ file: fileLabel, value: raw })
        continue
      }
      if (normalized === '#FFFFFF' && options.freezeLiteralWhite) {
        continue
      }
      const role = options.roleMap[normalized]
      if (!role) {
        unclassified.push({ file: fileLabel, value: raw })
        continue
      }
      roles.add(role)
      el.setAttribute(attrName, `var(--role-${role}, ${normalized})`)
      el.setAttribute('data-role', role)
    }
  }

  const merged = mergeBBoxes(boxes) ?? {
    x: viewBox[0],
    y: viewBox[1],
    width: viewBox[2],
    height: viewBox[3],
  }
  return { roles: [...roles], bbox: merged, viewBox, unclassified }
}

function writeSvg(doc: Document, outPath: string): void {
  mkdirSync(dirname(outPath), { recursive: true })
  const serialized = new XMLSerializer().serializeToString(doc as unknown as XmlDomNode)
  writeFileSync(outPath, serialized, 'utf8')
}

function buildObjectAsset(
  object: (typeof OBJECTS)[number],
  size: Size,
  state: ObjectState,
  unclassifiedSink: UnclassifiedColor[],
): AssetRef {
  const srcPath = join(ASSETS_SRC, size, state, object.file)
  const fileLabel = `assets-src/${size}/${state}/${object.file}`
  const raw = readFileSync(srcPath, 'utf8')
  validateRawSvg(fileLabel, raw)
  const doc = parseSvg(fileLabel, raw)
  const prefix = `${object.id}-${size}-${state}-`
  const { roles, bbox, viewBox, unclassified } = processDocument(fileLabel, doc, prefix, {
    freezeLiteralWhite: false,
    roleMap: OBJECT_ROLE_MAP,
  })
  unclassifiedSink.push(...unclassified)

  if (state === 'bg') {
    const forbidden = roles.filter((role) => !BG_ALLOWED_ROLES.has(role))
    if (forbidden.length > 0) {
      throw new BuildError(
        `${fileLabel}: у фонового объекта найдены недопустимые роли ${forbidden.join(', ')} (разрешены только bg-*/ink)`,
      )
    }
  }

  const relativeFile = `${size}/${state}/${object.id}.svg`
  writeSvg(doc, join(LIBRARY_DIR, relativeFile))
  return { file: relativeFile, viewBox, bbox, roles }
}

function buildBackgroundAsset(
  scheme: (typeof BACKGROUND_SCHEMES)[number],
  size: Size,
  unclassifiedSink: UnclassifiedColor[],
): AssetRef {
  const srcPath = join(ASSETS_SRC, 'backgrounds', size, scheme.file)
  const fileLabel = `assets-src/backgrounds/${size}/${scheme.file}`
  const raw = readFileSync(srcPath, 'utf8')
  validateRawSvg(fileLabel, raw)
  const doc = parseSvg(fileLabel, raw)
  const prefix = `bg-frame-${scheme.schemeId}-${size}-`
  const { roles, bbox, viewBox, unclassified } = processDocument(fileLabel, doc, prefix, {
    freezeLiteralWhite: true,
    roleMap: BACKGROUND_ROLE_MAP_BY_SCHEME[scheme.schemeId] ?? {},
  })
  unclassifiedSink.push(...unclassified)

  const forbidden = roles.filter((role) => !BG_ALLOWED_ROLES.has(role))
  if (forbidden.length > 0) {
    throw new BuildError(
      `${fileLabel}: у подложки найдены недопустимые роли ${forbidden.join(', ')} (разрешены только bg-*/ink)`,
    )
  }

  const relativeFile = `backgrounds/${size}/${scheme.schemeId}.svg`
  writeSvg(doc, join(LIBRARY_DIR, relativeFile))
  return { file: relativeFile, viewBox, bbox, roles }
}

const SEMANTICS_FILE = join(LIBRARY_DIR, 'semantics.ts')

export function main(): void {
  const semanticsBackup = existsSync(SEMANTICS_FILE)
    ? readFileSync(SEMANTICS_FILE, 'utf8')
    : undefined

  rmSync(LIBRARY_DIR, { recursive: true, force: true })
  mkdirSync(LIBRARY_DIR, { recursive: true })
  if (semanticsBackup !== undefined) {
    writeFileSync(SEMANTICS_FILE, semanticsBackup, 'utf8')
  }

  const unclassifiedColors: UnclassifiedColor[] = []

  const objects: LibraryObject[] = OBJECTS.map((object) => {
    const sizes = {} as LibraryObject['sizes']
    for (const size of SIZES) {
      const states = {} as Record<ObjectState, AssetRef>
      for (const state of STATES) {
        states[state] = buildObjectAsset(object, size, state, unclassifiedColors)
      }
      sizes[size] = states
    }
    return { id: object.id, nameRu: object.nameRu, sizes, meta: { keywords: [] } }
  })

  const backgrounds: BackgroundFrame[] = BACKGROUND_SCHEMES.map((scheme) => {
    const sizes = {} as Record<Size, AssetRef>
    for (const size of SIZES) {
      sizes[size] = buildBackgroundAsset(scheme, size, unclassifiedColors)
    }
    return { schemeId: scheme.schemeId, sizes }
  })

  if (unclassifiedColors.length > 0) {
    const report = unclassifiedColors.map((item) => `  - ${item.file}: ${item.value}`).join('\n')
    throw new BuildError(
      `Сборка остановлена: найдены неклассифицированные цвета, не входящие в каноническую палитру:\n${report}`,
    )
  }

  const manifest: LibraryManifest = { objects, backgrounds }
  writeFileSync(join(LIBRARY_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  const totalFiles = readdirSync(LIBRARY_DIR, { recursive: true }).length
  console.log(
    `library: собрано ${objects.length} объектов × ${SIZES.length} размера × ${STATES.length} состояния + ${backgrounds.length} подложки × ${SIZES.length} размера (${totalFiles} файлов в src/library/)`,
  )
}

const isDirectRun =
  process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/build-library.ts') ?? false
if (isDirectRun) main()
