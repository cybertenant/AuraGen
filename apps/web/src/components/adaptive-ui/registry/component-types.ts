import type React from "react";
import type {
  ApprovedComponentType,
  CanonicalFieldDefinition,
} from "../types/adaptive-ui.types";

export interface AdaptiveFieldComponentProps {
  definition: CanonicalFieldDefinition;
  helperText?: string;
  placeholder?: string;
  density: "comfortable" | "compact";
  disabled?: boolean;
}

export type ApprovedFieldComponent = React.ComponentType<AdaptiveFieldComponentProps>;

export type ApprovedComponentRegistryMap = Readonly<
  Record<ApprovedComponentType, ApprovedFieldComponent>
>;