"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "../editor.module.css";
import type { Imported, ImportTarget, RawImage } from "../hero/importPicture";
import {
  blankRows,
  flipRows,
  floodFill,
  linePixels,
  setPixels,
  type Box,
  type Pixel,
} from "../hero/pixels";
import { NOT_A_PICTURE } from "../hero/readPicture";
import { ImportDialog } from "./ImportDialog";
import { PixelCanvas } from "./PixelCanvas";
import { slotChar, slotOf } from "@/model/look";

// The four drawing tools, or an extra tool a screen adds (such as the hitbox).
export type DrawTool = string;

export type ExtraTool = {
  id: string;
  label: string;
  press(p: Pixel): void;
  drag(p: Pixel): void;
  release(): void;
};

const TOOLS: { id: DrawTool; label: string }[] = [
  { id: "pencil", label: "Pencil" },
  { id: "eraser", label: "Eraser" },
  { id: "fill", label: "Fill" },
  { id: "pick", label: "Pick colour" },
];

type Props = {
  name: string;
  rows: string[];
  palette: Record<string, string>;
  size: { w: number; h: number };
  body: Box | null;
  feet: boolean;
  under?: string[]; // the onion skin
  shot?: { y: number; h: number }; // where shots come out
  extraTools?: ExtraTool[]; // tools that work on the picture without drawing, after the four drawing tools
  zoom?: number; // screen pixels per picture pixel
  pictureButtons?: ReactNode; // more buttons for the bar under the picture (Fit to drawing, Size)
  testId: string;
  colours: number[];
  tool: DrawTool;
  onTool(tool: DrawTool): void;
  slot: number; // the chosen colour, from 1
  onSlot(slot: number): void;
  partners: { id: string; name: string; rows: string[] }[]; // pictures of the same size, to copy from
  importTarget: ImportTarget;
  readPicture(file: File): Promise<RawImage>;
  locked: boolean;
  onRows(rows: string[]): void; // save this picture
  onImport(result: Imported): void; // save an import (colours, then rows), inside a group
  onBegin(label: string): void;
  onCommit(): void;
};

// One picture's drawing area. Render it with the picture as its key: a new picture is a new
// editor, and a stroke left open on the old one ends as one undo step when it goes.
export function PictureEditor({
  name,
  rows,
  palette,
  size,
  body,
  feet,
  under,
  shot,
  extraTools = [],
  zoom,
  pictureButtons,
  testId,
  colours,
  tool,
  onTool,
  slot,
  onSlot,
  partners,
  importTarget,
  readPicture,
  locked,
  onRows,
  onImport,
  onBegin,
  onCommit,
}: Props) {
  const colour = Math.min(slot, colours.length); // the chosen colour may have been removed
  const ink = tool === "eraser" ? "." : slotChar(colour);
  const stroke = useRef<{ rows: string[]; last: Pixel } | null>(null);

  // A one-press change (fill, copy, flip, clear) is one undo step, however many commands saving it takes.
  const once = (label: string, next: string[]) => {
    onBegin(label);
    onRows(next);
    onCommit();
  };

  const extra = extraTools.find((t) => t.id === tool);
  const press = (p: Pixel) => {
    if (locked) return;
    if (extra) return extra.press(p);
    if (tool === "pick") {
      const ch = rows[p.y][p.x];
      if (ch !== ".") onSlot(slotOf(ch));
      return;
    }
    if (tool === "fill") {
      once("Fill", floodFill(rows, p, ink));
      return;
    }
    onBegin(tool === "eraser" ? "Erase" : "Draw");
    const next = setPixels(rows, [p], ink);
    stroke.current = { rows: next, last: p };
    onRows(next);
  };
  const drag = (p: Pixel, fresh: boolean) => {
    if (extra) return extra.drag(p);
    const current = stroke.current;
    if (!current) return;
    const next = setPixels(
      current.rows,
      fresh ? [p] : linePixels(current.last, p),
      ink,
    );
    stroke.current = { rows: next, last: p };
    onRows(next);
  };
  const release = () => {
    if (extra) return extra.release();
    if (!stroke.current) return;
    stroke.current = null;
    onCommit();
  };

  // Going away mid-stroke (another picture, another tab, the level) ends the stroke as one undo step.
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });
  useEffect(() => {
    const open = stroke;
    const commit = commitRef;
    return () => {
      if (!open.current) return;
      open.current = null;
      commit.current();
    };
  }, []);

  // Importing a picture: read the file, show the dialog, and on "Use this" make it one undo step.
  const [importing, setImporting] = useState<RawImage | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const wasImporting = useRef(false);
  useEffect(() => {
    if (wasImporting.current && !importing) importButton.current?.focus();
    wasImporting.current = importing !== null;
  }, [importing]);
  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      setImporting(await readPicture(file));
    } catch {
      setImportError(NOT_A_PICTURE);
    }
  };
  const useImport = (result: Imported) => {
    release();
    onBegin("Import a picture");
    onImport(result);
    onCommit();
    setImporting(null);
  };

  return (
    <div className={styles.pictureEditor}>
      {importError && (
        <p className={styles.alert} role="alert">
          {importError}
          <button type="button" onClick={() => setImportError(null)}>
            Dismiss
          </button>
        </p>
      )}
      <div className={styles.canvasWrap}>
        <PixelCanvas
          rows={rows}
          palette={palette}
          size={size}
          body={body}
          feet={feet}
          under={under}
          shot={shot}
          zoom={zoom}
          name={name}
          testId={testId}
          onPress={press}
          onDrag={drag}
          onRelease={release}
        />
      </div>
      <div
        className={styles.toolColumn}
        role="group"
        aria-label="Drawing tools"
      >
        {[...TOOLS, ...extraTools].map((t) => (
          <button
            key={t.id}
            type="button"
            className={styles.choice}
            aria-pressed={tool === t.id}
            onClick={() => onTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        className={styles.pictureBar}
        role="group"
        aria-label="Picture tools"
      >
        {partners.length > 0 && (
          <label className={styles.field}>
            Copy from
            <select
              value=""
              onChange={(e) => {
                const from = partners.find((p) => p.id === e.target.value);
                if (from) once("Copy picture", from.rows);
              }}
            >
              <option value="">Choose a picture…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className={styles.action}
          onClick={() => once("Flip", flipRows(rows))}
        >
          Flip
        </button>
        <button
          type="button"
          className={`${styles.action} ${styles.danger}`}
          onClick={() => once("Clear", blankRows(size.w, size.h))}
        >
          Clear
        </button>
        <button
          ref={importButton}
          type="button"
          className={styles.action}
          onClick={() => fileInput.current?.click()}
        >
          Import picture
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          aria-label="Picture file"
          className={styles.fileInput}
          onChange={(e) => {
            void pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {pictureButtons}
      </div>
      {importing && (
        <ImportDialog
          title={name}
          target={importTarget}
          colours={colours}
          image={importing}
          onUse={useImport}
          onCancel={() => setImporting(null)}
        />
      )}
    </div>
  );
}
