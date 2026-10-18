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
    let consumerId: string | undefined;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(context, 'consumerId');
      if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') consumerId = descriptor.value;
    } catch {
      /* Malformed context must not replace a safe decode diagnostic with a raw exception. */
    }
    const diagnostics: readonly [InputDiagnostic & {phase: 'decode'}] = [{scope: {identity: sceneSchemaBundles.bare.identity,
      ...(consumerId === undefined ? {} : {consumerId})}, phase: 'decode', code: 'input-format-invalid', dataPath: ''}];
    return {source, kind: 'decode-error' as const, result: {kind: 'invalid' as const, diagnostics}};
  }
  // Empty source performs no validation or execution and does not inspect context.
  if (decoded.kind === 'empty') return {...decoded, result: {kind: 'valid' as const, diagnostics: [] as const}};
  const prepared = compiled[decoded.variantId];
  if (prepared.kind !== 'compiled') return {...decoded, result: prepared};
  const result: SchemaInputValidationResult = validateSchemaInput(prepared.validator, decoded.data as SchemaJsonValue, {
    context, ownerValidate: decoded.variantId === 'bare' ? validateSceneDocumentInput : validateSceneExtensionInput});
  return {...decoded, result};
}
