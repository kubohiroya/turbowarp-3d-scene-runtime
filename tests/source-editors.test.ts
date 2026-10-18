import {createBlockEditorService} from '@kubohiroya/turbowarp-extension-data-editor/rjsf';
import {extensionConfig} from '../src/config.js';
import {expect, it} from 'vitest';
import {createSourceEditorOptions, registerSourceEditors} from '../src/source-editors.js';
import definitions from '../src/block-definitions.json';
const targets: Record<string, readonly string[]> = {"applyScene": ["SOURCE"]};
it('covers every planned opcode and input against the actual block definitions', () => {
  const options = createSourceEditorOptions();
  const actual = options.flatMap(option => option.opcodes.flatMap(opcode => option.bindings.map(binding => `${opcode.slice(option.extensionId.length + 1)}.${binding.argument}`))).sort();
  expect(actual).toEqual(Object.entries(targets).flatMap(([opcode, arguments_]) => arguments_.map(argument => `${opcode}.${argument}`)).sort());
  for (const [opcode, arguments_] of Object.entries(targets)) {
    const block = definitions.blocks.find(block => block.opcode === opcode);
    expect(block).toBeDefined();
    for (const argument of arguments_) expect(block!.arguments).toHaveProperty(argument);
  }
});
it('skips old hosts, registers only through the optional source API, and removes once', () => {
  expect(() => registerSourceEditors({} )()).not.toThrow();
  expect(() => registerSourceEditors({gui: {blockEditors: {apiVersion: 1}}})()).not.toThrow();
  const seen: unknown[] = [];
  let removals = 0;
  const remove = registerSourceEditors({gui: {blockEditors: {apiVersion: 1, registerSourceEditor: (options: unknown) => {seen.push(options); return () => {removals++;};}}}});
  expect(seen.length).toBe(createSourceEditorOptions().length);
  remove(); remove(); expect(removals).toBe(seen.length);
});
it('keeps decode failures safe and preserves the exact source at owner validation', () => {
  const source = '{private-input broken';
  for (const definition of createSourceEditorOptions()) for (const binding of definition.bindings) {
    expect(() => binding.decode(source)).toThrow();
    const result = binding.validateSource(source, definition.validationContext());
    expect(result.source).toBe(source); expect(result.result.kind).toBe('invalid');
    expect(JSON.stringify(result.result)).not.toContain('private-input');
    expect(binding.variants.length).toBeGreaterThan(0);
  }
});

it('keeps the empty no-op in Source mode and distinguishes JSON/YAML wrappers', () => {
 const option = createSourceEditorOptions()[0]!; const binding = option.bindings[0]!;
 expect(binding.validateSource(' \n', option.validationContext()).result.kind).toBe('valid');
 expect(binding.decode(' \n')).toMatchObject({source: ' \n', variantId: 'empty', data: null});
 const bare = 'formatVersion: 1\n'; expect(binding.decode(bare)).toMatchObject({source: bare, variantId: 'bare', format: 'yaml'});
 const wrapper = '{"scene3d":{"formatVersion":1}}'; expect(binding.decode(wrapper)).toMatchObject({source: wrapper, variantId: 'wrapper', format: 'json'});
 expect(binding.variants.map(variant => `${variant.variantId}.${variant.format}`).sort()).toEqual(['bare.json','bare.yaml','wrapper.json','wrapper.yaml']);
});

it('registers and resolves every fully qualified opcode through the actual common service', () => {
  const service = createBlockEditorService();
  const remove = registerSourceEditors({gui: {blockEditors: service.api}});
  const options = createSourceEditorOptions();
  for (const option of options) for (const opcode of option.opcodes) {
    expect(opcode.startsWith(`${option.extensionId}_`)).toBe(true);
    expect(service.registry.resolve(opcode)).toMatchObject({extensionId: option.extensionId, editorId: option.editorId,
      editableArguments: option.bindings.map(binding => binding.argument)});
  }
  remove(); remove();
  for (const option of options) for (const opcode of option.opcodes) expect(service.registry.resolve(opcode)).toBeUndefined();
});

it('keeps accepted empty scene sources unchanged with zero undo transactions through the real service', async () => {
 for (const source of ['', ' \n\t']) {
  const service = createBlockEditorService(); const remove = registerSourceEditors({gui: {blockEditors: service.api}});
  const live = {targetId: 'sprite', blockId: 'root', opcode: `${extensionConfig.id}_applyScene`, revision: '1', arguments: {SOURCE: {kind: 'literal' as const, value: source}}};
  let commits = 0; const session = service.registry.open(live, {readBlock: () => live, commit: () => {commits++;}})!;
  expect(session.getDraft()).toMatchObject({sources: {SOURCE: {mode: 'source', source}}});
  expect(await session.save()).toEqual({status: 'saved', changed: false}); expect(commits).toBe(0); expect(live.arguments.SOURCE.value).toBe(source);
  remove(); session.dispose();
 }
});

it('allows explicit Source repair to the declared empty variant without selecting a form variant', async () => {
 const service = createBlockEditorService(); const remove = registerSourceEditors({gui: {blockEditors: service.api}});
 const live = {targetId: 'sprite', blockId: 'root', opcode: `${extensionConfig.id}_applyScene`, revision: '1', arguments: {SOURCE: {kind: 'literal' as const, value: 'formatVersion: 1\n'}}};
 const candidates: string[] = [];
 const session = service.registry.open(live, {readBlock: () => live, commit: request => {candidates.push(request.changes[0]!.value as string);}})!;
 session.setDraft({sources: {SOURCE: {mode: 'source', source: ' \n', sourceEdited: true}}});
 expect(await session.save()).toEqual({status: 'saved', changed: true});expect(candidates).toEqual([' \n']);remove();
});
