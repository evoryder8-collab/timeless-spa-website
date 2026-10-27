// Shared state between the hero cairn and the travelling stone, so the top stone of the cairn
// can lift off and become the stone that follows the visitor (and come back again).
export const bridge = {
  /** the hero scene is on the page and rendering */
  heroActive: false,
  /** the hero wants its top stone in the cairn (the visitor is near the top of the page) */
  wantsHome: true,
  /** the travelling stone is sitting in the cairn, so the hero draws it */
  docked: true,
  /** where the cairn's top stone is on screen, in CSS pixels */
  top: { x: 0, y: 0, size: 0 },
};
