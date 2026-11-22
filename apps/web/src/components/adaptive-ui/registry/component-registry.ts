import { ApprovedComponentType } from "../types/adaptive-ui.types";
import { ApprovedComponentRegistryMap } from "./component-types";
import { AdaptiveTextField } from "../components/adaptive-text-field";
import { AdaptiveEmailField } from "../components/adaptive-email-field";
import { AdaptivePhoneField } from "../components/adaptive-phone-field";
import { AdaptiveNumberField } from "../components/adaptive-number-field";
import { AdaptiveSelectField } from "../components/adaptive-select-field";
import { AdaptiveDateField } from "../components/adaptive-date-field";
import { AdaptiveTextareaField } from "../components/adaptive-textarea-field";
import { AdaptiveRadioField } from "../components/adaptive-radio-field";
import { AdaptiveCheckboxField } from "../components/adaptive-checkbox-field";

/**
 * Explicit, frozen allowlist of approved React field components.
 * Never dynamically imports or evaluates arbitrary component names from JSON.
 */
export const APPROVED_COMPONENT_REGISTRY: ApprovedComponentRegistryMap =
  Object.freeze({
    text: AdaptiveTextField,
    email: AdaptiveEmailField,
    phone: AdaptivePhoneField,
    number: AdaptiveNumberField,
    select: AdaptiveSelectField,
    date: AdaptiveDateField,
    textarea: AdaptiveTextareaField,
    radio: AdaptiveRadioField,
    checkbox: AdaptiveCheckboxField,
  });

export const APPROVED_COMPONENT_TYPES: readonly ApprovedComponentType[] =
  Object.freeze(
    Object.keys(APPROVED_COMPONENT_REGISTRY) as ApprovedComponentType[]
  );