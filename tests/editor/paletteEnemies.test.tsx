// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand } from "@/commands/registry";
import { snowPack } from "@/content/snow/pack";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(cleanup);

function withFang(): Project {
  const project = newProject("Palette", () => `id-${Math.random()}`);
  const result = applyCommand(project, { name: "addEnemy", args: { enemyId: "e1", name: "Frost Fang", behaviour: "walker" } }, { pack: snowPack });
  if (!result.ok) throw new Error(result.error);
  return result.project;
}

describe("the kid's enemies in the palette", () => {
  it("come first, marked Yours, and can be placed", async () => {
    const save = vi.fn<(p: Project) => Promise<void>>(async () => {});
    const view = render(<Editor initial={withFang()} store={{ save }} saveDelay={60_000} />);
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    const swatches = screen.getAllByRole("button").filter((b) => b.className.includes("swatch"));
    expect(swatches[0].textContent).toBe("Frost Fang Yours");
    await userEvent.click(screen.getByRole("button", { name: "Frost Fang Yours" }));
    const canvas = screen.getByTestId("zone-canvas");
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 512, height: 480, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerDown(canvas, { clientX: 6 * 32 + 16, clientY: 12 * 32 + 16, button: 0 });
    fireEvent.pointerUp(canvas, { clientX: 6 * 32 + 16, clientY: 12 * 32 + 16, button: 0 });
    view.unmount();
    const things = save.mock.calls.at(-1)![0].levels[0].zones[0].things;
    expect(things).toContainEqual(expect.objectContaining({ type: "own-e1", x: 6, y: 12, settings: {} }));
  });

  it("leave out the kid's boss: it goes in the boss room from the Boss tab", async () => {
    const result = applyCommand(withFang(), { name: "createBoss", args: { name: "Volt Viper" } }, { pack: snowPack });
    if (!result.ok) throw new Error(result.error);
    render(<Editor initial={result.project} store={{ save: async () => {} }} saveDelay={60_000} />);
    await userEvent.click(screen.getByRole("tab", { name: "Enemies and items" }));
    expect(screen.queryByRole("button", { name: /Volt Viper/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Blizzard Bot/ })).toBeTruthy();
  });
});
