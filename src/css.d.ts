/**
 * @dev Ambient type declarations.
 *
 * The build pipeline (tsup) loads `.css` imports as raw text strings via
 * `loader: { ".css": "text" }`. This module declaration teaches `tsc` the
 * same so `tsc --noEmit` matches the runtime behaviour.
 */

declare module "*.css" {
  const content: string;
  export default content;
}
