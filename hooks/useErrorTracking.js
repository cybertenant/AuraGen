
"use client";

import { useEffect, useRef, useState } from "react";

export default function useErrorTracking(errors) {
    const previousErrors = useRef({});

    const [errorData, setErrorData] = useState({
        totalErrors: 0,
        fieldErrorCounts: {},
        lastError: null,
    });

    useEffect(() => {
        const newErrors = [];

        Object.entries(errors || {}).forEach(([section, fields]) => {
            Object.entries(fields || {}).forEach(([field, message]) => {
                const previousMessage =
                    previousErrors.current?.[section]?.[field];

                if (message && message !== previousMessage) {
                    newErrors.push({
                        section,
                        field,
                        message,
                    });
                }
            });
        });

        if (newErrors.length > 0) {
            setErrorData((previous) => {
                const updatedCounts = {
                    ...previous.fieldErrorCounts,
                };

                newErrors.forEach(({ section, field }) => {
                    const key = `${section}.${field}`;

                    updatedCounts[key] =
                        (updatedCounts[key] || 0) + 1;
                });

                return {
                    totalErrors:
                        previous.totalErrors + newErrors.length,
                    fieldErrorCounts: updatedCounts,
                    lastError: newErrors[newErrors.length - 1],
                };
            });
        }

        previousErrors.current = errors || {};
    }, [errors]);

    // Day 11: Section-wise Error Analysis
    const sectionErrorCounts = {};

    Object.entries(errorData.fieldErrorCounts).forEach(
        ([field, count]) => {
            const section = field.split(".")[0];

            sectionErrorCounts[section] =
                (sectionErrorCounts[section] || 0) + count;
        }
    );

    // Find the field with the highest error count
    const fieldEntries = Object.entries(errorData.fieldErrorCounts);

    const mostErrorProneField =
        fieldEntries.length > 0
            ? fieldEntries.reduce((highest, current) =>
                current[1] > highest[1] ? current : highest
            )
            : null;

    // Find fields with repeated errors
    const repeatedErrorFields = fieldEntries.filter(
        ([field, count]) => count > 1
    );

    // Find the section with the highest error count
    const sectionEntries = Object.entries(sectionErrorCounts);

    const mostErrorProneSection =
        sectionEntries.length > 0
            ? sectionEntries.reduce((highest, current) =>
                current[1] > highest[1] ? current : highest
            )
            : null;

    return {
        ...errorData,
        sectionErrorCounts,
        mostErrorProneField,
        repeatedErrorFields,
        mostErrorProneSection,
    };
}
