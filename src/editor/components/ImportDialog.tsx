"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PALETTE_8BIT } from "@/model/palette";
import styles from "../editor.module.css";
import { backgroundOf, importPicture, type Imported, type ImportTarget, type RawImage } from "../hero/importPicture";
import { slotOf } from "@/model/look";

type Props = {
  title: string; // the picture's name
  target: ImportTarget;
  colours: number[];
  image: RawImage;
  onUse(result: Imported): void;
  onCancel(): void;
};

// The picture as chosen.
function Before({ image }: { image: RawImage }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  }, [image]);
  return <canvas ref={ref} width={image.width} height={image.height} className={styles.importPreview} aria-hidden="true" />;
}

// The picture as it will be, in the hero's colours.
function After({ rows, colours }: Imported) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, rows[0].length, rows.length);
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        ctx.fillStyle = PALETTE_8BIT[colours[slotOf(ch) - 1]];
        ctx.fillRect(x, y, 1, 1);
      }),
    );
  }, [rows, colours]);
  return <canvas ref={ref} width={rows[0].length} height={rows.length} className={styles.importPreview} aria-hidden="true" />;
}

export function ImportDialog({ title, target, colours, image, onUse, onCancel }: Props) {
  const background = useMemo(() => backgroundOf(image), [image]);
  const [remove, setRemove] = useState(background !== null);
  const result = useMemo(() => importPicture(image, target, colours, remove), [image, target, colours, remove]);
  const added = result.colours.length - colours.length;
  const use = useRef<HTMLButtonElement>(null);
  const overlay = useRef<HTMLDivElement>(null);

  // A modal: everything else on the page is inert (no clicks, no Tab) until the dialog closes.
  useEffect(() => {
    const self = overlay.current;
    if (!self) return;
    const others = [...document.body.children].filter((el) => el !== self && !el.contains(self));
    for (const el of others) el.setAttribute("inert", "");
    use.current?.focus();
    return () => {
      for (const el of others) el.removeAttribute("inert");
    };
  }, []);

  return createPortal(
    <div className={styles.overlay} ref={overlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className={styles.dialog}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <h3 id="import-title" className={styles.heroHeading}>
          Import a picture into {title}
        </h3>
        <div className={styles.beforeAfter}>
          <figure>
            <Before image={image} />
            <figcaption>Before</figcaption>
          </figure>
          <figure>
            <After {...result} />
            <figcaption>After</figcaption>
          </figure>
        </div>
        {background !== null && (
          <label className={styles.check}>
            <input type="checkbox" checked={remove} onChange={(e) => setRemove(e.target.checked)} />
            Remove background
          </label>
        )}
        {added > 0 && (
          <p className={styles.note}>
            This adds {added} colour{added === 1 ? "" : "s"} to your hero.
          </p>
        )}
        <div className={styles.drawTools}>
          <button ref={use} type="button" className={styles.primary} onClick={() => onUse(result)}>
            Use this
          </button>
          <button type="button" className={styles.swatch} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
