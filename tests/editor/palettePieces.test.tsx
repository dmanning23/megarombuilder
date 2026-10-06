// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyCommand } from "@/commands/registry";
import { snowPack } from "@/content/snow/pack";
import { Palette } from "@/editor/components/Palette";
import { Editor } from "@/editor/Editor";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";

afterEach(cleanup);

async function pieces(canSlide: boolean) {
  const onTool = vi.fn();
  render(<Palette pack={snowPack} tool={{ kind: "erase" }} onTool={onTool} canSlide={canSlide} />);
  await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
  return onTool;
}

describe("pieces that need slide", () => {
  it("are greyed out, with a note, when the hero can't slide", async () => {
    const onTool = await pieces(false);
    const crawl = screen.getByRole("button", { name: /Crawl space/ });
    expect(crawl.getAttribute("aria-disabled")).toBe("true");
    expect(crawl.textContent).toContain("Needs slide");
    await userEvent.click(crawl);
    expect(onTool).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Gap/ })).toHaveProperty("disabled", false);
  });

  it("can be used when the hero can slide", async () => {
    const onTool = await pieces(true);
    await userEvent.click(screen.getByRole("button", { name: /Crawl space/ }));
    expect(onTool).toHaveBeenCalledWith({ kind: "piece", pieceId: "crawl-space", settings: { length: 4 } });
  });

  it("does nothing in the level when the hero loses slide with a crawl space chosen", async () => {
    let project = newProject("Slide", () => `id-${Math.random()}`);
    project = (applyCommand(project, { name: "setHeroAbilities", args: { slide: true } }, { pack: snowPack }) as { ok: true; project: Project }).project;
    const save = vi.fn<(p: Project) => Promise<void>>(async () => {});
    const view = render(<Editor initial={project} store={{ save }} saveDelay={60_000} />);
    await userEvent.click(screen.getByRole("tab", { name: "Pieces" }));
    await userEvent.click(screen.getByRole("button", { name: /^Crawl space/ }));
    await userEvent.click(screen.getByRole("button", { name: "Hero" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Slide" })).getByRole("button", { name: "Off" }));
    await userEvent.click(screen.getByRole("button", { name: "Level" }));
    const canvas = screen.getByTestId("zone-canvas");
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 512, height: 480, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40, button: 0 });
    fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40, button: 0 });
    view.unmount();
    const zone = save.mock.calls[save.mock.calls.length - 1][0].levels[0].zones[0];
    expect(zone.tiles.slice(0, 16 * 12).every((t) => t === 0)).toBe(true); // no tunnel stamped
  });
});
