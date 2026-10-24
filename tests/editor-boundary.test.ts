import {execFileSync} from 'node:child_process';
import {cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {expect, it} from 'vitest';
import packageMetadata from '../package.json';

it('loads standalone playback without a GUI or editor engine', () => {
  const source = readFileSync(new URL('../dist/3d-scene-runtime.js', import.meta.url), 'utf8');
  expect(source).not.toMatch(/compileSchemaBundle|require_ajv|Ajv2020|ajv implementation error/u);
  let registrations = 0;
  const Scratch = {
    extensions: {unsandboxed: true, register() {registrations++;}},
    vm: {runtime: {on() {}, off() {}}}
  };
  vm.runInNewContext(source, {Scratch, TextEncoder}, {timeout: 5000});
  expect(registrations).toBe(1);
});

it('imports the legacy and metadata entries without an installed editor package or GUI', () => {
  const isolated = mkdtempSync(join(tmpdir(), 'scene-metadata-'));
  try {
    const installed = join(isolated, 'node_modules', packageMetadata.name);
    mkdirSync(installed, {recursive: true});
    cpSync(new URL('../package.json', import.meta.url), join(installed, 'package.json'));
    cpSync(new URL('../lib-editor', import.meta.url), join(installed, 'lib-editor'), {recursive: true});
    const sceneRoot = realpathSync(new URL('../node_modules/@kubohiroya/turbowarp-scene-graph', import.meta.url));
    for (const name of ['yaml', '@kubohiroya/turbowarp-scene-graph', '@kubohiroya/turbowarp-ar']) {
      const destination = join(isolated, 'node_modules', name);
      mkdirSync(destination, {recursive: true});
      const source = name === '@kubohiroya/turbowarp-ar'
        ? realpathSync(join(sceneRoot, '..', 'turbowarp-ar'))
        : realpathSync(new URL('../node_modules/' + name, import.meta.url));
      cpSync(source, destination, {recursive: true});
    }
    const script = `
      for (const name of ['window', 'document', 'Scratch']) Object.defineProperty(globalThis, name, {
        get() { throw Error('Unexpected GUI access: ' + name); }
      });
      const metadata = await import('${packageMetadata.name}/editor-metadata');
      const legacy = await import('${packageMetadata.name}/editor-schema');
      if (metadata.sceneSchemaBundles !== legacy.sceneSchemaBundles) throw Error('Duplicate Schema owner');
      if (metadata.createSourceEditorOptions().length !== 1) throw Error('Missing metadata');
      if (legacy.validateSceneSource('formatVersion: 1\\nroot: {}', {consumerId: 'isolated', nowMs: 0, settings: null}).result.kind !== 'valid') throw Error('Owner validation failed');
      metadata.registerSourceEditors({})();
      console.log('isolated metadata passed');
    `;
    expect(execFileSync(process.execPath, ['--input-type=module', '--eval', script], {cwd: isolated, encoding: 'utf8'})).toContain('isolated metadata passed');
  } finally {
    rmSync(isolated, {recursive: true, force: true});
  }
});

it('keeps its direct editor dependency in development only', () => {
  expect(packageMetadata.dependencies).not.toHaveProperty('@kubohiroya/turbowarp-extension-data-editor');
  expect(packageMetadata.devDependencies).toHaveProperty('@kubohiroya/turbowarp-extension-data-editor');
});
