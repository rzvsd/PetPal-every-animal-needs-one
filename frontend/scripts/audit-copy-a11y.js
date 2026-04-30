const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const translationsPath = path.join(root, 'src', 'i18n', 'translations.js');
const sourceDirs = [path.join(root, 'src')];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (/\.(js|jsx|ts|tsx|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function flattenKeys(value, prefix = '', out = []) {
  for (const [key, nested] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      flattenKeys(nested, next, out);
    } else {
      out.push(next);
    }
  }
  return out;
}

function loadTranslations() {
  const source = read(translationsPath);
  const normalized = source
    .replace('export const translations =', 'module.exports =')
    .replace(/;\s*$/, ';');
  const moduleShim = { exports: {} };
  Function('module', normalized)(moduleShim);
  return moduleShim.exports;
}

const failures = [];
const translations = loadTranslations();
const enKeys = flattenKeys(translations.en).sort();
const roKeys = flattenKeys(translations.ro).sort();
const missingRo = enKeys.filter((key) => !roKeys.includes(key));
const missingEn = roKeys.filter((key) => !enKeys.includes(key));

if (missingRo.length) failures.push(`Romanian is missing keys: ${missingRo.join(', ')}`);
if (missingEn.length) failures.push(`English is missing keys: ${missingEn.join(', ')}`);

for (const filePath of walk(sourceDirs[0])) {
  const rel = path.relative(root, filePath);
  const text = read(filePath);
  if (/[ÂÃ�]/.test(text)) failures.push(`${rel} contains mojibake characters.`);
  if (/onClick=\{\(\) => \{\}\}/.test(text)) failures.push(`${rel} contains empty click handlers.`);
  if (/<button(?![^>]*type=)/.test(text)) failures.push(`${rel} contains button elements without explicit type.`);
  if (/bg-\[#9BAE96\][^"']*text-white|text-white[^"']*bg-\[#9BAE96\]/.test(text)) {
    failures.push(`${rel} uses low-contrast white text on sage background.`);
  }
  if (/bg-\[#C07E67\][^"']*text-white|text-white[^"']*bg-\[#C07E67\]/.test(text)) {
    failures.push(`${rel} uses low-contrast white text on clay background.`);
  }
}

if (failures.length) {
  console.error('Copy/accessibility audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Copy/accessibility audit passed.');
console.log(`Translation keys checked: ${enKeys.length}`);
