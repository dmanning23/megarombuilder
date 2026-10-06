import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Editor } from "@/editor/Editor";
import { ZOOM } from "@/editor/hero/pixels";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

let n = 0;
const makeId = () => `id-${++n}`;

export function setupHero(initial: Project = newProject("Hero", makeId), confirm = () => true) {
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(
    <Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={60_000} confirm={confirm} />,
  );
  const canvas = () => {
    const el = screen.getByTestId("hero-canvas") as HTMLCanvasElement;
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: el.width, height: el.height, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return el;
  };
  const at = (x: number, y: number) => ({ clientX: x * ZOOM + ZOOM / 2, clientY: y * ZOOM + ZOOM / 2, button: 0 });
  const press = (x: number, y: number) => {
    const el = canvas();
    fireEvent.pointerDown(el, at(x, y));
    fireEvent.pointerUp(el, at(x, y));
  };
  const drag = (from: [number, number], to: [number, number]) => {
    const el = canvas();
    fireEvent.pointerDown(el, at(...from));
    fireEvent.pointerMove(el, at(...to));
    fireEvent.pointerUp(el, at(...to));
  };
  // Closing the editor saves at once, so the last save is what was made (nothing is saved when
  // the game is back to how it opened).
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls.at(-1)?.[0] ?? initial;
  };
  const open = () => userEvent.click(screen.getByRole("button", { name: "Hero" }));
  const choose = (name: string | RegExp) => userEvent.click(screen.getByRole("button", { name }));
  return { press, drag, saved, open, choose, save };
}
