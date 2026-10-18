import {compileSchemaBundle, validateSchemaInput} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import type {SchemaJsonValue, SchemaValidationContext, SchemaInputValidationResult, InputDiagnostic} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import {sceneSchemaBundles, validateSceneDocumentInput, validateSceneExtensionInput} from '@kubohiroya/turbowarp-scene-graph/editor-schema';
import {decodeSceneSource} from './scene-input.js';
export {decodeSceneSource} from './scene-input.js';
export {sceneSchemaBundles} from '@kubohiroya/turbowarp-scene-graph/editor-schema';
const compiled = {bare: compileSchemaBundle(sceneSchemaBundles.bare), wrapper: compileSchemaBundle(sceneSchemaBundles.wrapper)};
/** Headless adapter: empty source is a no-op; no runtime capability is inspected. */
export function validateSceneSource(source: string, context: SchemaValidationContext) {
  let decoded: ReturnType<typeof decodeSceneSource>;
  try {decoded = decodeSceneSource(source);} catch {
    const diagnostics: readonly [InputDiagnostic & {phase: 'decode'}] = [{scope: {identity: sceneSchemaBundles.bare.identity, consumerId: context.consumerId}, phase: 'decode', code: 'input-format-invalid', dataPath: ''}];
    return {source, kind: 'decode-error' as const, result: {kind: 'invalid' as const, diagnostics}};
  }
  if (decoded.kind === 'empty') return {...decoded, result: {kind: 'valid' as const, diagnostics: [] as const}};
  const prepared = compiled[decoded.variantId];
  if (prepared.kind !== 'compiled') return {...decoded, result: prepared};
  const result: SchemaInputValidationResult = validateSchemaInput(prepared.validator, decoded.data as SchemaJsonValue, {
    context, ownerValidate: decoded.variantId === 'bare' ? validateSceneDocumentInput : validateSceneExtensionInput});
  return {...decoded, result};
}
