export const LAYOUT_CANDIDATE_COUNT = 200

export const LAYOUT_ANCHOR_FRACTIONS: ReadonlyArray<readonly [number, number]> = [
  [1 / 3, 1 / 3],
  [2 / 3, 1 / 3],
  [1 / 3, 2 / 3],
  [2 / 3, 2 / 3],
  [0.5, 0.5],
]

export const LAYOUT_JITTER_RADIUS_RATIO = 0.16

export const LAYOUT_MAX_ROTATION_DEG = 18

export const LAYOUT_DENSITY_BASE_COUNT = 3

export const LAYOUT_MIN_DENSITY_SCALE = 0.5
export const LAYOUT_MAX_DENSITY_SCALE = 1.6

export const LAYOUT_COVERAGE_TARGET_MIN = 0.55
export const LAYOUT_COVERAGE_TARGET_MAX = 1.8

export const LAYOUT_OVERLAP_PAIR_RATIO_MIN = 0.15
export const LAYOUT_OVERLAP_PAIR_RATIO_MAX = 0.65

export const LAYOUT_MIN_CENTER_DISTANCE_RATIO = 0.35

export const LAYOUT_CENTER_BALANCE_TOLERANCE_RATIO = 0.45

export const LAYOUT_MAIN_EDGE_MARGIN_RATIO = 0.08

export const LAYOUT_MAIN_OBSCURED_AREA_RATIO = 0.75

export const LAYOUT_SCORE_WEIGHTS = {
  coverage: 1,
  centerBalance: 1,
  overlapRatio: 0.8,
  fullyOffFrame: 2.5,
  mainVisibility: 1.6,
  clustering: 1.8,
} as const
