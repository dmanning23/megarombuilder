"use client";

import { useState } from "react";
import { tidyName } from "@/model/schema";
import styles from "../editor.module.css";

// The name box saves when it loses focus or Enter is pressed, if the name changed. It is keyed by
// the stored name, so undo and redo show through; a refused name goes back to the stored one.
export function NameField({ name, onRename }: { name: string; onRename(name: string): void }) {
  const [text, setText] = useState(name);
  const save = () => {
    if (tidyName(text) && tidyName(text) !== tidyName(name)) onRename(tidyName(text));
    setText(name);
  };
  return (
    <label className={styles.field}>
      Name
      <input
        value={text}
        maxLength={40}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
    </label>
  );
}
