import type {SourceBinding, SourceEditorOptions, SourceValidation} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import {extensionConfig} from './config.js';

function checkedSource(value: {source: string; result: {kind: 'valid' | 'invalid' | 'execution-error' | 'schema-error'; diagnostics: readonly {code: string; dataPath?: string}[]}}): SourceValidation {
  return value.result.kind === 'valid'
    ? {source: value.source, result: {kind: 'valid', diagnostics: []}}
    : {source: value.source, result: {kind: value.result.kind, diagnostics: value.result.diagnostics}};
}
import {sceneSchemaBundles, decodeSceneSource, validateSceneSource} from './editor-schema.js';
export function createSourceEditorOptions(nowMs: () => number = Date.now): readonly SourceEditorOptions[] {
  const context = () => ({consumerId: extensionConfig.id, nowMs: nowMs(), settings: null});
  return [
    {apiVersion: 1, extensionId: extensionConfig.id, editorId: 'scene-source', opcodes: ["applyScene"].map(opcode => `${extensionConfig.id}_${opcode}`), bindings: [{argument: 'SOURCE', sourceOnlyVariants: [{variantId: 'empty', format: 'yaml'}], variants: Object.entries(sceneSchemaBundles).flatMap(([variantId, schemaBundle]) => (['json', 'yaml'] as const).map(format => ({variantId, format, schemaBundle}))), decode: source => {const decoded = decodeSceneSource(source); if (decoded.kind === 'empty') return {source, format: 'yaml' as const, variantId: 'empty', data: null}; return {...decoded, data: decoded.data as ReturnType<SourceBinding['decode']>['data']};}, validateSource: (source, context) => checkedSource(validateSceneSource(source, context))}], validationContext: context}
  ];
}

/** Optional capability: old GUIs continue executing blocks without editor registration. */
export function registerSourceEditors(scratch: unknown, nowMs: () => number = Date.now): () => void {
  const api = (scratch as {gui?: {blockEditors?: {apiVersion?: number; registerSourceEditor?: (options: SourceEditorOptions) => () => void}}})?.gui?.blockEditors;
  if (api?.apiVersion !== 1 || typeof api.registerSourceEditor !== 'function') return () => {};
  const removers: (() => void)[] = [];
  try {
    for (const options of createSourceEditorOptions(nowMs)) removers.push(api.registerSourceEditor(options));
  } catch {
    for (const remove of removers.reverse()) remove();
    return () => {};
  }
  let active = true;
  return () => {if (active) {active = false; for (const remove of removers.reverse()) remove();}};
}
