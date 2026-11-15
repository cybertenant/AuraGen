
"use client";

import { useEffect, useState } from "react";

export default function useFieldTracking() {
    const [fieldData, setFieldData] = useState({
        section: "",
        field: "",
        interactionCount: 0,
        lastInteraction: "",
    });

    useEffect(() => {
        const handleFieldFocus = (event) => {
            const target = event.target;

            const section = target.dataset.section;
            const field = target.dataset.field;

            if (!section || !field) return;

            setFieldData((previous) => ({
                section,
                field,
                interactionCount: previous.interactionCount + 1,
                lastInteraction: "focus",
            }));

            console.log("AuraGen Field Tracking:", {
                section,
                field,
                interaction: "focus",
            });
        };

        document.addEventListener("focusin", handleFieldFocus);

        return () => {
            document.removeEventListener("focusin", handleFieldFocus);
        };
    }, []);

    return fieldData;
}
