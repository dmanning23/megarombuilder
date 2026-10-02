import { NO_INPUT, type Input } from "@/runtime/sim/state";

export const KEY_MAP: Record<string, keyof Input> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyZ: "jump",
  KeyX: "shoot",
};

export function createKeyboard(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
): { read(): Input; dispose(): void } {
  let held: Input = { ...NO_INPUT };

  const set = (down: boolean) => (event: Event) => {
    const control = KEY_MAP[(event as KeyboardEvent).code];
    if (!control) return;
    held[control] = down;
    event.preventDefault(); // stop the arrow keys scrolling the page
  };
  const onDown = set(true);
  const onUp = set(false);
  // Keys released while the window is unfocused never send keyup, so release them all.
  const onBlur = () => {
    held = { ...NO_INPUT };
  };

  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  target.addEventListener("blur", onBlur);
  return {
    read: () => ({ ...held }),
    dispose() {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
      target.removeEventListener("blur", onBlur);
    },
  };
}
