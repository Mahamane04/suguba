// Charge le VRAI code TypeScript dans node:test, sans compilation de copie.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
    });
    module._compile(outputText.replace(/require\("@\/(.*?)"\)/g,
      (_, relative) => `require(${JSON.stringify(path.join(root, 'src', relative))})`), filename);
  };
}
