// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowHero } from "@/content/snow/hero";
import { Editor } from "@/editor/Editor";
import type { RawImage } from "@/editor/hero/importPicture";
import { MAX_FILE_BYTES, NOT_A_PICTURE, readPicture } from "@/editor/hero/readPicture";
import { newProject } from "@/editor/newProject";
import type { Project } from "@/model/schema";
import { pictureRows } from "@/model/hero";

afterEach(cleanup);

let n = 0;
const makeId = () => `id-${++n}`;

// A 16 by 24 picture: see-through, with a red block, or on a white background.
function picture(background: "clear" | "white"): RawImage {
  const data: number[] = [];
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 16; x++) {
      const block = x >= 4 && x < 12 && y >= 8;
      if (block) data.push(248, 56, 0, 255);
      else if (background === "white") data.push(248, 248, 248, 255);
      else data.push(0, 0, 0, 0);
    }
  }
  return { width: 16, height: 24, data };
}

function setup(read: (file: File) => Promise<RawImage>) {
  const initial = newProject("Import", makeId);
  const save = vi.fn<(project: Project) => Promise<void>>(async () => {});
  const view = render(<Editor initial={initial} store={{ save }} makeId={makeId} saveDelay={60_000} readPicture={read} />);
  const saved = (): Project => {
    view.unmount();
    return save.mock.calls.at(-1)?.[0] ?? initial;
  };
  const choose = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Characters" }));
    await userEvent.upload(screen.getByLabelText("Picture file"), new File(["x"], "hero.png", { type: "image/png" }));
  };
  return { saved, choose };
}

describe("importing a picture", () => {
  it("shows before and after, and puts the picture in the pose as one undo step", async () => {
    const { saved, choose } = setup(async () => picture("clear"));
    await choose();
    expect(screen.getByRole("dialog", { name: "Import a picture into Stand frame 1" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Remove background" })).toBeNull(); // already see-through
    expect(screen.getByText("This adds 1 colour to your hero.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Redo" }));
    const look = saved().hero.look;
    expect(look.colours).toHaveLength(8);
    expect(pictureRows(look, "stand")[8]).toBe("....88888888....");
    expect(pictureRows(look, "stand")[0]).toBe("................");
  });

  it("undoes the colours and the picture together", async () => {
    const { saved, choose } = setup(async () => picture("clear"));
    await choose();
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().hero.look).toEqual(snowHero);
  });

  it("changes nothing on Cancel", async () => {
    const { saved, choose } = setup(async () => picture("clear"));
    await choose();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saved().hero.look).toEqual(snowHero);
  });

  it("removes a plain background unless told not to", async () => {
    const removed = setup(async () => picture("white"));
    await removed.choose();
    expect(screen.getByRole("checkbox", { name: "Remove background" })).toHaveProperty("checked", true);
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(pictureRows(removed.saved().hero.look, "stand")[0]).toBe("................");
    cleanup();

    const kept = setup(async () => picture("white"));
    await kept.choose();
    await userEvent.click(screen.getByRole("checkbox", { name: "Remove background" }));
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(pictureRows(kept.saved().hero.look, "stand")[0]).toBe("4444444444444444"); // white is the snow hero's colour 4
  });

  it("says plainly when a file isn't a picture, and changes nothing", async () => {
    const { saved, choose } = setup(async () => {
      throw new Error(NOT_A_PICTURE);
    });
    await choose();
    expect((await screen.findByRole("alert")).textContent).toContain("That file isn't a picture we can use. Try a PNG.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saved().hero.look).toEqual(snowHero);
  });
});

describe("the import dialog and the keyboard", () => {
  it("keeps the keyboard in the dialog: the rest of the page is inert, and Use this has focus", async () => {
    const { choose } = setup(async () => picture("clear"));
    await choose();
    const dialog = screen.getByRole("dialog", { name: "Import a picture into Stand frame 1" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Use this" }));
    const others = [...document.body.children].filter((el) => !el.contains(dialog));
    expect(others.length).toBeGreaterThan(0);
    for (const el of others) expect(el.hasAttribute("inert")).toBe(true);
  });

  it("closes on Escape and gives focus back to Import picture", async () => {
    const { choose } = setup(async () => picture("clear"));
    await choose();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    for (const el of document.body.children) expect(el.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Import picture" }));
  });

  it("gives focus back to Import picture after Use this", async () => {
    const { choose } = setup(async () => picture("clear"));
    await choose();
    await userEvent.click(screen.getByRole("button", { name: "Use this" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Import picture" }));
  });

  it("is not caught in the hero screen's lock", async () => {
    const { choose } = setup(async () => picture("clear"));
    await choose();
    expect(screen.getByRole("dialog").closest("fieldset")).toBeNull();
  });
});

describe("readPicture", () => {
  it("refuses files over 5 MB", async () => {
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "huge.png", { type: "image/png" });
    await expect(readPicture(big)).rejects.toThrow(NOT_A_PICTURE);
  });

  it("refuses files the browser can't read as a picture", async () => {
    await expect(readPicture(new File(["not a picture"], "notes.txt", { type: "text/plain" }))).rejects.toThrow(NOT_A_PICTURE);
  });
});
