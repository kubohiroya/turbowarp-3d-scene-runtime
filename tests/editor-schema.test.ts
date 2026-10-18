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
