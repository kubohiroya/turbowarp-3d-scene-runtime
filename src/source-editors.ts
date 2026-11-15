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

/**
 * Optional capability: old GUIs continue executing blocks without editor registration.
 * Every project load disposes the runtime, which releases the registrations, but the extension
 * stays loaded for the next project, so they are registered again once that project has loaded.
 * Only the returned owner dispose is final.
 */
export function registerSourceEditors(scratch: unknown, nowMs: () => number = Date.now): () => void {
  const host = scratch as {gui?: {blockEditors?: {apiVersion?: number; registerSourceEditor?: (options: SourceEditorOptions) => () => void}};
    vm?: {runtime?: {on?: (event: string, listener: () => void) => void; off?: (event: string, listener: () => void) => void}}} | undefined;
  const api = host?.gui?.blockEditors;
  if (api?.apiVersion !== 1 || typeof api.registerSourceEditor !== 'function') return () => {};
  const runtime = host?.vm?.runtime;
  const removers: (() => void)[] = [];
  const release = () => {for (const remove of removers.splice(0).reverse()) remove();};
  const register = (): boolean => {
    try {
      for (const options of createSourceEditorOptions(nowMs)) removers.push(api.registerSourceEditor!(options));
      return true;
    } catch {
      release();
      return false;
    }
  };
  if (!register()) return () => {};
  let active = true;
  let released = false;
  const releaseForProjectLoad = () => {
    if (!active || released) return;
    released = true;
    release();
  };
  const restoreAfterProjectLoad = () => {
    if (active && released && register()) released = false;
  };
  runtime?.on?.('RUNTIME_DISPOSED', releaseForProjectLoad);
  runtime?.on?.('PROJECT_LOADED', restoreAfterProjectLoad);
  return () => {
    if (!active) return;
    active = false;
    runtime?.off?.('RUNTIME_DISPOSED', releaseForProjectLoad);
    runtime?.off?.('PROJECT_LOADED', restoreAfterProjectLoad);
    release();
  };
}
