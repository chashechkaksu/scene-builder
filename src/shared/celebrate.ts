import confetti from 'canvas-confetti'

const PASTEL_CONFETTI_COLORS = ['#D7CDF5', '#AA9BF0', '#FDD7B9', '#FAC896', '#BEEBEB', '#80DADA']

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function celebrateComposition(): void {
  if (typeof window === 'undefined' || prefersReducedMotion()) return
  void confetti({
    particleCount: 60,
    spread: 70,
    startVelocity: 32,
    scalar: 0.8,
    ticks: 140,
    origin: { x: 0.5, y: 0.32 },
    colors: PASTEL_CONFETTI_COLORS,
    disableForReducedMotion: true,
  })
}
