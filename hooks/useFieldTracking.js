
"use client";

import { useEffect, useRef, useState } from "react";

export default function useFieldTracking() {
    const [fieldData, setFieldData] = useState({
        section: "",
        field: "",
        interactionCount: 0,
        typingCount: 0,
        blurCount: 0,
        totalInteractionCount: 0,
        lastInteraction: "",
        timeSpentMs: 0,
        fieldTimes: {},
        fieldFocusCounts: {},
    });

    const activeField = useRef(null);
    const fieldStartTime = useRef(null);

    useEffect(() => {
        const getFieldDetails = (event) => {
            const target = event.target;

            if (!target || !target.dataset) return null;

            const section = target.dataset.section;
            const field = target.dataset.field;

            if (!section || !field) return null;

            return { section, field };
        };

        const handleFieldFocus = (event) => {
            const details = getFieldDetails(event);
            if (!details) return;

            activeField.current = details;
            fieldStartTime.current = performance.now();

            const fieldKey = `${details.section}.${details.field}`;

            setFieldData((previous) => ({
                ...previous,
                section: details.section,
                field: details.field,
                interactionCount: previous.interactionCount + 1,
                totalInteractionCount:
                    previous.totalInteractionCount + 1,
                lastInteraction: "focus",
                fieldFocusCounts: {
                    ...previous.fieldFocusCounts,
                    [fieldKey]:
                        (previous.fieldFocusCounts[fieldKey] || 0) + 1,
                },
            }));

            console.log("AuraGen Field Focus:", details);
        };

        const handleFieldTyping = (event) => {
            const details = getFieldDetails(event);
            if (!details) return;

            setFieldData((previous) => ({
                ...previous,
                section: details.section,
                field: details.field,
                typingCount: previous.typingCount + 1,
                totalInteractionCount:
                    previous.totalInteractionCount + 1,
                lastInteraction: "typing",
            }));

            console.log("AuraGen Field Typing:", details);
        };

        const handleFieldBlur = (event) => {
            const details = getFieldDetails(event);
            if (!details) return;

            let duration = 0;

            if (
                activeField.current &&
                activeField.current.section === details.section &&
                activeField.current.field === details.field &&
                fieldStartTime.current !== null
            ) {
                duration = Math.round(
                    performance.now() - fieldStartTime.current
                );
            }

            const fieldKey = `${details.section}.${details.field}`;

            setFieldData((previous) => ({
                ...previous,
                section: details.section,
                field: details.field,
                blurCount: previous.blurCount + 1,
                totalInteractionCount:
                    previous.totalInteractionCount + 1,
                lastInteraction: "blur",
                timeSpentMs: previous.timeSpentMs + duration,
                fieldTimes: {
                    ...previous.fieldTimes,
                    [fieldKey]:
                        (previous.fieldTimes[fieldKey] || 0) + duration,
                },
            }));

            activeField.current = null;
            fieldStartTime.current = null;

            console.log("AuraGen Field Blur:", {
                ...details,
                timeSpentMs: duration,
            });
        };

        document.addEventListener("focusin", handleFieldFocus);
        document.addEventListener("input", handleFieldTyping);
        document.addEventListener("focusout", handleFieldBlur);

        return () => {
            document.removeEventListener("focusin", handleFieldFocus);
            document.removeEventListener("input", handleFieldTyping);
            document.removeEventListener("focusout", handleFieldBlur);
        };
    }, []);

    return fieldData;
}
