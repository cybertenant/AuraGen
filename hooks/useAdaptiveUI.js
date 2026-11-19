
"use client";

import { useMemo } from "react";

export default function useAdaptiveUI(cognitiveLoad, fieldData) {
    return useMemo(() => {
        const score = cognitiveLoad?.score || 0;

        const currentField = fieldData?.field || "";
        const currentSection = fieldData?.section || "";

        let level = "low";

        if (score >= 60) {
            level = "high";
        } else if (score >= 25) {
            level = "moderate";
        }

        const guidance = {
            personal: {
                fullName: {
                    moderate: "Enter your full name as it appears on official documents.",
                    high: "Enter your first name and last name. Check the spelling before continuing.",
                },
                phone: {
                    moderate: "Enter your active contact number.",
                    high: "Enter your phone number carefully. Check every digit before moving ahead.",
                },
                email: {
                    moderate: "Use an email address you can access.",
                    high: "Enter a valid email address, for example: name@example.com.",
                },
                dateOfBirth: {
                    moderate: "Select your date of birth.",
                    high: "Choose your birth date from the date selector and verify it.",
                },
                address: {
                    moderate: "Enter your current residential address.",
                    high: "Enter your house number, street, area and city.",
                },
            },
        };

        const fieldGuidance =
            guidance[currentSection]?.[currentField];

        let message = "";

        if (fieldGuidance && level === "moderate") {
            message = fieldGuidance.moderate;
        } else if (fieldGuidance && level === "high") {
            message = fieldGuidance.high;
        }

        return {
            level,
            section: currentSection,
            field: currentField,
            message,
            isAdaptive: Boolean(message),
        };
    }, [
        cognitiveLoad?.score,
        fieldData?.section,
        fieldData?.field,
    ]);
}
