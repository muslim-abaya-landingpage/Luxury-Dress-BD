const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const imageRoot = path.resolve(__dirname, '../../images');
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const expectedExtensions = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif']);

function imageFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return imageFiles(fullPath);
    return entry.isFile() && expectedExtensions.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
  });
}

function formatMatches(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const bytes = fs.readFileSync(filePath);
  if (ext === '.webp') {
    return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (ext === '.png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(pngSignature);
  if (ext === '.avif') {
    return bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp' && bytes.toString('ascii', 8, 12) === 'avif';
  }
  return false;
}

test('static image bytes match their filename extensions', () => {
  const mismatches = imageFiles(imageRoot).filter((filePath) => !formatMatches(filePath)).map((filePath) => path.relative(path.resolve(__dirname, '../..'), filePath));
  assert.deepEqual(mismatches, [], `Image extension/content mismatch or corrupt image:\n${mismatches.join('\n')}`);
});
