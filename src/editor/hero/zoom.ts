// How big to draw a picture: whole screen pixels per picture pixel, so pixels stay square and crisp,
// as big as the space allows, from 12 (the canvas scrolls if even that doesn't fit) to 24.

export const MIN_ZOOM = 12;
export const MAX_ZOOM = 24;

export function chooseZoom(space: { w: number; h: number }, picture: { w: number; h: number }): number {
  const fit = Math.min(Math.floor(space.w / picture.w), Math.floor(space.h / picture.h));
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit));
}
