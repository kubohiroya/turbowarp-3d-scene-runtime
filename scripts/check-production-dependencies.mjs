/* global process, console */
import {existsSync, readFileSync, realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join, resolve} from 'node:path';

// Follow installed production edges, even when development packages are also installed.
const root = resolve(process.argv[2] ?? '.');
const visited = new Set();
const packages = [];
const forbidden = /^(?:@kubohiroya\/turbowarp-extension-data-editor|ajv(?:-.*)?|@rjsf\/.*|react|react-dom)$/u;

function visit(manifestPath, chain) {
  const file = realpathSync(manifestPath);
  if (visited.has(file)) return;
  visited.add(file);
  const metadata = JSON.parse(readFileSync(file, 'utf8'));
  const label = `${metadata.name ?? '(consumer)'}@${metadata.version ?? '(local)'}`;
  const path = [...chain, label];
  if (forbidden.test(metadata.name ?? '')) {
    throw new Error(`Editor dependency in production: ${path.join(' -> ')}`);
  }
  packages.push(label);
  const require = createRequire(file);
  const dependencies = {
    ...metadata.peerDependencies,
    ...metadata.dependencies,
    ...metadata.optionalDependencies
  };
  for (const name of Object.keys(dependencies).sort()) {
    const optional = Object.hasOwn(metadata.optionalDependencies ?? {}, name) ||
      (!Object.hasOwn(metadata.dependencies ?? {}, name) && metadata.peerDependenciesMeta?.[name]?.optional);
    // Locate package.json without depending on each package's exports map.
    const dependency = require.resolve.paths(name)?.map(base => join(base, name, 'package.json')).find(existsSync);
    if (!dependency) {
      if (optional) continue;
      throw new Error(`Missing production dependency ${name}: ${path.join(' -> ')}`);
    }
    visit(dependency, path);
  }
}

visit(join(root, 'package.json'), []);
console.log(JSON.stringify({root, packages: packages.sort(), editorDependencies: 0}, null, 2));
