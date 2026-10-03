"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Command } from "@/commands/types";
import { canRedo, canUndo } from "@/commands/history";
import { getArt, getPack } from "@/content/packs";
import type { Project } from "@/model/schema";
import type { Skin } from "@/runtime/render/draw";
import { PlayCanvas } from "@/runtime/render/PlayCanvas";
import { browserCanvas, createSpriteCache } from "@/runtime/render/sprites";
import { CheckPanel } from "./components/CheckPanel";
import { Palette } from "./components/Palette";
import { Toolbar } from "./components/Toolbar";
import { ZoneCanvas } from "./components/ZoneCanvas";
import { ZoneList } from "./components/ZoneList";
import { ZoneSettings } from "./components/ZoneSettings";
import styles from "./editor.module.css";
import { downloadProject } from "./files";
import { currentLevel, currentZone, editorReducer, initialEditor, nextZoneName } from "./state";
import { paintCommand, placeCommand, thingAt } from "./tools";
import { useLevelCheck } from "./useLevelCheck";
import type { Spot } from "./zoneView";

type Props = {
  initial: Project;
  store: { save(project: Project): Promise<void> };
  makeId?: () => string;
  saveDelay?: number;
  confirm?: (message: string) => boolean;
};

const typing = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return (
    el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" || el?.isContentEditable === true
  );
};

// A move remembers where the thing was grabbed, so a wide thing (a platform, the boss) keeps the
// grab point under the pointer, and a click that doesn't drag doesn't move it.
type Drag =
  | { kind: "stroke" }
  | { kind: "move"; thingId: string; from: { x: number; y: number }; dx: number; dy: number }
  | null;

export function Editor({
  initial,
  store,
  makeId = () => crypto.randomUUID(),
  saveDelay = 600,
  confirm = (message) => window.confirm(message),
}: Props) {
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
  const playing = state.playing !== null;

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
        if (e.key === "Escape" && !typing(e.target)) dispatch({ type: "stopPlaying" });
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

  // Sideways zones zoom to fit the height of the zone area (between 1x and 2x), so the floor,
  // where most building happens, is always in view. Climbing zones stay at 2x and scroll.
  // Only in the wide layout, where the zone area has a set height: in the narrow layout its height
  // comes from the canvas, and fitting to it would shrink the canvas step by step to 1x.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined" || typeof window.matchMedia !== "function") return;
    const wide = window.matchMedia("(min-width: 761px)");
    const observer = new ResizeObserver(([entry]) =>
      setStageHeight(wide.matches ? entry.contentRect.height : null),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [playing]);
  const zoom =
    zone.scroll === "horizontal" && stageHeight ? Math.min(2, Math.max(1, (stageHeight - 8) / 240)) : 2;

  // The checker, rerun once editing pauses.
  const check = useLevelCheck(project, level.id, pack, strokeOpen || playing);
  const zoneCheck = check?.zones.find((z) => z.zoneId === zone.id);
  const marker = zoneCheck && !zoneCheck.passable ? zoneCheck.furthest : null;

  const run = (command: Command) => dispatch({ type: "run", command });

  // What the canvas does with the current tool.
  const drag = useRef<Drag>(null);
  const press = (spot: Spot) => {
    const tool = state.tool;
    if (tool.kind === "tile" || tool.kind === "erase") {
      dispatch({ type: "begin", label: tool.kind === "erase" ? "Erase" : "Paint" });
      run(paintCommand(tool, level.id, zone, pack, spot));
      drag.current = { kind: "stroke" };
      return;
    }
    if (tool.kind === "thing") {
      const hit = thingAt(zone, pack, spot.point);
      if (hit) {
        drag.current = { kind: "move", thingId: hit.id, from: spot.tile, dx: hit.x - spot.tile.x, dy: hit.y - spot.tile.y };
        return;
      }
    }
    run(placeCommand(tool, level.id, zone, spot, makeId, pack));
  };
  const dragTo = (spot: Spot) => {
    const tool = state.tool;
    if (drag.current?.kind === "stroke" && (tool.kind === "tile" || tool.kind === "erase")) {
      run(paintCommand(tool, level.id, zone, pack, spot));
    }
  };
  const release = (spot: Spot | null) => {
    const ended = drag.current;
    drag.current = null;
    if (ended?.kind === "stroke") dispatch({ type: "commit" });
    else if (ended?.kind === "move" && spot && (spot.tile.x !== ended.from.x || spot.tile.y !== ended.from.y)) {
      run({
        name: "moveThing",
        args: {
          levelId: level.id,
          zoneId: zone.id,
          thingId: ended.thingId,
          x: spot.tile.x + ended.dx,
          y: spot.tile.y + ended.dy,
        },
      });
    }
  };

  const addZone = (climb: boolean) => {
    const zoneId = makeId();
    const args = climb
      ? { levelId: level.id, zoneId, name: nextZoneName(level), scroll: "vertical", screens: 2 }
      : { levelId: level.id, zoneId, name: nextZoneName(level) };
    run({ name: "addZone", args });
    dispatch({ type: "selectZone", zoneId });
  };

  const deleteZone = () => {
    if (!confirm(`Delete "${zone.name}"? You can undo this.`)) return;
    run({ name: "removeZone", args: { levelId: level.id, zoneId: zone.id } });
  };

  return (
    <div className={styles.app}>
      <Toolbar
        title={project.name}
        saveState={openElsewhere ? "elsewhere" : saveState}
        canUndo={canUndo(state.history)}
        canRedo={canRedo(state.history)}
        playing={playing}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onPlay={() => dispatch({ type: "play", fromZoneId: null })}
        onPlayFromZone={() => dispatch({ type: "play", fromZoneId: zone.id })}
        onExport={() => downloadProject(project)}
      />
      <aside className={styles.side}>
        <ZoneList
          level={level}
          selectedId={zone.id}
          checks={check?.zones}
          disabled={playing}
          onSelect={(zoneId) => dispatch({ type: "selectZone", zoneId })}
          onRename={(zoneId, name) => run({ name: "renameZone", args: { levelId: level.id, zoneId, name } })}
          onAdd={() => addZone(false)}
          onAddClimb={() => addZone(true)}
        />
        {!playing && <ZoneSettings level={level} zone={zone} pack={pack} onCommand={run} onDelete={deleteZone} />}
      </aside>
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
          <div className={styles.stage} ref={stageRef}>
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
              zoom={zoom}
              marker={marker}
              onPress={press}
              onDrag={dragTo}
              onRelease={release}
            />
          </div>
          <CheckPanel zoneCheck={zoneCheck} problems={check?.problems ?? []} />
          <Palette pack={pack} art={art} tool={state.tool} onTool={(tool) => dispatch({ type: "tool", tool })} />
        </main>
      )}
    </div>
  );
}
