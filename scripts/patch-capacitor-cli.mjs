import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.resolve(__dirname, 'node_modules/@capacitor/cli/dist/util/node.js');

if (fs.existsSync(targetFile)) {
  const content = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveNode = exports.requireTS = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
let tsx;
try {
  tsx = require("tsx/cjs/api");
} catch {}

const requireTS = (_ts, p) => {
  if (tsx && typeof tsx.require === 'function') {
    return tsx.require(p, __filename);
  }
  return require(p);
};
exports.requireTS = requireTS;

function resolveNode(root, ...pathSegments) {
  try {
    return require.resolve(pathSegments.join('/'), { paths: [root] });
  }
  catch (e) {
    const path = [root, 'node_modules', ...pathSegments].join('/');
    if ((0, fs_1.existsSync)(path)) {
      return path;
    }
    return null;
  }
}
exports.resolveNode = resolveNode;
`;
  fs.writeFileSync(targetFile, content, 'utf8');
}
