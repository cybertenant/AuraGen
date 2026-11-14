
"use client";

import { useEffect, useState } from "react";

export default function useFrictionEngine() {
    const [cursorData, setCursorData] = useState({
        x: 0,
        y: 0,
        movementCount: 0,
    });

    useEffect(() => {
        const handleMouseMove = (event) => {
            setCursorData((previous) => ({
                x: event.clientX,
                y: event.clientY,
                movementCount: previous.movementCount + 1,
            }));
        };

        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, []);

    return cursorData;
}
