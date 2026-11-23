import { getSafeModelMetadata } from "../config/model.config.js";

export function getAIHealthStatus() {
  return {
    ...getSafeModelMetadata(),
    privacyMode: "strict_metadata_allowlist_no_pii",
  };
}