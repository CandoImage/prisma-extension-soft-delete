#!/usr/bin/env node
/**
 * Patch @roundtreasury/prisma-extension-nested-operations for Prisma 7 compatibility
 *
 * Prisma 7 changes:
 * 1. Runtime path: @prisma/client/runtime/library -> @prisma/client/runtime/client
 * 2. objectEnumValues.classes removed, use isDbNull/isJsonNull/isAnyNull instead
 * 3. isList removed from DMMF field metadata, must be computed from FK field presence
 */
const fs = require('fs');
const path = require('path');

/**
 * Find @roundtreasury/prisma-extension-nested-operations in multiple locations:
 * 1. Local node_modules (when not hoisted)
 * 2. Host project's node_modules (when hoisted by npm)
 * 3. Even higher for monorepo setups
 */
function findNestedOpsPath() {
  const possiblePaths = [
    // Local (inside this package)
    path.join(__dirname, '..', 'node_modules', '@roundtreasury', 'prisma-extension-nested-operations', 'dist'),
    // Hoisted to host project (npm hoisting) - this package is at node_modules/@candoimage/prisma-extension-soft-delete
    path.join(__dirname, '..', '..', '..', '@roundtreasury', 'prisma-extension-nested-operations', 'dist'),
    // Hoisted even higher (monorepo case)
    path.join(__dirname, '..', '..', '..', '..', '..', '@roundtreasury', 'prisma-extension-nested-operations', 'dist'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Found @roundtreasury/prisma-extension-nested-operations at: ${p}`);
      return p;
    }
  }
  return null;
}

const nestedOpsPath = findNestedOpsPath();

// Replacement for cloneArgs.js that uses Prisma 7 compatible null checks
const CLONE_ARGS_CJS = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneArgs = void 0;
const client_1 = require("@prisma/client/runtime/client");
const lodash_1 = require("lodash");
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
function passThroughNullTypes(value) {
    if (isDbNull(value) || isJsonNull(value) || isAnyNull(value)) {
        return value;
    }
}
export function cloneArgs(args) {
    return cloneDeepWith(args, passThroughNullTypes);
}
`;

// Replacement for relations.js - computes isList for Prisma 7
const RELATIONS_CJS = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOppositeRelation = exports.getRelationsByModel = void 0;

function computeIsList(model, relationField) {
    const potentialFkName = relationField.name + 'Id';
    const hasFkField = model.fields.some((f) => f.name === potentialFkName && f.kind === 'scalar');
    return !hasFkField;
}

function getRelationsByModel(dmmf) {
    const relationsByModel = {};
    dmmf.datamodel.models.forEach((model) => {
        relationsByModel[model.name] = model.fields
            .filter((field) => field.kind === "object" && field.relationName)
            .map((field) => ({
                ...field,
                isList: field.isList !== undefined ? field.isList : computeIsList(model, field)
            }));
    });
    return relationsByModel;
}
exports.getRelationsByModel = getRelationsByModel;

function findOppositeRelation(relationsByModel, relation) {
    const parentRelations = relationsByModel[relation.type] || [];
    const oppositeRelation = parentRelations.find((parentRelation) => parentRelation !== relation &&
        parentRelation.relationName === relation.relationName);
    if (!oppositeRelation) {
        throw new Error(\`Unable to find opposite relation to \${relation.name}\`);
    }
    return oppositeRelation;
}
exports.findOppositeRelation = findOppositeRelation;
`;

const RELATIONS_ESM = `function computeIsList(model, relationField) {
    const potentialFkName = relationField.name + 'Id';
    const hasFkField = model.fields.some((f) => f.name === potentialFkName && f.kind === 'scalar');
    return !hasFkField;
}

export function getRelationsByModel(dmmf) {
    const relationsByModel = {};
    dmmf.datamodel.models.forEach((model) => {
        relationsByModel[model.name] = model.fields
            .filter((field) => field.kind === "object" && field.relationName)
            .map((field) => ({
                ...field,
                isList: field.isList !== undefined ? field.isList : computeIsList(model, field)
            }));
    });
    return relationsByModel;
}

export function findOppositeRelation(relationsByModel, relation) {
    const parentRelations = relationsByModel[relation.type] || [];
    const oppositeRelation = parentRelations.find((parentRelation) => parentRelation !== relation &&
        parentRelation.relationName === relation.relationName);
    if (!oppositeRelation) {
        throw new Error(\`Unable to find opposite relation to \${relation.name}\`);
    }
    return oppositeRelation;
}
`;

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
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
    console.log('Patched: lib/utils/cloneArgs.js');
    patched++;
  }
  if (fs.existsSync(esmPath)) {
    fs.writeFileSync(esmPath, CLONE_ARGS_ESM);
    console.log('Patched: esm/lib/utils/cloneArgs.js');
    patched++;
  }
  return patched;
}

function patchRelations(basePath) {
  const cjsPath = path.join(basePath, 'lib', 'utils', 'relations.js');
  const esmPath = path.join(basePath, 'esm', 'lib', 'utils', 'relations.js');
  let patched = 0;
  if (fs.existsSync(cjsPath)) {
    fs.writeFileSync(cjsPath, RELATIONS_CJS);
    console.log('Patched: lib/utils/relations.js');
    patched++;
  }
  if (fs.existsSync(esmPath)) {
    fs.writeFileSync(esmPath, RELATIONS_ESM);
    console.log('Patched: esm/lib/utils/relations.js');
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

if (!nestedOpsPath) {
  console.log('No @roundtreasury/prisma-extension-nested-operations found, skipping patch.');
  process.exit(0);
}

// Check if already patched
const cloneArgsCheck = path.join(nestedOpsPath, 'lib', 'utils', 'cloneArgs.js');
if (fs.existsSync(cloneArgsCheck)) {
  const content = fs.readFileSync(cloneArgsCheck, 'utf8');
  if (content.includes('@prisma/client/runtime/client')) {
    console.log('@roundtreasury/prisma-extension-nested-operations already patched for Prisma 7');
    process.exit(0);
  }
}

let patched = 0;
patched += patchCloneArgs(nestedOpsPath);
patched += patchRelations(nestedOpsPath);

walkDir(nestedOpsPath, (filePath) => {
  if (filePath.includes('cloneArgs.js') || filePath.includes('relations.js')) return;
  if (patchFile(filePath)) {
    patched++;
    console.log(`Patched: ${path.relative(nestedOpsPath, filePath)}`);
  }
});

console.log(`\nPrisma 7 compatibility patch complete. ${patched} files patched.`);
