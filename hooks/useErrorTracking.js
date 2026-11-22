
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

    return errorData;
}
