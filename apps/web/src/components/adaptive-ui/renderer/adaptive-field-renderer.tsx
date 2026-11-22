"use client";

import React from "react";
import {
  AdaptiveFieldReference,
  CanonicalFormDefinition,
} from "../types/adaptive-ui.types";
import { resolveApprovedComponent } from "../registry/registry-utils";

export function AdaptiveFieldRenderer({
  fieldRef,
  formDefinition,
  density,
  disabled,
}: {
  fieldRef: AdaptiveFieldReference;
  formDefinition: CanonicalFormDefinition;
  density: "comfortable" | "compact";
  disabled?: boolean;
}) {
  const canonicalField = formDefinition.fieldMap[fieldRef.fieldId];
  if (!canonicalField) {
    return (
      <div
        role="alert"
        data-testid={`adaptive-unregistered-field-${fieldRef.fieldId}`}
        className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
      >
        Blocked unknown field reference: <code>{fieldRef.fieldId}</code>
      </div>
    );
  }

  const ApprovedComponent = resolveApprovedComponent(
    canonicalField.componentType
  );
  if (!ApprovedComponent) {
    return (
      <div
        role="alert"
        data-testid={`adaptive-unregistered-component-${canonicalField.componentType}`}
        className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
      >
        Blocked unapproved component type:{" "}
        <code>{canonicalField.componentType}</code>
      </div>
    );
  }

  return (
    <ApprovedComponent
      definition={canonicalField}
      helperText={fieldRef.helperText}
      placeholder={fieldRef.placeholder}
      density={density}
      disabled={disabled}
    />
  );
}