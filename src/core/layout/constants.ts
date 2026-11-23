export const LAYOUT_CANDIDATE_COUNT = 800

type AnchorFractions = ReadonlyArray<readonly [number, number]>

export const LAYOUT_ANCHOR_FRACTIONS_SQUARE: AnchorFractions = [
  [1 / 3, 1 / 3],
  [2 / 3, 1 / 3],
  [1 / 3, 2 / 3],
  [2 / 3, 2 / 3],
  [0.5, 0.5],
]

export const LAYOUT_ANCHOR_FRACTIONS_LANDSCAPE: AnchorFractions = [
  [0.17, 0.4],
  [0.17, 0.74],
  [0.5, 0.3],
  [0.5, 0.74],
  [0.83, 0.5],
]

export const LAYOUT_ANCHOR_FRACTIONS_PORTRAIT: AnchorFractions = [
  [0.4, 0.17],
  [0.74, 0.17],
  [0.3, 0.5],
  [0.74, 0.5],
  [0.5, 0.83],
]

export const LAYOUT_LANDSCAPE_ASPECT_THRESHOLD = 1.2
export const LAYOUT_PORTRAIT_ASPECT_THRESHOLD = 1 / 1.2

export const LAYOUT_JITTER_RADIUS_RATIO = 0.16

export const LAYOUT_DENSITY_BASE_COUNT = 3
export const LAYOUT_MIN_DENSITY_SCALE = 0.5
export const LAYOUT_MAX_DENSITY_SCALE = 1.6
export const LAYOUT_ASPECT_DENSITY_MAX = 1.25

export const LAYOUT_COVERAGE_TARGET_MIN = 0.55
export const LAYOUT_COVERAGE_TARGET_MAX = 1.8

export const LAYOUT_OVERLAP_PAIR_RATIO_MIN = 0.15
export const LAYOUT_OVERLAP_PAIR_RATIO_MAX = 0.65

export const LAYOUT_MIN_CENTER_DISTANCE_RATIO = 0.35
export const LAYOUT_CENTER_BALANCE_TOLERANCE_RATIO = 0.45

export const LAYOUT_MAIN_EDGE_MARGIN_RATIO = 0.08
export const LAYOUT_MAIN_OBSCURED_AREA_RATIO = 0.75

export const LAYOUT_ZONE_COVERAGE_TARGET = 0.45
export const LAYOUT_ZONE_SAMPLE_GRID = 36
export const LAYOUT_SQUARE_ZONE_GRID = 2
export const LAYOUT_LONG_SIDE_ZONE_COUNT = 3

export const LAYOUT_MAIN_MIN_VISIBLE_RATIO = 0.95
export const LAYOUT_MAIN_COVERED_MIN_VISIBLE_RATIO = 0.7
export const LAYOUT_MAIN_MAX_MAIN_OVERLAP_RATIO = 0.15
export const LAYOUT_MAIN_MAX_COVER_OF_LARGE_RATIO = 0.4
export const LAYOUT_MAIN_OVER_BG_MAX_COVER_RATIO = 0.3
export const LAYOUT_BG_MIN_VISIBLE_RATIO = 0.5
export const LAYOUT_BG_MAX_OVERLAPPING_BACKGROUNDS = 1
export const LAYOUT_BG_MAX_GROUP_AREA_RATIO = 1.5

export const LAYOUT_SMALL_MAIN_AREA_RATIO = 0.5
export const LAYOUT_SMALL_MAIN_MAX_GAP_RATIO = 0.08
export const LAYOUT_SMALL_MAIN_MAX_OVERLAP_RATIO = 0.3

export const LAYOUT_MAIN_MAX_GAP_RATIO = 0.18

export const LAYOUT_AUTO_SCALE_MAX_AREA_RATIO = 0.5
export const LAYOUT_ROTATION_AREA_TOLERANCE = 1.15
export const LAYOUT_MAX_OBJECT_FRAME_AREA_RATIO =
  LAYOUT_AUTO_SCALE_MAX_AREA_RATIO * LAYOUT_ROTATION_AREA_TOLERANCE
export const OBJECT_SCALE_MIN = 0.3
export const OBJECT_SCALE_MAX = 1
export const OBJECT_SCALE_STEP = 0.01

export const LAYOUT_VISIBILITY_SAMPLE_GRID = 20
export const LAYOUT_VIOLATION_PENALTY = 1

export const LAYOUT_SCORE_WEIGHTS = {
  coverage: 1,
  centerBalance: 1,
  overlapRatio: 0.8,
  fullyOffFrame: 2.5,
  mainVisibility: 1.6,
  zoneBalance: 2,
  clustering: 1.8,
} as const
