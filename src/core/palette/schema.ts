import { z } from 'zod'

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ожидается hex-цвет вида #RRGGBB')

export const paletteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  background: z.object({
    bg1: hexColor,
    bg2: hexColor,
    bg3: hexColor,
    ink: hexColor,
  }),
  object: z.object({
    obj1: hexColor,
    obj2: hexColor,
    obj3: hexColor,
    white: hexColor,
  }),
})

export type Palette = z.infer<typeof paletteSchema>

export const ROLES = ['bg-1', 'bg-2', 'bg-3', 'ink', 'obj-1', 'obj-2', 'obj-3', 'white'] as const
export type Role = (typeof ROLES)[number]

export function roleToHex(palette: Palette, role: Role): string {
  switch (role) {
    case 'bg-1':
      return palette.background.bg1
    case 'bg-2':
      return palette.background.bg2
    case 'bg-3':
      return palette.background.bg3
    case 'ink':
      return palette.background.ink
    case 'obj-1':
      return palette.object.obj1
    case 'obj-2':
      return palette.object.obj2
    case 'obj-3':
      return palette.object.obj3
    case 'white':
      return palette.object.white
  }
}

export function parsePalette(data: unknown): Palette {
  return paletteSchema.parse(data)
}
