#!/usr/bin/env node
/**
 * Patch @roundtreasury/prisma-extension-nested-operations for Prisma 7 compatibility
 *
 * Prisma 7 changes:
 * 1. Runtime path: @prisma/client/runtime/library -> @prisma/client/runtime/client
 * 2. objectEnumValues.classes removed, use isDbNull/isJsonNull/isAnyNull instead
 */
const fs = require('fs');
const path = require('path');

const nestedOpsPath = path.join(__dirname, '..', 'node_modules', '@roundtreasury', 'prisma-extension-nested-operations', 'dist');

// Replacement for cloneArgs.js that uses Prisma 7 compatible null checks
const CLONE_ARGS_CJS = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneArgs = void 0;
const client_1 = require("@prisma/client/runtime/client");
const lodash_1 = require("lodash");
// Prisma 7: Use isDbNull/isJsonNull/isAnyNull instead of objectEnumValues.classes
function passThroughNullTypes(value) {
    if ((0, client_1.isDbNull)(value) ||
        (0, client_1.isJsonNull)(value) ||
        (0, client_1.isAnyNull)(value)) {
        return value;
    }
}
function cloneArgs(args) {
    return (0, lodash_1.cloneDeepWith)(args, passThroughNullTypes);
}
exports.cloneArgs = cloneArgs;
`;

const CLONE_ARGS_ESM = `import { isDbNull, isJsonNull, isAnyNull } from "@prisma/client/runtime/client";
import { cloneDeepWith } from "lodash";
// Prisma 7: Use isDbNull/isJsonNull/isAnyNull instead of objectEnumValues.classes
function passThroughNullTypes(value) {
    if (isDbNull(value) || isJsonNull(value) || isAnyNull(value)) {
        return value;
    }
}
export function cloneArgs(args) {
    return cloneDeepWith(args, passThroughNullTypes);
}
`;

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace runtime/library with runtime/client
  content = content.replace(/@prisma\/client\/runtime\/library/g, '@prisma/client/runtime/client');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

function patchCloneArgs(basePath) {
  const cjsPath = path.join(basePath, 'lib', 'utils', 'cloneArgs.js');
  const esmPath = path.join(basePath, 'esm', 'lib', 'utils', 'cloneArgs.js');

  let patched = 0;

  if (fs.existsSync(cjsPath)) {
    fs.writeFileSync(cjsPath, CLONE_ARGS_CJS);
    console.log('Patched: lib/utils/cloneArgs.js (Prisma 7 null type checks)');
    patched++;
  }

  if (fs.existsSync(esmPath)) {
    fs.writeFileSync(esmPath, CLONE_ARGS_ESM);
    console.log('Patched: esm/lib/utils/cloneArgs.js (Prisma 7 null type checks)');
    patched++;
  }

  return patched;
}

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;

  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (file.endsWith('.js') || file.endsWith('.d.ts')) {
      callback(filePath);
    }
  });
}

if (!fs.existsSync(nestedOpsPath)) {
  console.log('No @roundtreasury/prisma-extension-nested-operations found, skipping patch.');
  process.exit(0);
}

let patched = 0;

// First, patch cloneArgs.js with new implementation
patched += patchCloneArgs(nestedOpsPath);

// Then patch remaining files for runtime path
walkDir(nestedOpsPath, (filePath) => {
  // Skip cloneArgs.js as we already replaced it
  if (filePath.includes('cloneArgs.js')) return;

  if (patchFile(filePath)) {
    patched++;
    console.log(`Patched: ${path.relative(nestedOpsPath, filePath)}`);
  }
});

console.log(`\nPrisma 7 compatibility patch complete. ${patched} files patched.`);
