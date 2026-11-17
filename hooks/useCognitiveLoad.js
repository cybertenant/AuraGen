
"use client";

import { useMemo } from "react";

export default function useCognitiveLoad(cursorData, fieldData) {
    return useMemo(() => {
        // 1. Cursor hesitation score (maximum 40)
        const hesitationCount = cursorData?.hesitationCount || 0;

        const hesitationScore = Math.min(
            40,
            hesitationCount * 5
        );

        // 2. Repeated field visits score (maximum 30)
        const focusCounts = fieldData?.fieldFocusCounts || {};

        const repeatedVisits = Object.values(focusCounts).reduce(
            (total, count) => total + Math.max(0, count - 1),
            0
        );

        const repeatVisitScore = Math.min(
            30,
            repeatedVisits * 5
        );

        // 3. Time spent score (maximum 30)
        const fieldTimes = fieldData?.fieldTimes || {};

        const maximumFieldTime = Math.max(
            0,
            ...Object.values(fieldTimes)
        );

        const timeScore = Math.min(
            30,
            Math.floor(maximumFieldTime / 5000) * 5
        );

        // Final score (0–100)
        const score = Math.min(
            100,
            hesitationScore + repeatVisitScore + timeScore
        );

        // Difficulty level
        let level = "Low";

        if (score >= 60) {
            level = "High";
        } else if (score >= 25) {
            level = "Moderate";
        }

        return {
            score,
            level,
            hesitationScore,
            repeatVisitScore,
            timeScore,
            repeatedVisits,
            maximumFieldTime,
        };
    }, [
        cursorData?.hesitationCount,
        fieldData?.fieldFocusCounts,
        fieldData?.fieldTimes,
    ]);
}
