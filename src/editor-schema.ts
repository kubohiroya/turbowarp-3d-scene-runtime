import type {SchemaJsonValue, SchemaValidationContext, SchemaInputValidationResult, InputDiagnostic} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import {sceneSchemaBundles, validateSceneDocumentInput, validateSceneExtensionInput} from '@kubohiroya/turbowarp-scene-graph/editor-schema';
import {decodeSceneSource} from './scene-input.js';
export {decodeSceneSource} from './scene-input.js';
export {sceneSchemaBundles} from '@kubohiroya/turbowarp-scene-graph/editor-schema';
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
  const identity = sceneSchemaBundles[decoded.variantId].identity;
  let consumerId: string;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(context);
    if (typeof descriptors.consumerId?.value !== 'string' ||
        typeof descriptors.nowMs?.value !== 'number' || !Number.isFinite(descriptors.nowMs.value) ||
        !descriptors.settings || !('value' in descriptors.settings)) throw new TypeError();
    consumerId = descriptors.consumerId.value;
  } catch {
    const result: SchemaInputValidationResult = {kind: 'execution-error', diagnostics: [{
      scope: {identity}, phase: 'execution', operation: 'semantic', code: 'owner-context-invalid',
    }]};
    return {...decoded, result};
  }
  const scope = {identity, consumerId};
  // The common GUI checks Schema constraints; owner rules keep the runtime acceptance boundary.
  const ownerValidate = decoded.variantId === 'bare' ? validateSceneDocumentInput : validateSceneExtensionInput;
  const ownerResult = ownerValidate(decoded.data as SchemaJsonValue, context);
  const result: SchemaInputValidationResult = ownerResult.kind === 'valid'
    ? {kind: 'valid', diagnostics: []}
    : {kind: 'invalid', diagnostics: ownerResult.issues.map(issue => ({
        scope, phase: 'semantic' as const, code: 'owner-input-invalid' as const,
        dataPath: issue.dataPath, ruleId: issue.ruleId,
      })) as [InputDiagnostic & {phase: 'semantic'}, ...(InputDiagnostic & {phase: 'semantic'})[]]};
  return {...decoded, result};
}
