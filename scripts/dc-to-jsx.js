/* dc-to-jsx — turn a Claude Design ".dc.html" template into a React view module.
 *
 * The Nurse App and Admin App were designed in Claude Design, whose documents are
 * an HTML template (with {{ path }} bindings, <sc-if>, <sc-for> and an
 * <x-import> device frame) plus a logic script that exposes a flat view-model.
 * This script converts the TEMPLATE part, mechanically and faithfully, into a JSX
 * function that renders against the same flat view-model (`v`). The logic lives
 * in a hand-written module next to the generated view (see renderer/unico/
 * nurse-app.jsx and admin-app.jsx), so the design can be re-imported and
 * re-converted without touching the app's behaviour.
 *
 * Binding semantics mirror the design runtime (support.js) exactly:
 *   - {{ expr }} is a dotted / bracketed path, an ===/!==/==/!= comparison, a
 *     "!" negation, or a literal — never arbitrary JavaScript.
 *   - <sc-if value="{{ x }}">   renders its children when x is truthy.
 *   - <sc-for list="{{ L }}" as="r"> repeats its children with `r` (and $index).
 *   - style="a:b;c:{{ x }}"   inline CSS text -> a style object (S()).
 *   - style-hover="…"         a :hover rule, compiled into a generated class.
 *   - hint-* attributes        design-canvas placeholders, dropped.
 *   - <x-import component-from-global-scope="AndroidDevice"> -> <AndroidDevice>.
 *
 * Usage:  node scripts/dc-to-jsx.js <design.dc.html> <out.jsx> <ComponentName>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const parse5 = require('parse5');

const [, , inFile, outFile, compName] = process.argv;
if (!inFile || !outFile || !compName) {
  console.error('usage: node scripts/dc-to-jsx.js <design.dc.html> <out.jsx> <ComponentName>');
  process.exit(1);
}

/* ------------------------------------------------------------------ input --- */
const src = fs.readFileSync(inFile, 'utf8');
const open = /<x-dc(?:\s[^>]*)?>/.exec(src);
const close = src.lastIndexOf('</x-dc>');
if (!open || close < 0) throw new Error('no <x-dc> template in ' + inFile);
let tpl = src.slice(open.index + open[0].length, close);

// The <helmet> carries the page-level CSS (keyframes, body font, scrollbars). Keep
// its <style> text so the view can inject it once; drop the fonts/meta (the app
// vendors its own IBM Plex).
let helmetCss = '';
tpl = tpl.replace(/<helmet[\s\S]*?<\/helmet>/i, (h) => {
  const m = /<style>([\s\S]*?)<\/style>/i.exec(h);
  if (m) helmetCss = m[1].trim();
  return '';
});

