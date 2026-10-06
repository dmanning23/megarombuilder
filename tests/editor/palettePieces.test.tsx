// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snowPack } from "@/content/snow/pack";
import { Palette } from "@/editor/components/Palette";

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
    expect(crawl).toHaveProperty("disabled", true);
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
});
