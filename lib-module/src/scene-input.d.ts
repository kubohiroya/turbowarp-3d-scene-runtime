/** Same branch selection as runtime planFor, with raw source/data retained. */
export declare function decodeSceneSource(source: string): {
    kind: "empty";
    source: string;
    variantId: "empty";
    data?: never;
    format?: never;
} | {
    kind: "decoded";
    source: string;
    data: object;
    format: "json" | "yaml";
    variantId: "wrapper" | "bare";
};
