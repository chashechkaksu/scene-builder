import { describe, expect, it } from 'vitest'
import { circleBBox, lineBBox, pathBBox, pointsBBox, rectBBox } from '@/core/geometry/bbox'

describe('core/geometry/bbox', () => {
  it('computes bbox for a straight-line path', () => {
    const box = pathBBox('M0 0 L10 0 L10 10 L0 10 Z')
    expect(box).toEqual({ x: 0, y: 0, width: 10, height: 10 })
  })

  it('supports relative commands', () => {
    const box = pathBBox('m5 5 l10 0 l0 10 z')
    expect(box).toEqual({ x: 5, y: 5, width: 10, height: 10 })
  })

  it('includes cubic bezier control points as a safe upper bound', () => {
    const box = pathBBox('M0 0 C0 20 20 20 20 0')
    expect(box?.x).toBe(0)
    expect(box?.width).toBe(20)
    expect(box?.height).toBe(20)
  })

  it('computes bbox for primitives', () => {
    expect(rectBBox(1, 2, 3, 4)).toEqual({ x: 1, y: 2, width: 3, height: 4 })
    expect(circleBBox(10, 10, 5)).toEqual({ x: 5, y: 5, width: 10, height: 10 })
    expect(lineBBox(0, 0, 10, 5)).toEqual({ x: 0, y: 0, width: 10, height: 5 })
    expect(pointsBBox('0,0 10,0 10,10 0,10')).toEqual({ x: 0, y: 0, width: 10, height: 10 })
  })

  it('returns undefined for an empty path', () => {
    expect(pathBBox('')).toBeUndefined()
  })
})
