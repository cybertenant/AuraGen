
"use client";

import { useEffect, useRef, useState } from "react";

export default function useFrictionEngine() {
    const [cursorData, setCursorData] = useState({
        x: 0,
        y: 0,
        movementCount: 0,
        speed: 0,
    });

    const previousPosition = useRef(null);

    useEffect(() => {
        const handleMouseMove = (event) => {
            const currentTime = performance.now();
            const currentX = event.clientX;
            const currentY = event.clientY;

            let speed = 0;

            if (previousPosition.current) {
                const dx = currentX - previousPosition.current.x;
                const dy = currentY - previousPosition.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const timeDifference =
                    currentTime - previousPosition.current.time;

                if (timeDifference > 0) {
                    speed = (distance / timeDifference) * 1000;
                }
            }

            previousPosition.current = {
                x: currentX,
                y: currentY,
                time: currentTime,
            };

            setCursorData((previous) => ({
                x: currentX,
                y: currentY,
                movementCount: previous.movementCount + 1,
                speed: Math.round(speed),
            }));
        };

        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, []);

    return cursorData;
}
