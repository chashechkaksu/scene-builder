export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

interface Accumulator {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function createAccumulator(): Accumulator {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
}

function extend(acc: Accumulator, x: number, y: number): void {
  if (x < acc.minX) acc.minX = x
  if (y < acc.minY) acc.minY = y
  if (x > acc.maxX) acc.maxX = x
  if (y > acc.maxY) acc.maxY = y
}

function toBBox(acc: Accumulator): BBox | undefined {
  if (!Number.isFinite(acc.minX) || !Number.isFinite(acc.minY)) return undefined
  return { x: acc.minX, y: acc.minY, width: acc.maxX - acc.minX, height: acc.maxY - acc.minY }
}

function mergeBBox(a: BBox | undefined, b: BBox | undefined): BBox | undefined {
  if (!a) return b
  if (!b) return a
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.width, b.x + b.width)
  const maxY = Math.max(a.y + a.height, b.y + b.height)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function pathBBox(d: string): BBox | undefined {
  const acc = createAccumulator()
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  let i = 0
  let cmd = ''
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0

  const readNum = (): number => Number.parseFloat(tokens[i++] ?? '0')

  while (i < tokens.length) {
    const token = tokens[i]
    if (token !== undefined && /[a-zA-Z]/.test(token)) {
      cmd = token
      i++
    }
    const isRelative = cmd === cmd.toLowerCase()
    const upper = cmd.toUpperCase()

    switch (upper) {
      case 'M': {
        const x = readNum()
        const y = readNum()
        cx = isRelative ? cx + x : x
        cy = isRelative ? cy + y : y
        startX = cx
        startY = cy
        extend(acc, cx, cy)
        cmd = isRelative ? 'l' : 'L'
        break
      }
      case 'L': {
        const x = readNum()
        const y = readNum()
        cx = isRelative ? cx + x : x
        cy = isRelative ? cy + y : y
        extend(acc, cx, cy)
        break
      }
      case 'H': {
        const x = readNum()
        cx = isRelative ? cx + x : x
        extend(acc, cx, cy)
        break
      }
      case 'V': {
        const y = readNum()
        cy = isRelative ? cy + y : y
        extend(acc, cx, cy)
        break
      }
      case 'C': {
        const x1 = isRelative ? cx + readNum() : readNum()
        const y1 = isRelative ? cy + readNum() : readNum()
        const x2 = isRelative ? cx + readNum() : readNum()
        const y2 = isRelative ? cy + readNum() : readNum()
        const x = isRelative ? cx + readNum() : readNum()
        const y = isRelative ? cy + readNum() : readNum()
        extend(acc, x1, y1)
        extend(acc, x2, y2)
        extend(acc, x, y)
        cx = x
        cy = y
        break
      }
      case 'S':
      case 'Q': {
        const x1 = isRelative ? cx + readNum() : readNum()
        const y1 = isRelative ? cy + readNum() : readNum()
        const x = isRelative ? cx + readNum() : readNum()
        const y = isRelative ? cy + readNum() : readNum()
        extend(acc, x1, y1)
        extend(acc, x, y)
        cx = x
        cy = y
        break
      }
      case 'T': {
        const x = isRelative ? cx + readNum() : readNum()
        const y = isRelative ? cy + readNum() : readNum()
        extend(acc, x, y)
        cx = x
        cy = y
        break
      }
      case 'A': {
        readNum()
        readNum()
        readNum()
        readNum()
        readNum()
        const x = isRelative ? cx + readNum() : readNum()
        const y = isRelative ? cy + readNum() : readNum()
        extend(acc, x, y)
        cx = x
        cy = y
        break
      }
      case 'Z': {
        cx = startX
        cy = startY
        break
      }
      default: {
        i++
        break
      }
    }
  }

  return toBBox(acc)
}

export function rectBBox(x: number, y: number, width: number, height: number): BBox {
  return { x, y, width, height }
}

export function circleBBox(cx: number, cy: number, r: number): BBox {
  return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }
}

export function ellipseBBox(cx: number, cy: number, rx: number, ry: number): BBox {
  return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
}

export function lineBBox(x1: number, y1: number, x2: number, y2: number): BBox {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

export function pointsBBox(points: string): BBox | undefined {
  const nums = points.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? []
  const acc = createAccumulator()
  for (let i = 0; i + 1 < nums.length; i += 2) {
    extend(acc, nums[i] ?? 0, nums[i + 1] ?? 0)
  }
  return toBBox(acc)
}

export function mergeBBoxes(boxes: Array<BBox | undefined>): BBox | undefined {
  return boxes.reduce<BBox | undefined>((acc, box) => mergeBBox(acc, box), undefined)
}
