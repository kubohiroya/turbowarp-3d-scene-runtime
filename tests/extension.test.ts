import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {TurboWarp3DSceneRuntimeExtension} from '../src/extension.js';

function aframePort() {
  return {
    createScene: vi.fn(async () => {}),
    createNode: vi.fn(),
    addClass: vi.fn(),
    setData: vi.fn(),
    setAttribute: vi.fn()
  };
}

function arPort() {
  return {
    createARScene: vi.fn(async () => {}),
    stopARScene: vi.fn(async () => {}),
    defineARTarget: vi.fn(),
    attachSelectorToARTarget: vi.fn()
  };
}

function stubScratch(runtime: Record<string, unknown> = {}) {
  vi.stubGlobal('Scratch', {
    vm: {runtime},
    extensions: {unsandboxed: true, register: vi.fn()},
    BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'boolean', HAT: 'hat'},
    ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean'},
    Cast: {
      toString: (value: unknown) => String(value),
      toNumber: (value: unknown) => Number(value),
      toBoolean: (value: unknown) => value === true || value === 'true'
    },
    translate: (message: string | {default: string}) =>
      typeof message === 'string' ? message : message.default
  });
}

const SCENE = [
  'formatVersion: 1',
  'root:',
  '  children:',
  '    - type: box',
  '      id: card',
  '      class: monster',
  '      data:',
  '        zone: field',
  '      attributes:',
  '        position: 0 1 -3'
].join('\n');

beforeEach(() => stubScratch());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TurboWarp3DSceneRuntimeExtension', () => {
  it('publishes its metadata and blocks', () => {
    const info = new TurboWarp3DSceneRuntimeExtension().getInfo() as {
      id: string;
      blocks: Array<{opcode: string; isEdgeActivated?: boolean; blockType: string}>;
    };

    expect(info.id).toBe('kubohiroya3dsceneruntime');
    expect(info.blocks.map((block) => block.opcode)).toEqual([
      'applyScene',
      'sceneStatus',
      'sceneError',
      'isSceneReady',
      'whenSceneApplied'
    ]);
    expect(info.blocks.find((block) => block.blockType === 'hat')?.isEdgeActivated).toBe(false);
  });

  it('builds a bare scene document through the A-Frame capability', async () => {
    const aframe = aframePort();
    stubScratch({turbowarpAFrameCapability: aframe});
    const extension = new TurboWarp3DSceneRuntimeExtension();

    await extension.applyScene({SOURCE: SCENE});

    expect(extension.sceneStatus()).toBe('ready');
    expect(extension.isSceneReady()).toBe(true);
    expect(aframe.createScene).toHaveBeenCalledWith('above-stage', '3d');
    expect(aframe.createNode).toHaveBeenCalledWith('box', 'card', '#scene');
    expect(aframe.addClass).toHaveBeenCalledWith('monster', '#card');
    expect(aframe.setData).toHaveBeenCalledWith('#card', 'zone', 'field');
    expect(aframe.setAttribute).toHaveBeenCalledWith('#card', 'position', '0 1 -3');
  });

  it('builds a scene3d/ar fragment through both capabilities, 3D first', async () => {
    const aframe = aframePort();
    const ar = arPort();
    const order: string[] = [];
    aframe.createNode.mockImplementation(() => void order.push('createNode'));
    ar.createARScene.mockImplementation(async () => void order.push('createARScene'));
    ar.attachSelectorToARTarget.mockImplementation(() => void order.push('attach'));
    stubScratch({turbowarpAFrameCapability: aframe, turbowarpARCapability: ar});
    const extension = new TurboWarp3DSceneRuntimeExtension();

    await extension.applyScene({
      SOURCE: [
        'scene3d:',
        '  formatVersion: 1',
        '  root:',
        '    children:',
        '      - type: box',
        '        id: card',
        'ar:',
        '  cameraId: front',
        '  targets:',
        '    - targetId: marker-1',
        '      selector: "#card"'
      ].join('\n')
    });

    expect(extension.sceneStatus()).toBe('ready');
    expect(order).toEqual(['createNode', 'createARScene', 'attach']);
    expect(ar.stopARScene).toHaveBeenCalledBefore(ar.createARScene);
    expect(ar.createARScene).toHaveBeenCalledWith('front', 'above-stage');
    expect(ar.defineARTarget).toHaveBeenCalledWith('marker-1');
    expect(ar.attachSelectorToARTarget).toHaveBeenCalledWith('#card', 'marker-1');
  });

  it('fires the applied hat once per apply', async () => {
    stubScratch({turbowarpAFrameCapability: aframePort()});
    const extension = new TurboWarp3DSceneRuntimeExtension();

    expect(extension.whenSceneApplied()).toBe(false);
    await extension.applyScene({SOURCE: SCENE});
    expect(extension.whenSceneApplied()).toBe(true);
    expect(extension.whenSceneApplied()).toBe(false);
  });

  it('reports a missing companion extension instead of throwing', async () => {
    const extension = new TurboWarp3DSceneRuntimeExtension();

    await extension.applyScene({SOURCE: SCENE});

    expect(extension.sceneStatus()).toBe('error');
    expect(extension.isSceneReady()).toBe(false);
    expect(extension.sceneError()).toContain('turbowarp-aframe 0.7.0 or newer');
  });

  it('reports a capability that is too old, by the methods it is missing', async () => {
    const withoutAddClass: Record<string, unknown> = {...aframePort()};
    delete withoutAddClass['addClass'];
    stubScratch({turbowarpAFrameCapability: withoutAddClass});
    const extension = new TurboWarp3DSceneRuntimeExtension();

    await extension.applyScene({SOURCE: SCENE});

    expect(extension.sceneError()).toContain('turbowarp-aframe 0.7.0 or newer');
  });

  it('reports a missing AR extension only when the scene asks for AR', async () => {
    stubScratch({turbowarpAFrameCapability: aframePort()});
    const extension = new TurboWarp3DSceneRuntimeExtension();

    await extension.applyScene({SOURCE: 'ar:\n  cameraId: front\n'});

    expect(extension.sceneError()).toContain('turbowarp-ar 0.4.0 or newer');
  });

  it('reports a malformed description as an error, not a crash', async () => {
    stubScratch({turbowarpAFrameCapability: aframePort()});
    const extension = new TurboWarp3DSceneRuntimeExtension();

    await extension.applyScene({SOURCE: '- not\n- an object\n'});
    expect(extension.sceneError()).toBe('3D scene description must be a YAML or JSON object.');

    await extension.applyScene({SOURCE: 'formatVersion: 2\nroot: {}\n'});
    expect(extension.sceneError()).toBe('Scene graph document formatVersion must be 1.');
  });

  it('treats an empty description as nothing to do', async () => {
    const aframe = aframePort();
    stubScratch({turbowarpAFrameCapability: aframe});
    const extension = new TurboWarp3DSceneRuntimeExtension();

    await extension.applyScene({SOURCE: '   '});

    expect(extension.sceneStatus()).toBe('ready');
    expect(aframe.createScene).not.toHaveBeenCalled();
  });
});
