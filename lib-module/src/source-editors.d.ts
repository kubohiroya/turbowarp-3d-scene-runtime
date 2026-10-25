import type { SourceEditorOptions } from '@kubohiroya/turbowarp-extension-data-editor/schema';
export declare function createSourceEditorOptions(nowMs?: () => number): readonly SourceEditorOptions[];
/** Optional capability: old GUIs continue executing blocks without editor registration. */
export declare function registerSourceEditors(scratch: unknown, nowMs?: () => number): () => void;
