
"use client";

import useFrictionEngine from "@/hooks/useFrictionEngine";

export default function FrictionTestPage() {
    const cursorData = useFrictionEngine();

    return (
        <main className="min-h-screen bg-slate-950 text-white p-10">
            <h1 className="text-3xl font-bold mb-4">
                AuraGen - Friction Engine
            </h1>

            <p className="text-slate-400 mb-8">
                Move your mouse to test cursor tracking.
            </p>

            <div className="rounded-xl bg-slate-800 p-6 space-y-4">
                <p>Cursor X: {cursorData.x}</p>
                <p>Cursor Y: {cursorData.y}</p>
                <p>Movement Count: {cursorData.movementCount}</p>
            </div>
        </main>
    );
}
