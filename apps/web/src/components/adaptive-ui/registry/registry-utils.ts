import { ApprovedComponentType } from "../types/adaptive-ui.types";
import { APPROVED_COMPONENT_REGISTRY } from "./component-registry";
import { ApprovedFieldComponent } from "./component-types";

export function isApprovedComponentType(
  componentType: unknown
): componentType is ApprovedComponentType {
  return (
    typeof componentType === "string" &&
    Object.prototype.hasOwnProperty.call(
      APPROVED_COMPONENT_REGISTRY,
      componentType
    )
  );
}

export function resolveApprovedComponent(
  componentType: unknown
): ApprovedFieldComponent | null {
  if (!isApprovedComponentType(componentType)) {
    return null;
  }
  return APPROVED_COMPONENT_REGISTRY[componentType];
}