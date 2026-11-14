
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
                Move your mouse to test cursor tracking and speed.
            </p>

            <div className="rounded-xl bg-slate-800 p-6 space-y-5">
                <div>
                    <p className="text-slate-400 text-sm">Cursor X</p>
                    <p className="text-xl">{cursorData.x}</p>
                </div>

                <div>
                    <p className="text-slate-400 text-sm">Cursor Y</p>
                    <p className="text-xl">{cursorData.y}</p>
                </div>

                <div>
                    <p className="text-slate-400 text-sm">Movement Count</p>
                    <p className="text-xl">{cursorData.movementCount}</p>
                </div>

                <div>
                    <p className="text-slate-400 text-sm">
                        Cursor Speed
                    </p>
                    <p className="text-2xl font-bold text-green-400">
                        {cursorData.speed} px/sec
                    </p>
                </div>
            </div>
        </main>
    );
}
