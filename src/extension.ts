import {registerSourceEditors} from './source-editors.js';
import {
  createTurboWarpExtensionPlan,
  type TurboWarpExtensionCall
} from '@kubohiroya/turbowarp-scene-graph';
import {decodeSceneSource} from './scene-input.js';

import {extensionConfig} from './config';
import definitions from './block-definitions.json';

type BlockTypeName = 'COMMAND' | 'REPORTER' | 'BOOLEAN' | 'HAT';
type ArgumentTypeName = 'STRING';
type SceneStatus = 'idle' | 'applying' | 'ready' | 'error';

interface DefinitionArgument {
  type: ArgumentTypeName;
  defaultValue: string;
}

interface BlockDefinition {
  opcode: string;
  blockType: BlockTypeName;
  text: string;
  description: string;
  arguments: Record<string, DefinitionArgument>;
}

/**
 * The part of `turbowarp-aframe`'s runtime capability a call plan needs.
 *
 * Methods are feature-detected rather than version-gated, which is how that capability is
 * documented to grow.
 */
interface AFrameScenePort {
  createScene(layer: string, mode: string): Promise<void>;
  createNode(type: string, id: string, parent: string): void;
  addClass(className: string, selector: string): void;
  setData(selector: string, key: string, value: string): void;
  setAttribute(selector: string, name: string, value: string): void;
}

/** The part of `turbowarp-ar`'s runtime capability a call plan needs. */
interface ARScenePort {
  createARScene(cameraId: string, layer: string): Promise<void>;
  stopARScene(): Promise<void>;
  defineARTarget(targetId: string): void;
  attachSelectorToARTarget(selector: string, targetId: string): void;
}

const AFRAME_CAPABILITY_KEY = 'turbowarpAFrameCapability';
const AR_CAPABILITY_KEY = 'turbowarpARCapability';
const AFRAME_PORT_METHODS = [
  'createScene',
  'createNode',
  'addClass',
  'setData',
  'setAttribute'
] as const;
const AR_PORT_METHODS = [
  'createARScene',
  'stopARScene',
  'defineARTarget',
  'attachSelectorToARTarget'
] as const;

const blockDefinitions = definitions.blocks as readonly BlockDefinition[];

export class TurboWarp3DSceneRuntimeExtension implements TurboWarpExtension {
  private status: SceneStatus = 'idle';
  private lastError = '';
  private appliedEvents = 0;
  /** Guards against two applies interleaving their calls into one scene. */
  private applyGeneration = 0;

  private readonly removeSourceEditors: () => void;
  private readonly handleSourceEditorDispose = (): void => {
    this.removeSourceEditors();
    const runtime = Scratch.vm?.runtime as {off?: (event: string, listener: () => void) => void} | undefined;
    runtime?.off?.('RUNTIME_DISPOSED', this.handleSourceEditorDispose);
  };

  public constructor() {
    this.removeSourceEditors = registerSourceEditors(Scratch);
    const runtime = Scratch.vm?.runtime as {on?: (event: string, listener: () => void) => void} | undefined;
    runtime?.on?.('RUNTIME_DISPOSED', this.handleSourceEditorDispose);
  }

  public getInfo(): Record<string, unknown> {
    return {
      id: extensionConfig.id,
      name: Scratch.translate(definitions.extensionName),
      docsURI: extensionConfig.docsURI,
      blockIconURI: extensionConfig.blockIconURI,
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
    };
  }

