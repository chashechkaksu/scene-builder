import { describe, expect, it } from 'vitest'
import { APP_TITLE } from '@/shared/strings'

describe('strings', () => {
  it('exposes the app title in Russian', () => {
    expect(APP_TITLE).toBe('Конструктор векторных композиций')
  })
})
