/**
 * The AlphaTexExporter/AlphaTexImporter live only in alphaTab's "core" build
 * (dist/alphaTab.core.mjs). The default ESM entry tree-shakes them out, so the
 * AlphaTex diff engine imports them through the `@coderline/alphatab/core` alias
 * configured in vite.config.ts. This ambient module re-uses the package's public
 * typings for that alias.
 */
declare module '@coderline/alphatab/core' {
  export { exporter, importer, model, Settings } from '@coderline/alphatab'
}
