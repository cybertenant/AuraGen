
"use client";

import { useMemo } from "react";

export default function useFrictionAnalysis(fieldData, errorData) {
    return useMemo(() => {
        const fieldTimes = fieldData?.fieldTimes || {};
        const fieldFocusCounts = fieldData?.fieldFocusCounts || {};
        const fieldErrorCounts = errorData?.fieldErrorCounts || {};

        // Collect all fields that have interaction or error data
        const allFields = new Set([
            ...Object.keys(fieldTimes),
            ...Object.keys(fieldFocusCounts),
            ...Object.keys(fieldErrorCounts),
        ]);

        const fieldFriction = {};

        // Calculate friction score for every field
        allFields.forEach((field) => {
            const timeSpent = fieldTimes[field] || 0;
            const visits = fieldFocusCounts[field] || 0;
            const errors = fieldErrorCounts[field] || 0;

            const timeScore = Math.min(
                40,
                Math.floor(timeSpent / 5000) * 5
            );

            const repeatVisitScore = Math.min(
                30,
                Math.max(0, visits - 1) * 10
            );

            const errorScore = Math.min(
                30,
                errors * 10
            );

            const totalScore =
                timeScore + repeatVisitScore + errorScore;

            let level = "Low";

            if (totalScore >= 60) {
                level = "High";
            } else if (totalScore >= 25) {
                level = "Moderate";
            }

            fieldFriction[field] = {
                timeSpent,
                visits,
                errors,
                timeScore,
                repeatVisitScore,
                errorScore,
                totalScore,
                level,
            };
        });

        // Find the field with the highest friction score
        const fieldEntries = Object.entries(fieldFriction);

        const mostDifficultField =
            fieldEntries.length > 0
                ? fieldEntries.reduce((highest, current) =>
                    current[1].totalScore > highest[1].totalScore
                        ? current
                        : highest
                )
                : null;

        // Calculate section-wise friction
        const sectionFriction = {};

        fieldEntries.forEach(([field, data]) => {
            const section = field.split(".")[0];

            if (!sectionFriction[section]) {
                sectionFriction[section] = {
                    totalScore: 0,
                    fieldCount: 0,
                    totalErrors: 0,
                    totalVisits: 0,
                    totalTime: 0,
                };
            }

            sectionFriction[section].totalScore += data.totalScore;
            sectionFriction[section].fieldCount += 1;
            sectionFriction[section].totalErrors += data.errors;
            sectionFriction[section].totalVisits += data.visits;
            sectionFriction[section].totalTime += data.timeSpent;
        });

        // Calculate average friction per section
        Object.values(sectionFriction).forEach((section) => {
            section.averageScore = Math.round(
                section.totalScore / section.fieldCount
            );

            section.level =
                section.averageScore >= 60
                    ? "High"
                    : section.averageScore >= 25
                        ? "Moderate"
                        : "Low";
        });

        // Find the section with the highest average friction
        const sectionEntries = Object.entries(sectionFriction);

        const mostDifficultSection =
            sectionEntries.length > 0
                ? sectionEntries.reduce((highest, current) =>
                    current[1].averageScore > highest[1].averageScore
                        ? current
                        : highest
                )
                : null;

        return {
            fieldFriction,
            mostDifficultField,
            sectionFriction,
            mostDifficultSection,
        };
    }, [fieldData, errorData]);
}