// parse5 lower-cases attribute names; the runtime protects camelCase ones (onClick,
// inputMode, readOnly, viewBox …) with a prefix before parsing. Same trick here.
const CAMEL = 'sc-camel-';
tpl = tpl.replace(/(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g, (_, sp, name, eq) => sp + CAMEL + name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()) + eq);
tpl = tpl.replace(/<(x-import|dc-import)((?:[^>"']|"[^"]*"|'[^']*')*)\/>/gi, (_, t, a) => '<' + t + a + '></' + t + '>');

const frag = parse5.parseFragment(tpl);

/* ------------------------------------------------------------ expressions --- */
// A stack of loop variables in scope, so `r.label` inside <sc-for as="r"> is the
// loop item and everything else resolves off the view-model `v`.
const scopes = [];
const inScope = (name) => name === '$index' || scopes.some((s) => s.has(name));
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const NUMBER = /^-?\d+(\.\d+)?$/;

function parensWrapWhole(e) {
  let d = 0;
  for (let i = 0; i < e.length - 1; i++) { if (e[i] === '(') d++; else if (e[i] === ')') { d--; if (d === 0) return false; } }
  return true;
}
function topEq(e) {
  let d = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (c === '[' || c === '(') d++; else if (c === ']' || c === ')') d--;
    else if (d === 0 && (c === '=' || c === '!') && e[i + 1] === '=') {
      if (i > 0 && (e[i - 1] === '=' || e[i - 1] === '!')) continue;
      if (!e.slice(0, i).trim()) continue;
      const op = e[i + 2] === '=' ? c + '==' : c + '=';
      return { index: i, op };
    }
  }
  return null;
}
// {{ expr }} -> a JavaScript expression string (with optional chaining, so a
// missing intermediate yields undefined exactly like the runtime's resolvePath).
function jsExpr(raw) {
  const e = String(raw).trim();
  if (!e) return 'undefined';
  if (e[0] === '(' && e[e.length - 1] === ')' && parensWrapWhole(e)) return jsExpr(e.slice(1, -1));
  const eq = topEq(e);
  if (eq) return '(' + jsExpr(e.slice(0, eq.index)) + ' ' + eq.op + ' ' + jsExpr(e.slice(eq.index + eq.op.length)) + ')';
  if (e[0] === '!') return '!(' + jsExpr(e.slice(1)) + ')';
  if (e === 'true' || e === 'false' || e === 'null' || e === 'undefined') return e;
  if (NUMBER.test(e)) return e;
  if (e.length >= 2 && (e[0] === '"' || e[0] === "'") && e[e.length - 1] === e[0]) return JSON.stringify(e.slice(1, -1));
  return jsPath(e);
}
function jsPath(e) {
  const head = e.match(IDENT);
  if (!head) throw new Error('bad binding: ' + e);
  const root = head[0];
  let out = inScope(root) ? root : 'v.' + root;
  let i = root.length;
  while (i < e.length) {
    if (e[i] === '.') {
      const m = e.slice(i + 1).match(IDENT) || e.slice(i + 1).match(/^\d+/);
      if (!m) throw new Error('bad binding: ' + e);
      out += /^\d/.test(m[0]) ? '?.[' + m[0] + ']' : '?.' + m[0];
      i += 1 + m[0].length;
    } else if (e[i] === '[') {
      let d = 1, j = i + 1;
      while (j < e.length && d > 0) { if (e[j] === '[') d++; else if (e[j] === ']') { d--; if (d === 0) break; } j++; }
      if (d !== 0) throw new Error('bad binding: ' + e);
      out += '?.[' + jsExpr(e.slice(i + 1, j)) + ']';
      i = j + 1;
    } else throw new Error('bad binding: ' + e);
  }
  return out;
}
// An attribute value: whole {{ }} -> expression; mixed -> template literal; literal.
const BIND = /\{\{([\s\S]+?)\}\}/g;
function attrValue(raw) {
  const whole = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
  if (whole) return { kind: 'expr', code: jsExpr(whole[1]) };
  if (raw.includes('{{')) {
    const parts = raw.split(BIND);
    const code = '`' + parts.map((p, i) => (i & 1) ? '${(' + jsExpr(p) + ') ?? ""}' : p.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')).join('') + '`';
    return { kind: 'tpl', code };
  }
  return { kind: 'lit', code: raw };
}

/* --------------------------------------------------------------- styling --- */
function kebabToCamel(s) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
function cssToObj(css) {
  const o = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    o[prop.startsWith('--') ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
  }
  return o;
}
// :hover etc. rules become generated classes, `!important` like the runtime so they
// beat the inline style they sit next to.
const pseudo = new Map();
const pseudoRules = [];
function pseudoClass(kind, css) {
  const k = kind + '|' + css;
  if (pseudo.has(k)) return pseudo.get(k);
  const cls = 'dcp' + pseudo.size.toString(36);
  const decls = css.split(';').map((d) => d.trim()).filter(Boolean).map((d) => /!\s*important$/i.test(d) ? d : d + ' !important');
  const isEl = kind === 'before' || kind === 'after';
  pseudoRules.push('.' + cls + (isEl ? '::' : ':') + kind + '{' + (isEl ? css : decls.join(';')) + '}');
  pseudo.set(k, cls);
  return cls;
}

/* ----------------------------------------------------------- attributes --- */
const SVG_NS = 'http://www.w3.org/2000/svg';
const EVENT = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onsubmit: 'onSubmit', onkeydown: 'onKeyDown', onkeyup: 'onKeyUp', onkeypress: 'onKeyPress', onmousedown: 'onMouseDown', onmouseup: 'onMouseUp', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onfocus: 'onFocus', onblur: 'onBlur', ondoubleclick: 'onDoubleClick', ontouchstart: 'onTouchStart', ontouchend: 'onTouchEnd', onscroll: 'onScroll' };
function attrName(name, isSvg) {
  let key = name;
  if (key.startsWith(CAMEL)) key = kebabToCamel(key.slice(CAMEL.length));
  if (key === 'class') return 'className';
  if (key === 'for') return 'htmlFor';
  if (key.startsWith('on')) return EVENT[key.toLowerCase()] || ('on' + key[2].toUpperCase() + key.slice(3));
  if (key.startsWith('data-') || key.startsWith('aria-')) return key;
  if (isSvg && key.includes('-') && !key.includes(':')) return kebabToCamel(key);
  if (key === 'tabindex') return 'tabIndex';
  if (key === 'readonly') return 'readOnly';
  if (key === 'maxlength') return 'maxLength';
  if (key === 'autocomplete') return 'autoComplete';
  if (key === 'inputmode') return 'inputMode';
  if (key === 'crossorigin') return 'crossOrigin';
  return key;
}
function jsObj(o) { return '{' + Object.keys(o).map((k) => JSON.stringify(k) + ':' + JSON.stringify(o[k])).join(',') + '}'; }

function emitAttrs(el) {
  const isSvg = el.namespaceURI === SVG_NS;
  const out = [];
  const classes = [];
  for (const { name, value } of el.attrs) {
    if (name.startsWith('hint-') || name === 'sc-name' || name === 'data-dc-tpl') continue;
    if (name.startsWith('style-')) { classes.push(pseudoClass(name.slice(6), value)); continue; }
    const key = attrName(name, isSvg);
    if (key === 'className') { classes.push(value); continue; }
    if (key === 'style') {
      const a = attrValue(value);
      if (a.kind === 'lit') out.push('style={' + jsObj(cssToObj(value)) + '}');
      else out.push('style={S(' + a.code + ')}');
      continue;
    }
    const a = attrValue(value);
    if (key === 'value' || key === 'checked') {
      // The runtime substitutes '' / false for an unresolved value so React inputs
      // stay controlled; vx() does the same.
      if (a.kind === 'lit') out.push(key + '=' + JSON.stringify(value));
      else out.push(key + '={vx(' + a.code + (key === 'checked' ? ', false' : '') + ')}');
      continue;
    }
    if (a.kind === 'lit') {
      if (value === '' && (key === 'readOnly' || key === 'disabled' || key === 'checked' || key === 'autoFocus' || key === 'required')) out.push(key);
      else out.push(key + '=' + JSON.stringify(value));
    } else out.push(key + '={' + a.code + '}');
  }
  if (classes.length) {
    const lit = classes.filter((c) => !c.includes('{{'));
    out.push('className=' + JSON.stringify(lit.join(' ')));
  }
  return out.length ? ' ' + out.join(' ') : '';
}

/* ----------------------------------------------------------------- walk --- */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const topScreens = []; // [{name, code}] — one function per top-level <sc-if> screen

function walkChildren(node, depth) {
  return (node.childNodes || []).map((c) => walk(c, depth)).filter((s) => s !== '').join('');
}
function walk(node, depth) {
  if (node.nodeName === '#text') return walkText(node.value);
  if (node.nodeName === '#comment') return '';
  const tag = node.tagName;
  if (!tag) return walkChildren(node, depth);
  if (tag === 'sc-for') return walkFor(node, depth);
  if (tag === 'sc-if') return walkIf(node, depth);
  if (tag === 'x-import') return walkImport(node, depth);
  return walkElement(node, depth);
}
function walkText(txt) {
  if (!txt.includes('{{')) {
    if (!txt.trim()) return txt.includes('\n') ? '' : (txt.includes(' ') ? '{" "}' : '');
    return '{' + JSON.stringify(txt) + '}';
  }
  const parts = txt.split(BIND);
  return parts.map((p, i) => (i & 1) ? '{ix(' + jsExpr(p) + ')}' : (p ? '{' + JSON.stringify(p) + '}' : '')).join('');
}
function getAttr(el, n) { const a = el.attrs.find((x) => x.name === n); return a ? a.value : null; }
function walkFor(el, depth) {
  const list = attrValue(getAttr(el, 'list') || '');
  const as = getAttr(el, 'as') || 'item';
  scopes.push(new Set([as]));
  const kids = walkChildren(el, depth + 1);
  scopes.pop();
  const L = list.kind === 'expr' ? list.code : 'undefined';
  return '{(Array.isArray(' + L + ') ? ' + L + ' : []).map((' + as + ', $index) => <React.Fragment key={$index}>' + kids + '</React.Fragment>)}';
}
function walkIf(el, depth) {
  const val = attrValue(getAttr(el, 'value') || '');
  const cond = val.kind === 'expr' ? val.code : 'false';
  const kids = walkChildren(el, depth + 1);
  return '{(' + cond + ') ? <>' + kids + '</> : null}';
}
function walkImport(el, depth) {
  const comp = getAttr(el, 'component-from-global-scope') || getAttr(el, 'component') || 'div';
  const kids = walkChildren(el, depth + 1);
  return '<' + comp + '>' + kids + '</' + comp + '>';
}
function walkElement(el, depth) {
  const tag = el.tagName;
  const attrs = emitAttrs(el);
  if (VOID.has(tag) || (el.namespaceURI === SVG_NS && !(el.childNodes || []).length)) return '<' + tag + attrs + '/>';
  // The phone-content root: hoist each top-level screen block into its own function
  // so the generated file stays navigable.
  if (depth === 1 && el.tagName === 'div') {
    const parts = [];
    for (const c of el.childNodes || []) {
      if (c.tagName === 'sc-if') {
        const val = attrValue(getAttr(c, 'value') || '');
        const name = String(getAttr(c, 'value') || '').replace(/[^A-Za-z0-9]/g, '') || ('block' + topScreens.length);
        const fn = 'Screen_' + name + (topScreens.some((t) => t.name === 'Screen_' + name) ? '_' + topScreens.length : '');
        const kids = walkChildren(c, depth + 2);
        topScreens.push({ name: fn, code: 'function ' + fn + '(v) {\n  return (' + (val.kind === 'expr' ? val.code : 'false') + ') ? <>' + kids + '</> : null;\n}' });
        parts.push('{' + fn + '(v)}');
      } else parts.push(walk(c, depth + 1));
    }
    return '<' + tag + attrs + '>' + parts.filter(Boolean).join('') + '</' + tag + '>';
  }
  return '<' + tag + attrs + '>' + walkChildren(el, depth + 1) + '</' + tag + '>';
}

/* ------------------------------------------------------------------- run --- */
// Only the device frame's content is the app; the canvas chrome around it (role
// switch, screen chips, heading) is design-tool scaffolding.
function findImport(node) {
  if (node.tagName === 'x-import') return node;
  for (const c of node.childNodes || []) { const f = findImport(c); if (f) return f; }
  return null;
}
const imp = findImport(frag);
if (!imp) throw new Error('no <x-import> device frame found');
// The device frame itself is the app's own AndroidDevice (bezel on wide screens, the
// whole viewport on a phone); its children are the screens.
const body = '<AndroidDevice>' + (imp.childNodes || []).map((c) => walk(c, 1)).filter(Boolean).join('') + '</AndroidDevice>';

const out = [
  '/* GENERATED by scripts/dc-to-jsx.js from ' + path.basename(inFile) + ' — do not edit by hand.',
  ' * Re-run:  node scripts/dc-to-jsx.js "' + path.relative(path.join(__dirname, '..'), inFile).replace(/\\/g, '/') + '" ' + path.relative(path.join(__dirname, '..'), outFile).replace(/\\/g, '/') + ' ' + compName,
  ' * Renders the design template against the flat view-model `v` produced by the',
  ' * hand-written logic module (see the file of the same name without "-view"). */',
  '(function () {',
  "  'use strict';",
  '  const React = window.React;',
  '  const { S, ix, vx, AndroidDevice } = window.DC;',
  '',
  ...topScreens.map((t) => t.code.replace(/^/gm, '  ')),
  '',
  '  function ' + compName + '({ v }) {',
  '    return (' + body + ');',
  '  }',
  '  ' + compName + '.CSS = ' + JSON.stringify(helmetCss + '\n' + pseudoRules.join('\n')) + ';',
  '  window.' + compName + ' = ' + compName + ';',
  '})();',
  '',
].join('\n');

fs.writeFileSync(outFile, out, 'utf8');
console.log('[dc-to-jsx] ' + path.basename(inFile) + ' -> ' + path.relative(process.cwd(), outFile) + '  (' + topScreens.length + ' screens, ' + pseudoRules.length + ' hover rules, ' + (out.length / 1024).toFixed(0) + ' KB)');
