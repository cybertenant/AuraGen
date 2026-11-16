import { clampScore100, sanitizeFiniteNumber } from "./normalization.js";

export interface ExponentialSmoothingOptions {
  previousWeight?: number;
  currentWeight?: number;
}

/**
 * Pure exponential smoothing function:
 * SmoothedScore = 0.65 * PreviousScore + 0.35 * CurrentRawScore
 * On the first reading (previousScore === null | undefined), initializes from rawScore.
 */
export function computeSmoothedFrictionScore(
  currentRawScore: number,
  previousSmoothedScore?: number | null,
  options: ExponentialSmoothingOptions = {}
): number {
  const safeRaw = clampScore100(currentRawScore);

  if (
    previousSmoothedScore === null ||
    previousSmoothedScore === undefined ||
    !Number.isFinite(previousSmoothedScore)
  ) {
    return Number(safeRaw.toFixed(2));
  }

  const safePrev = clampScore100(previousSmoothedScore);
  const prevWeight = Math.max(
    0,
    Math.min(1, sanitizeFiniteNumber(options.previousWeight, 0.65))
  );
  const currWeight = Math.max(
    0,
    Math.min(1, sanitizeFiniteNumber(options.currentWeight, 0.35))
  );

  const totalWeight = prevWeight + currWeight;
  const normalizedPrevWeight =
    totalWeight > 0 ? prevWeight / totalWeight : 0.65;
  const normalizedCurrWeight =
    totalWeight > 0 ? currWeight / totalWeight : 0.35;

  const blended =
    normalizedPrevWeight * safePrev + normalizedCurrWeight * safeRaw;

  return Number(clampScore100(blended).toFixed(2));
}