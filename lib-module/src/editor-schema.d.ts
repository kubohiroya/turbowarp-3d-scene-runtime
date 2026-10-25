import type { SchemaValidationContext } from '@kubohiroya/turbowarp-extension-data-editor/schema';
export { decodeSceneSource } from './scene-input.js';
export { sceneSchemaBundles } from '@kubohiroya/turbowarp-scene-graph/editor-schema';
/** Headless adapter: empty source is a no-op; no runtime capability is inspected. */
export declare function validateSceneSource(source: string, context: SchemaValidationContext): {
    source: string;
    kind: "decode-error";
    result: {
        kind: "invalid";
        diagnostics: readonly [import("@kubohiroya/turbowarp-extension-data-editor/schema").SchemaDiagnosticBase & {
            readonly phase: "decode";
            readonly code: "input-format-invalid" | "variant-unrecognized";
            readonly dataPath: import("@kubohiroya/turbowarp-extension-data-editor/schema").JsonPointer;
        } & {
            phase: "decode";
        }];
    };
} | {
    result: {
        kind: "valid";
        diagnostics: readonly [];
    };
    kind: "empty";
    source: string;
    variantId: "empty";
    data?: never;
    format?: never;
} | {
    result: {
        readonly kind: "execution-error";
        readonly diagnostics: import("@kubohiroya/turbowarp-extension-data-editor/schema").NonEmpty<import("@kubohiroya/turbowarp-extension-data-editor/schema").StructuralExecutionDiagnostic | import("@kubohiroya/turbowarp-extension-data-editor/schema").OwnerExecutionDiagnostic>;
    };
    kind: "decoded";
    source: string;
    data: object;
    format: "json" | "yaml";
    variantId: "wrapper" | "bare";
} | {
    result: {
        readonly kind: "valid";
        readonly diagnostics: readonly [];
    } | {
        readonly kind: "invalid";
        readonly diagnostics: import("@kubohiroya/turbowarp-extension-data-editor/schema").NonEmpty<(import("@kubohiroya/turbowarp-extension-data-editor/schema").SchemaDiagnosticBase & {
            readonly phase: "structure";
            readonly code: "input-not-json" | "schema-data-invalid";
            readonly dataPath: import("@kubohiroya/turbowarp-extension-data-editor/schema").JsonPointer;
            readonly keyword?: string;
        }) | (import("@kubohiroya/turbowarp-extension-data-editor/schema").SchemaDiagnosticBase & {
            readonly phase: "semantic";
            readonly code: "owner-input-invalid";
            readonly dataPath: import("@kubohiroya/turbowarp-extension-data-editor/schema").JsonPointer;
            readonly ruleId: string;
        })>;
    };
    kind: "decoded";
    source: string;
    data: object;
    format: "json" | "yaml";
    variantId: "wrapper" | "bare";
};
