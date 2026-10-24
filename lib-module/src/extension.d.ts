import type { ScratchApi, TurboWarpExtension } from './runtime-api.js';
export declare class TurboWarp3DSceneRuntimeExtension implements TurboWarpExtension {
    private readonly scratch;
    private status;
    private lastError;
    private appliedEvents;
    /** Guards against two applies interleaving their calls into one scene. */
    private applyGeneration;
    private readonly removeSourceEditors;
    private disposed;
    private readonly handleSourceEditorDispose;
    dispose(): void;
    constructor(scratch: ScratchApi);
    getInfo(): Record<string, unknown>;
    applyScene(args: {
        SOURCE: unknown;
    }): Promise<void>;
    sceneStatus(): string;
    sceneError(): string;
    isSceneReady(): boolean;
    whenSceneApplied(): boolean;
    snapshot(): Record<string, unknown>;
    /**
     * Reads the description and turns it into calls.
     *
     * A bare scene document is accepted as well as the `{scene3d, ar}` fragment, because a project
     * that only builds 3D should not have to nest its document under a key.
     */
    private planFor;
    private dispatch;
    private dispatchAFrame;
    private dispatchAR;
    private needsAFrame;
    private needsAR;
    private requireAFramePort;
    private requireARPort;
    private capability;
    private toScratchBlock;
}
