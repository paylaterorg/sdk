/**
 * @dev Tiny deterministic QR-shaped SVG generator for the demo eID flow.
 *
 * Real QR encoding would require a 30+ KB encoder (qrcode, qr-image, etc.)
 * but the demo flow auto-advances after a few seconds and the customer never
 * actually scans the code — so a deterministic noise pattern with the
 * recognizable QR finder squares is enough to keep the UI honest.
 */

/**
 * @title makeFakeQrSvg
 * @description Build a deterministic 21×21 QR-shaped SVG from a seed string. It is not a real QR code — the demo flow auto-advances after a few seconds and the user never scans it — but the resulting pattern keeps the UI honest without bundling a real QR encoder.
 * @param {string} seed - Any stable string (we use the BNPL reference) to seed the FNV-1a hash + xorshift RNG.
 * @returns {string} A serialized SVG string with positional finder squares and a pseudo-random module pattern.
 */
export function makeFakeQrSvg(seed: string): string {
  let h = 2166136261;

  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  const rng = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };

  const SIZE = 21;

  let cells = "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const isFinder = (x < 7 && y < 7) || (x >= SIZE - 7 && y < 7) || (x < 7 && y >= SIZE - 7);
      const finderEdge =
        isFinder &&
        (x === 0 ||
          x === 6 ||
          y === 0 ||
          y === 6 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
          (x >= SIZE - 7 && (x === SIZE - 7 || x === SIZE - 1)) ||
          (y >= SIZE - 7 && (y === SIZE - 7 || y === SIZE - 1)));

      const filled = isFinder ? finderEdge : rng() > 0.55;
      if (filled) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  }

  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${cells}</svg>`;
}
