"use client";

import { createDemoProject, DEMO_LEVEL_ID, demoPack } from "@/content/demo";
import { PlayCanvas } from "@/runtime/render/PlayCanvas";

const project = createDemoProject();

export default function PlayPage() {
  return (
    <main style={{ display: "grid", justifyItems: "center", gap: 12, padding: 24 }}>
      <h1>Demo Stage</h1>
      <PlayCanvas project={project} levelId={DEMO_LEVEL_ID} pack={demoPack} />
      <p>Arrow keys to move and climb. Z to jump. X to shoot.</p>
    </main>
  );
}
