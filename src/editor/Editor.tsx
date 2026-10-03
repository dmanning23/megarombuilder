"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { canRedo, canUndo } from "@/commands/history";
import { getArt, getPack } from "@/content/packs";
import type { Project } from "@/model/schema";
import type { Skin } from "@/runtime/render/draw";
import { PlayCanvas } from "@/runtime/render/PlayCanvas";
import { browserCanvas, createSpriteCache } from "@/runtime/render/sprites";
import { Palette } from "./components/Palette";
import { Toolbar } from "./components/Toolbar";
import { ZoneCanvas } from "./components/ZoneCanvas";
import { ZoneList } from "./components/ZoneList";
import styles from "./editor.module.css";
import { currentLevel, currentZone, editorReducer, initialEditor, nextZoneName } from "./state";

type Props = {
  initial: Project;
  store: { save(project: Project): Promise<void> };
  makeId?: () => string;
  saveDelay?: number;
};

const typing = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable === true;
};

export function Editor({ initial, store, makeId = () => crypto.randomUUID(), saveDelay = 600 }: Props) {
  const pack = getPack(initial.contentPackId);
  if (!pack) throw new Error(`The content pack "${initial.contentPackId}" is not available.`);
  const art = getArt(initial.contentPackId);
  const reducer = useMemo(() => editorReducer({ pack }), [pack]);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialEditor(initial, pack.groundTileId));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");

  const skin = useMemo<Skin | undefined>(() => {
    if (!art || typeof document === "undefined") return undefined;
    return { set: art, image: createSpriteCache(art.palette, browserCanvas) };
  }, [art]);

  const project = state.history.project;
  const level = currentLevel(state);
  const zone = currentZone(state);
  const strokeOpen = state.history.open !== null;

  // Save a little while after the project last changed, never in the middle of a stroke.
  const firstProject = useRef(project);
  useEffect(() => {
    if (project === firstProject.current || strokeOpen) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      store.save(project).then(
        () => setSaveState("saved"),
        () => setSaveState("error"),
      );
    }, saveDelay);
    return () => clearTimeout(timer);
  }, [project, strokeOpen, store, saveDelay]);

  // Keyboard: undo and redo, and Escape to stop playing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.playing) {
        if (e.key === "Escape") dispatch({ type: "stopPlaying" });
        return;
      }
      if (typing(e.target)) return;
      const command = e.metaKey || e.ctrlKey;
      if (command && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.playing]);

  const paint = useCallback(
    (x: number, y: number) => {
      const tile = state.tool.kind === "tile" ? state.tool.tile : 0;
      dispatch({
        type: "run",
        command: { name: "setTiles", args: { levelId: level.id, zoneId: zone.id, cells: [{ x, y, tile }] } },
      });
    },
    [state.tool, level.id, zone.id],
  );

  const addZone = () => {
    const zoneId = makeId();
    dispatch({
      type: "run",
      command: { name: "addZone", args: { levelId: level.id, zoneId, name: nextZoneName(level) } },
    });
    dispatch({ type: "selectZone", zoneId });
  };

  return (
    <div className={styles.app}>
      <Toolbar
        title={project.name}
        saveState={saveState}
        canUndo={canUndo(state.history)}
        canRedo={canRedo(state.history)}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onPlay={() => dispatch({ type: "play", fromZoneId: null })}
        onPlayFromZone={() => dispatch({ type: "play", fromZoneId: zone.id })}
      />
      <ZoneList
        level={level}
        selectedId={zone.id}
        onSelect={(zoneId) => dispatch({ type: "selectZone", zoneId })}
        onRename={(zoneId, name) =>
          dispatch({ type: "run", command: { name: "renameZone", args: { levelId: level.id, zoneId, name } } })
        }
        onAdd={addZone}
      />
      {state.playing ? (
        <main className={styles.playing}>
          <PlayCanvas
            project={project}
            levelId={level.id}
            pack={pack}
            art={art}
            startZoneId={state.playing.fromZoneId ?? undefined}
          />
          <button type="button" className={styles.primary} onClick={() => dispatch({ type: "stopPlaying" })}>
            Stop playing
          </button>
        </main>
      ) : (
        <main className={styles.work}>
          <div className={styles.stage}>
            {state.error && (
              <p className={styles.alert} role="alert">
                {state.error}
                <button type="button" onClick={() => dispatch({ type: "dismissError" })}>
                  Dismiss
                </button>
              </p>
            )}
            <ZoneCanvas
              zone={zone}
              pack={pack}
              skin={skin}
              checkpoints={level.checkpoints}
              zoom={2}
              onStrokeStart={() => dispatch({ type: "begin", label: "Paint" })}
              onPaint={paint}
              onStrokeEnd={() => dispatch({ type: "commit" })}
            />
          </div>
          <Palette pack={pack} art={art} tool={state.tool} onTool={(tool) => dispatch({ type: "tool", tool })} />
        </main>
      )}
    </div>
  );
}
