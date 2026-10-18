import {expect, it} from 'vitest';
import {decodeSceneSource, validateSceneSource} from '../src/editor-schema.js';
const context={consumerId:'applyScene',nowMs:0,settings:null};
it('preserves empty/bare/wrapper branch selection and raw JSON/YAML',()=>{
  for(const source of ['', '  \n'])expect(validateSceneSource(source,context)).toMatchObject({kind:'empty',source,result:{kind:'valid'}});
  for(const source of ['{"formatVersion":1,"root":{}}','formatVersion: 1\nroot: {}\n', '{"scene3d":{"formatVersion":1,"root":{}}}', 'ar: {}\n']){
    const decoded=decodeSceneSource(source);expect(decoded.kind).toBe('decoded');expect(validateSceneSource(source,context).result.kind).toBe('valid');expect(decoded.source).toBe(source);
  }
  expect(decodeSceneSource('{}')).toMatchObject({variantId:'bare',data:{}});expect(validateSceneSource('{}',context).result.kind).toBe('invalid');
});
it('rejects bad nodes/wrappers/duplicate normalized IDs without modifying source',()=>{
  for(const source of ['null','[]','formatVersion: 2\nroot: {}','scene3d: {}','ar:\n  layer: unsupported','{broken',JSON.stringify({formatVersion:1,root:{children:[{id:'x'},{id:'x'}]}})]){
    const result=validateSceneSource(source,context);expect(result.result.kind).not.toBe('valid');expect(result.source).toBe(source);
  }
  const source='formatVersion: 1\nroot:\n  type: ""\n  classes: [a, a]\n';const result=validateSceneSource(source,context);expect(result.result.kind).toBe('valid');
  expect(result).toHaveProperty('data.root.classes',['a','a']);expect(result.source).toBe(source);
});

it('malformed source reports safe diagnostics without reading context accessors',()=>{
 let reads=0;const accessor=Object.defineProperty({...context},'consumerId',{enumerable:true,get(){reads++;throw Error('private-context');}});
 for(const invalidContext of [accessor,null,undefined]){
  const source='{private malformed',result=validateSceneSource(source,invalidContext as never);
  expect(result.source).toBe(source);expect(result.result.kind).toBe('invalid');
  expect(result.result.diagnostics[0]?.code).toBe('input-format-invalid');
  expect(result.result.diagnostics[0]?.scope).not.toHaveProperty('consumerId');
  expect(JSON.stringify(result.result)).not.toContain('private');
 }
 expect(reads).toBe(0);
 expect(validateSceneSource('{broken',context).result.diagnostics[0]?.scope.consumerId).toBe(context.consumerId);
 expect(validateSceneSource('{"formatVersion":1,"root":{}}',accessor).result.kind).toBe('execution-error');
 expect(reads).toBe(0);
});

it('empty source remains a context-free no-op',()=>{
 const accessor=Object.defineProperty({},'consumerId',{get(){throw Error('context must not be read for a no-op');}});
 for(const invalidContext of [accessor,null,{...context,nowMs:NaN}]){
  expect(validateSceneSource(' \n',invalidContext as never)).toMatchObject({kind:'empty',source:' \n',result:{kind:'valid',diagnostics:[]}});
 }
});
