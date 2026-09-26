import { createRequire, stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
const require = createRequire(new URL('../userscript/package.json', import.meta.url));
const literal = n => n?.type === 'Literal' ? n.value : n?.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : undefined;
function parse(code) { return require('acorn').parse(code, { ecmaVersion: 'latest', sourceType: 'module' }); }
function bindings(ast) {
    const result = new Map();
    for (let node of ast.body) {
        if (node.type === 'ExportNamedDeclaration') node = node.declaration;
        if (node?.type === 'VariableDeclaration') for (const d of node.declarations) result.set(d.id.name, d.init);
    }
    return result;
}
function keyOf(p) {
    const key = p.computed ? literal(p.key) : p.key.name ?? literal(p.key);
    if (typeof key !== 'string' && typeof key !== 'number') throw new Error('Unsupported definition key');
    return String(key);
}
const ordered = keys => ['', ...Object.keys(Object.fromEntries(keys.map(key => [key, true])))];
export function bundledDefinitionIds(code) {
    const ast = parse(code), vars = bindings(ast);
    const resolve = (node, seen = new Set()) => {
        if (!node) throw new Error('Missing definition initializer');
        if (seen.has(node)) throw new Error('Cyclic definition initializer');
        seen = new Set(seen).add(node);
        if (node.type === 'Identifier') return resolve(vars.get(node.name), seen);
        if (node.type === 'AssignmentExpression') return resolve(node.right, seen);
        if (node.type !== 'ObjectExpression') throw new Error(`Unsupported definition initializer ${node.type}`);
        return node.properties.flatMap(p => p.type === 'SpreadElement' ? resolve(p.argument, seen) : [keyOf(p)]);
    };
    const result = {};
    for (const kind of ['Map', 'Game']) {
        const registers = [...vars.values()].filter(n => n?.type === 'NewExpression' && literal(n.arguments[0]) === kind);
        if (registers.length !== 1) throw new Error(`Expected one ${kind} definition register`);
        const raw = registers[0].arguments[1];
        let keys = resolve(raw);
        if (kind === 'Game' && keys.length === 0 && raw.type === 'Identifier') {
            // The generated registry merges a static array of definition objects.
            const arrays = new Set();
            for (const loop of ast.body.filter(n => n.type === 'ForStatement')) {
                const identifiers = new Set(); let writesRaw = false;
                const walk = n => {
                    if (!n?.type) return;
                    if (n.type === 'Identifier') identifiers.add(n.name);
                    if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.object.name === raw.name) writesRaw = true;
                    for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v?.type) walk(v);
                };
                walk(loop);
                if (writesRaw) for (const name of identifiers) if (vars.get(name)?.type === 'ArrayExpression') arrays.add(vars.get(name));
            }
            if (arrays.size !== 1) throw new Error('Ambiguous Game definition merge');
            keys = [...arrays][0].elements.flatMap(n => resolve(n));
        }
        if (!keys.length) throw new Error(`Empty ${kind} definition registry`);
        result[kind] = ordered(keys);
    }
    return result;
}
export async function sourceDefinitionIds(readSource) {
    const modules = new Map();
    async function load(file) {
        if (!modules.has(file)) {
            const ast = parse(stripTypeScriptTypes(await readSource(file), { mode: 'transform' }));
            const imports = new Map();
            for (const n of ast.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) {
                if (s.type === 'ImportSpecifier') imports.set(s.local.name, { file: posix.normalize(posix.join(posix.dirname(file), n.source.value)), name: s.imported.name });
            }
            modules.set(file, { vars: bindings(ast), imports });
        }
        return modules.get(file);
    }
    async function resolve(file, node, seen = new Set()) {
        const mod = await load(file);
        if (!node) throw new Error(`Missing definition in ${file}`);
        if (node.type === 'Identifier') {
            const key = `${file}:${node.name}`;
            if (seen.has(key)) throw new Error('Cyclic definition source');
            seen = new Set(seen).add(key);
            const imported = mod.imports.get(node.name);
            if (imported) return resolve(imported.file, { type: 'Identifier', name: imported.name }, seen);
            return resolve(file, mod.vars.get(node.name), seen);
        }
        if (node.type !== 'ObjectExpression') throw new Error(`Unsupported definition source: ${file} ${node.type}`);
        const keys = [];
        for (const p of node.properties) keys.push(...(p.type === 'SpreadElement' ? await resolve(file, p.argument, seen) : [keyOf(p)]));
        return keys;
    }
    const mapFile = 'shared/defs/mapObjectDefs.ts';
    const mapIds = ordered(await resolve(mapFile, { type: 'Identifier', name: 'RawMapObjectDefs' }));
    const gameFile = 'shared/defs/gameObjectDefs.ts';
    const list = (await load(gameFile)).vars.get('ObjectDefsList');
    if (list?.type !== 'ArrayExpression') throw new Error('Unsupported source Game definition list');
    const keys = [];
    for (const item of list.elements) keys.push(...await resolve(gameFile, item));
    return { Map: mapIds, Game: ordered(keys) };
}
export function sameDefinitionIds(a, b) {
    return ['Map', 'Game'].every(kind => JSON.stringify(a[kind]) === JSON.stringify(b[kind]));
}


