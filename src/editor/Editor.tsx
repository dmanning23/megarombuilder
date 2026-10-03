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
import { paintCommand } from "./tools";
import type { Spot } from "./zoneView";

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

  // Saving. A change is saved a little while after the project last changed (never in the middle
  // of a stroke), and at once when the page is hidden or the editor closes, so the last change is
  // never lost. If the game is opened in another tab, this tab stops saving so neither overwrites
  // the other.
  const lastSaved = useRef(project);
  const pending = useRef<Project | null>(null);
  const elsewhere = useRef(false);
  const saveRef = useRef(store.save);
  useEffect(() => {
    saveRef.current = store.save;
  }, [store]);
  const [openElsewhere, setOpenElsewhere] = useState(false);

  const flush = useCallback(() => {
    const next = pending.current;
    if (!next || elsewhere.current) return;
    pending.current = null;
    Promise.resolve(saveRef.current(next)).then(
      () => {
        lastSaved.current = next;
        setSaveState(pending.current ? "saving" : "saved");
      },
      () => {
        pending.current ??= next;
        setSaveState("error");
      },
    );
  }, []);

  useEffect(() => {
    if (strokeOpen) return;
    if (project === lastSaved.current) {
      pending.current = null; // undone back to what is saved
      setSaveState("saved");
      return;
    }
    pending.current = project;
    setSaveState("saving");
    const timer = setTimeout(flush, saveDelay);
    return () => clearTimeout(timer);
  }, [project, strokeOpen, saveDelay, flush]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      flush();
      if (pending.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", onLeave);
      flush();
    };
  }, [flush]);

  // The newest tab to open a game keeps it; any older tab stops saving and says why.
  const gameId = initial.id;
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("megarombuilder-editors");
    const tab = makeId();
    channel.onmessage = (e: MessageEvent<{ gameId: string; tab: string }>) => {
      if (e.data?.gameId !== gameId || e.data.tab === tab) return;
      elsewhere.current = true;
      setOpenElsewhere(true);
    };
    channel.postMessage({ gameId, tab });
    return () => channel.close();
    // makeId is only used for a token; a new one each render must not reopen the channel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

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
    (spot: Spot) => {
      if (state.tool.kind !== "tile" && state.tool.kind !== "erase") return;
      dispatch({ type: "run", command: paintCommand(state.tool, level.id, zone, pack, spot) });
    },
    [state.tool, level.id, zone, pack],
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
        saveState={openElsewhere ? "elsewhere" : saveState}
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
        onAddClimb={addZone}
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
            {openElsewhere && (
              <p className={styles.alert} role="alert">
                This game is open in another tab, so changes here aren&apos;t saved. Keep building in the
                other tab.
              </p>
            )}
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
              onPress={(spot) => {
                dispatch({ type: "begin", label: "Paint" });
                paint(spot);
              }}
              onDrag={paint}
              onRelease={() => dispatch({ type: "commit" })}
            />
          </div>
          <Palette pack={pack} art={art} tool={state.tool} onTool={(tool) => dispatch({ type: "tool", tool })} />
        </main>
      )}
    </div>
  );
}
