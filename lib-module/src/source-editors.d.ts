import type { SourceEditorOptions } from '@kubohiroya/turbowarp-extension-data-editor/schema';
export declare function createSourceEditorOptions(nowMs?: () => number): readonly SourceEditorOptions[];
/**
 * Optional capability: old GUIs continue executing blocks without editor registration.
 * Every project load disposes the runtime, which releases the registrations, but the extension
 * stays loaded for the next project, so they are registered again once that project has loaded.
 * Only the returned owner dispose is final.
 */
export declare function registerSourceEditors(scratch: unknown, nowMs?: () => number): () => void;
