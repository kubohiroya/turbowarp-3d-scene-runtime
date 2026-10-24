import {afterEach, expect, it, vi} from 'vitest';

function makeHost(label = '') {
  const listeners = new Map<string, Set<() => void>>();
  const sourceCleanups: (() => void)[] = [], fixedCleanups: (() => void)[] = [];
  const source = vi.fn(() => {const remove = vi.fn(); sourceCleanups.push(remove); return remove;});
  const fixed = vi.fn(() => {const remove = vi.fn(); fixedCleanups.push(remove); return remove;});
  const port = {createScene: vi.fn(async () => {}), createNode: vi.fn(), addClass: vi.fn(), setData: vi.fn(), setAttribute: vi.fn()};
  const runtime = {
    turbowarpAFrameCapability: port,
    on: vi.fn((event: string, listener: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    }),
    off: vi.fn((event: string, listener: () => void) => {listeners.get(event)?.delete(listener);})
  };
  const scratch = {
    extensions: {unsandboxed: true, register: vi.fn((extension: unknown) => {void extension;})},
    BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'boolean', HAT: 'hat', LOOP: 'loop'},
    ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean'},
    Cast: {toString: vi.fn(String), toNumber: Number, toBoolean: Boolean},
    translate: (message: string | {default: string}) => label + (typeof message === 'string' ? message : message.default),
    gui: {blockEditors: {apiVersion: 1, registerSourceEditor: source, registerFixedInputEditor: fixed}},
    vm: {runtime}
  };
  return {scratch, port, source, fixed, sourceCleanups, fixedCleanups, listeners,
    emit(event: string) {for (const listener of [...listeners.get(event) ?? []]) listener();}};
}

function forbidHostGlobals() {
  for (const name of ['Scratch', 'window', 'document']) {
    vi.stubGlobal(name, undefined);
    Object.defineProperty(globalThis, name, {configurable: true, get() {throw new Error('Unexpected global: ' + name);}});
  }
}

afterEach(() => vi.unstubAllGlobals());

it('imports without host access, instance creation or registration', async () => {
  vi.resetModules(); forbidHostGlobals();
  const h = makeHost();
  const module = await import('../src/bundle-module.js');
  expect(module.bundleModuleMetadata).toEqual({formatVersion: 1, id: 'kubohiroya3dsceneruntime', unsandboxed: 'required'});
  expect(Object.isFrozen(module.bundleModuleMetadata)).toBe(true);
  expect(h.source).not.toHaveBeenCalled(); expect(h.fixed).not.toHaveBeenCalled();
  expect(h.scratch.vm.runtime.on).not.toHaveBeenCalled(); expect(h.scratch.extensions.register).not.toHaveBeenCalled();
});

it('registers the standalone entry exactly once', async () => {
  vi.resetModules(); const h = makeHost(); vi.stubGlobal('Scratch', h.scratch);
  await import('../src/index.js');
  expect(h.scratch.extensions.register).toHaveBeenCalledOnce();
  const extension = h.scratch.extensions.register.mock.calls[0]?.[0] as {getInfo(): {id?: unknown}; dispose(): void | Promise<void>};
  expect(extension.getInfo().id).toBe('kubohiroya3dsceneruntime');
  await extension.dispose();
});

it('dispatches through the injected runtime and releases only its own editors and listeners', async () => {
  forbidHostGlobals();
  const {createExtension} = await import('../src/bundle-module.js');
  const a = makeHost('a:'), b = makeHost('b:');
  const first = createExtension(a.scratch), second = createExtension(b.scratch);
  await Promise.all([first.applyScene({SOURCE: 'formatVersion: 1\nroot:\n  children:\n    - type: box\n      id: first'}), second.applyScene({SOURCE: 'formatVersion: 1\nroot:\n  children:\n    - type: sphere\n      id: second'})]);
  expect(a.port.createNode).toHaveBeenCalledWith('box', 'first', '#scene');
  expect(b.port.createNode).toHaveBeenCalledWith('sphere', 'second', '#scene');
  expect(a.port.createNode).toHaveBeenCalledOnce(); expect(b.port.createNode).toHaveBeenCalledOnce();
  expect(first.sceneStatus()).toBe('ready'); expect(second.sceneStatus()).toBe('ready');
  expect(first.getInfo().name).toBe('a:TurboWarp-3D-Scene-Runtime');
  expect(second.getInfo().name).toBe('b:TurboWarp-3D-Scene-Runtime');
  for (const h of [a, b]) {expect(h.source).toHaveBeenCalledOnce(); expect(h.scratch.extensions.register).not.toHaveBeenCalled();}
  first.dispose(); first.dispose();
  for (const remove of a.sourceCleanups) expect(remove).toHaveBeenCalledOnce();
  for (const remove of b.sourceCleanups) expect(remove).not.toHaveBeenCalled();
  expect([...a.listeners.values()].every(set => set.size === 0)).toBe(true);
  b.emit('RUNTIME_DISPOSED'); second.dispose();
  for (const remove of b.sourceCleanups) expect(remove).toHaveBeenCalledOnce();
  expect([...b.listeners.values()].every(set => set.size === 0)).toBe(true);
});
