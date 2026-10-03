// jsdom has no canvas. Components check for a missing context, so tests see null, quietly.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
