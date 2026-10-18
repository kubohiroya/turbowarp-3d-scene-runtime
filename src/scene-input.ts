import {parse as parseYaml} from 'yaml';
/** Same branch selection as runtime planFor, with raw source/data retained. */
export function decodeSceneSource(source: string) {
  const trimmed = source.trim();
  if (trimmed.length === 0) return {kind: 'empty' as const, source, variantId: 'empty' as const};
  const data: unknown = parseYaml(trimmed);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new TypeError('3D scene description must be a YAML or JSON object.');
  const keys = Object.keys(data);
  const variantId = keys.includes('scene3d') || keys.includes('ar') ? 'wrapper' as const : 'bare' as const;
  let format: 'json' | 'yaml' = 'yaml';try {JSON.parse(trimmed);format = 'json';} catch {}
  return {kind: 'decoded' as const, source, data, format, variantId};
}
