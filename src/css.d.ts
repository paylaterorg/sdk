/**
 * @dev Ambient type declarations.
 *
 * The build pipeline (tsup) loads `.css` imports as raw text strings and
 * `.ico` / `.svg` imports as base64 `data:` URIs via the `loader` config in
 * `tsup.config.ts`. These module declarations teach `tsc` the same so
 * `tsc --noEmit` matches the runtime behaviour.
 */

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.ico" {
  const dataUri: string;
  export default dataUri;
}

declare module "*.svg" {
  const dataUri: string;
  export default dataUri;
}
