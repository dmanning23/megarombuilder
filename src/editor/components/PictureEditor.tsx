"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../editor.module.css";
import type { Imported, ImportTarget, RawImage } from "../hero/importPicture";
import { blankRows, flipRows, floodFill, linePixels, setPixels, type Box, type Pixel } from "../hero/pixels";
import { NOT_A_PICTURE } from "../hero/readPicture";
import { ImportDialog } from "./ImportDialog";
import { PixelCanvas } from "./PixelCanvas";

export type DrawTool = "pencil" | "eraser" | "fill" | "pick";

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
  body: Box;
  feet: boolean;
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
  const ink = tool === "eraser" ? "." : String(colour);
  const stroke = useRef<{ rows: string[]; last: Pixel } | null>(null);

  const press = (p: Pixel) => {
    if (locked) return;
    if (tool === "pick") {
      const ch = rows[p.y][p.x];
      if (ch !== ".") onSlot(Number(ch));
      return;
    }
    if (tool === "fill") {
      onRows(floodFill(rows, p, String(colour)));
      return;
    }
    onBegin(tool === "eraser" ? "Erase" : "Draw");
    const next = setPixels(rows, [p], ink);
    stroke.current = { rows: next, last: p };
    onRows(next);
  };
  const drag = (p: Pixel, fresh: boolean) => {
    const current = stroke.current;
    if (!current) return;
    const next = setPixels(current.rows, fresh ? [p] : linePixels(current.last, p), ink);
    stroke.current = { rows: next, last: p };
    onRows(next);
  };
  const release = () => {
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
    <div className={styles.drawing}>
      {importError && (
        <p className={styles.alert} role="alert">
          {importError}
          <button type="button" onClick={() => setImportError(null)}>
            Dismiss
          </button>
        </p>
      )}
      <PixelCanvas
        rows={rows}
        palette={palette}
        size={size}
        body={body}
        feet={feet}
        name={name}
        testId={testId}
        onPress={press}
        onDrag={drag}
        onRelease={release}
      />
      <div className={styles.drawTools} role="group" aria-label="Drawing tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={styles.swatch}
            aria-pressed={tool === t.id}
            onClick={() => onTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.drawTools} role="group" aria-label="Picture tools">
        {partners.length > 0 && (
          <label className={styles.field}>
            Copy from
            <select
              value=""
              onChange={(e) => {
                const from = partners.find((p) => p.id === e.target.value);
                if (from) onRows(from.rows);
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
        <button type="button" className={styles.swatch} onClick={() => onRows(flipRows(rows))}>
          Flip
        </button>
        <button type="button" className={styles.swatch} onClick={() => onRows(blankRows(size.w, size.h))}>
          Clear
        </button>
        <button ref={importButton} type="button" className={styles.swatch} onClick={() => fileInput.current?.click()}>
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
