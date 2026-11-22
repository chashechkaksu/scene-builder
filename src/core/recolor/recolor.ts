import { ROLES, roleToHex, type Palette } from '../palette/schema'

export function cssVarsFromPalette(palette: Palette): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const role of ROLES) {
    vars[`--role-${role}`] = roleToHex(palette, role)
  }
  return vars
}

export function applyPaletteToElement(element: HTMLElement | SVGElement, palette: Palette): void {
  const vars = cssVarsFromPalette(palette)
  for (const [name, value] of Object.entries(vars)) {
    element.style.setProperty(name, value)
  }
}