  public async applyScene(args: {SOURCE: unknown}): Promise<void> {
    const generation = ++this.applyGeneration;
    this.status = 'applying';
    this.lastError = '';
    try {
      const calls = this.planFor(Scratch.Cast.toString(args.SOURCE));
      await this.dispatch(calls);
      if (generation !== this.applyGeneration) return;
      this.status = 'ready';
      this.appliedEvents += 1;
    } catch (error) {
      if (generation !== this.applyGeneration) return;
      this.status = 'error';
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  public sceneStatus(): string {
    return this.status;
  }

  public sceneError(): string {
    return this.lastError;
  }

  public isSceneReady(): boolean {
    return this.status === 'ready';
  }

  public whenSceneApplied(): boolean {
    if (this.appliedEvents <= 0) return false;
    this.appliedEvents -= 1;
    return true;
  }

  public snapshot(): Record<string, unknown> {
    return {status: this.status, error: this.lastError, pendingAppliedEvents: this.appliedEvents};
  }

  /**
   * Reads the description and turns it into calls.
   *
   * A bare scene document is accepted as well as the `{scene3d, ar}` fragment, because a project
   * that only builds 3D should not have to nest its document under a key.
   */
  private planFor(source: string): TurboWarpExtensionCall[] {
    const decoded = decodeSceneSource(source);
    if (decoded.kind === 'empty') return [];
    const fragment = decoded.variantId === 'wrapper' ? decoded.data : {scene3d: decoded.data};
    return createTurboWarpExtensionPlan(fragment as Parameters<typeof createTurboWarpExtensionPlan>[0]);
  }

  private async dispatch(calls: readonly TurboWarpExtensionCall[]): Promise<void> {
    if (calls.length === 0) return;
    const aframe = this.needsAFrame(calls) ? this.requireAFramePort() : null;
    const ar = this.needsAR(calls) ? this.requireARPort() : null;

    for (const call of calls) {
      if (call.extension === 'turbowarp-aframe') {
        await this.dispatchAFrame(aframe as AFrameScenePort, call);
      } else {
        await this.dispatchAR(ar as ARScenePort, call);
      }
    }
  }

  private async dispatchAFrame(
    port: AFrameScenePort,
    call: Extract<TurboWarpExtensionCall, {extension: 'turbowarp-aframe'}>
  ): Promise<void> {
    switch (call.opcode) {
      case 'createScene':
        await port.createScene(call.args.LAYER, call.args.MODE);
        return;
      case 'createNode':
        port.createNode(call.args.TYPE, call.args.ID, call.args.PARENT);
        return;
      case 'addClass':
        port.addClass(call.args.CLASS, call.args.SELECTOR);
        return;
      case 'setData':
        port.setData(call.args.SELECTOR, call.args.KEY, call.args.VALUE);
        return;
      case 'setAttribute':
        port.setAttribute(call.args.SELECTOR, call.args.NAME, call.args.VALUE);
        return;
    }
  }

  private async dispatchAR(
    port: ARScenePort,
    call: Extract<TurboWarpExtensionCall, {extension: 'turbowarp-ar'}>
  ): Promise<void> {
    switch (call.opcode) {
      case 'createARScene':
        await port.stopARScene();
        await port.createARScene(call.args.CAMERA_ID, call.args.LAYER);
        return;
      case 'defineARTarget':
        port.defineARTarget(call.args.TARGET_ID);
        return;
      case 'attachSelectorToARTarget':
        port.attachSelectorToARTarget(call.args.SELECTOR, call.args.TARGET_ID);
        return;
    }
  }

  private needsAFrame(calls: readonly TurboWarpExtensionCall[]): boolean {
    return calls.some((call) => call.extension === 'turbowarp-aframe');
  }

  private needsAR(calls: readonly TurboWarpExtensionCall[]): boolean {
    return calls.some((call) => call.extension === 'turbowarp-ar');
  }

  private requireAFramePort(): AFrameScenePort {
    const port = this.capability<AFrameScenePort>(AFRAME_CAPABILITY_KEY, AFRAME_PORT_METHODS);
    if (port === null) {
      throw new Error(
        'turbowarp-aframe 0.7.0 or newer must be loaded before a 3D scene can be applied.'
      );
    }
    return port;
  }

  private requireARPort(): ARScenePort {
    const port = this.capability<ARScenePort>(AR_CAPABILITY_KEY, AR_PORT_METHODS);
    if (port === null) {
      throw new Error(
        'turbowarp-ar 0.4.0 or newer must be loaded before a scene with an ar fragment can be applied.'
      );
    }
    return port;
  }

  private capability<T>(key: string, methods: readonly string[]): T | null {
    const candidate = Scratch.vm?.runtime?.[key];
    if (typeof candidate !== 'object' || candidate === null) return null;
    const port = candidate as Record<string, unknown>;
    for (const method of methods) {
      if (typeof port[method] !== 'function') return null;
    }
    return candidate as T;
  }

  private toScratchBlock(block: BlockDefinition): Record<string, unknown> {
    const text = Scratch.translate(block.text);
    // Separate a leading digit from the VM's icon placeholder ("%2" + "3D" becomes "%23D").
    const displayText = /^\d/u.test(text) ? ` ${text}` : text;
    return {
      opcode: block.opcode,
      blockType: Scratch.BlockType[block.blockType],
      text: displayText,
      ...(block.blockType === 'HAT' ? {isEdgeActivated: false} : {}),
      arguments: Object.fromEntries(
        Object.entries(block.arguments).map(([name, argument]) => [
          name,
          {
            type: Scratch.ArgumentType[argument.type],
            defaultValue: argument.defaultValue
          }
        ])
      )
    };
  }
}
