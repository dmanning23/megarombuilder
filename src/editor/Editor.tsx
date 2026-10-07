"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Command } from "@/commands/types";
import { createHttpModel } from "@/ai/httpModel";
import { FAILURE_TEXT, runTurn, type ModelFn } from "@/ai/turn";
import { canRedo, canUndo } from "@/commands/history";
import { getArt, getPack } from "@/content/packs";
import type { Project } from "@/model/schema";
import type { Skin } from "@/runtime/render/draw";
import { PlayCanvas } from "@/runtime/render/PlayCanvas";
import { browserCanvas, createSpriteCache } from "@/runtime/render/sprites";
import { ChatPanel } from "./components/ChatPanel";
import { CharactersScreen } from "./components/CharactersScreen";
import { gamePack, ownType } from "@/model/gamePack";
import { lookArt, ownSkins } from "@/runtime/render/lookArt";
import type { RawImage } from "./hero/importPicture";
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
  model?: ModelFn;
  readPicture?: (file: File) => Promise<RawImage>;
};

const defaultModel = createHttpModel();

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
  model = defaultModel,
  readPicture,
}: Props) {
  const pack = getPack(initial.contentPackId);
  if (!pack) throw new Error(`The content pack "${initial.contentPackId}" is not available.`);
  const art = getArt(initial.contentPackId);
  const reducer = useMemo(() => editorReducer({ pack }), [pack]);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialEditor(initial, pack.groundTileId));
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [screen, setScreen] = useState<"level" | "characters">("level");

  const project = state.history.project;
  // The zone canvas and its tools see the kid's own enemies as thing types like any other.
  const fullPack = useMemo(() => gamePack(project, pack), [project, pack]);
  const enemies = project.enemies;
  const boss = project.boss;
  const ownArt = useMemo(() => Object.fromEntries(enemies.map((e) => [ownType(e.id), lookArt(e.look)])), [enemies]);
  const skin = useMemo<Skin | undefined>(() => {
    if (!art || typeof document === "undefined") return undefined;
    return {
      set: art,
      image: createSpriteCache(art.palette, browserCanvas),
      own: ownSkins(enemies, (palette) => createSpriteCache(palette, browserCanvas), boss),
    };
  }, [art, enemies, boss]); // rebuilt when the kid's enemies or boss change, not on every edit
  const level = currentLevel(state);
  const zone = currentZone(state);
  const strokeOpen = state.history.open !== null;
  const playing = state.playing !== null;

  // The assistant. A turn runs in one command group: each change is replayed into the editor as it
  // happens (and the editor follows the zone being changed), the group is committed when the turn
  // finishes, and rolled back if it fails or is stopped. The level is locked while it runs.
  const [chatText, setChatText] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [activity, setActivity] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const turn = useRef<AbortController | null>(null);
  const busy = asking !== null;
  useEffect(() => () => turn.current?.abort(), []);

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text || busy || playing || strokeOpen) return;
    const controller = new AbortController();
    turn.current = controller;
    setAsking(text);
    setChatText("");
    setNotice(null);
    setDraft("");
    setActivity(null);
    dispatch({ type: "begin", label: "Assistant" });
    // Anything unexpected inside the turn counts as a failed turn, so the level is never left locked.
    const result = await runTurn(
      { project, levelId: level.id, zoneId: zone.id, history: project.chat, text },
      {
        model,
        pack,
        makeId,
        signal: controller.signal,
        onDraft: setDraft,
        onActivity: setActivity,
        onCommand: (command) => {
          dispatch({ type: "run", command });
          const zoneId = (command.args as { zoneId?: unknown }).zoneId;
          if (typeof zoneId === "string") dispatch({ type: "selectZone", zoneId });
        },
      },
    ).catch((error: unknown) => {
      console.error("The chat turn failed:", error);
      return { ok: false as const, reason: "failed" as const, message: FAILURE_TEXT.failed };
    });
    turn.current = null;
    if (result.ok) {
      dispatch({ type: "commit" });
      const at = new Date().toISOString();
      dispatch({ type: "chat", messages: [{ role: "user", text, at }, { role: "assistant", text: result.reply, at }] });
    } else {
      dispatch({ type: "rollback" });
      setNotice(result.message);
      setChatText((current) => current || text);
    }
    setAsking(null);
    setDraft("");
    setActivity(null);
  };

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
  }, [playing, screen]);
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
    if (busy) return; // the assistant is changing the level
    const tool = state.tool;
    const needs = tool.kind === "piece" ? pack.pieces.find((p) => p.id === tool.pieceId)?.needs : undefined;
    if (needs === "slide" && !project.hero.abilities.slide) return; // the hero can't use this piece
    if (tool.kind === "tile" || tool.kind === "erase") {
      dispatch({ type: "begin", label: tool.kind === "erase" ? "Erase" : "Paint" });
      run(paintCommand(tool, level.id, zone, fullPack, spot));
      drag.current = { kind: "stroke" };
      return;
    }
    if (tool.kind === "thing") {
      const hit = thingAt(zone, fullPack, spot.point);
      if (hit) {
        drag.current = { kind: "move", thingId: hit.id, from: spot.tile, dx: hit.x - spot.tile.x, dy: hit.y - spot.tile.y };
        return;
      }
    }
    run(placeCommand(tool, level.id, zone, spot, makeId, fullPack));
  };
  const dragTo = (spot: Spot) => {
    const tool = state.tool;
    if (drag.current?.kind === "stroke" && (tool.kind === "tile" || tool.kind === "erase")) {
      run(paintCommand(tool, level.id, zone, fullPack, spot));
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
        busy={busy}
        screen={screen}
        onScreen={setScreen}
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
          disabled={playing || busy}
          onSelect={(zoneId) => dispatch({ type: "selectZone", zoneId })}
          onRename={(zoneId, name) => run({ name: "renameZone", args: { levelId: level.id, zoneId, name } })}
          onAdd={() => addZone(false)}
          onAddClimb={() => addZone(true)}
        />
        {!playing && (
          <fieldset className={styles.lock} disabled={busy}>
            <ZoneSettings level={level} zone={zone} pack={pack} onCommand={run} onDelete={deleteZone} />
          </fieldset>
        )}
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
      ) : screen === "characters" ? (
        <main className={styles.heroWork}>
          <CharactersScreen
            project={project}
            pack={pack}
            art={art}
            locked={busy}
            error={state.error}
            onDismissError={() => dispatch({ type: "dismissError" })}
            onCommand={run}
            onBegin={(label) => dispatch({ type: "begin", label })}
            onCommit={() => dispatch({ type: "commit" })}
            level={level}
            check={check}
            onGoToZone={(zoneId) => {
              setScreen("level");
              dispatch({ type: "selectZone", zoneId });
            }}
            confirm={confirm}
            readPicture={readPicture}
            makeId={makeId}
          />
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
              pack={fullPack}
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
          <Palette
            pack={fullPack}
            own={ownArt}
            art={art}
            tool={state.tool}
            canSlide={project.hero.abilities.slide}
            onTool={(tool) => dispatch({ type: "tool", tool })}
          />
        </main>
      )}
      <ChatPanel
        messages={project.chat}
        asking={asking}
        draft={draft}
        activity={activity}
        notice={notice}
        busy={busy}
        canSend={!busy && !playing && !strokeOpen}
        text={chatText}
        onText={setChatText}
        onSend={sendChat}
        onStop={() => turn.current?.abort()}
      />
    </div>
  );
}
