#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  Config,
  Values,
  FlatValues,
  ValueDef,
  ExprValue,
  SecretValue,
} from './Config';

const EXPR = /^[0-9\+\-\*\/\%\(\) ]+$/;
const SPECIAL_SECRET_RANGE = [33, 48];
const DEFAULT_SECRET_RANGES = [
  [48, 58],
  [65, 91],
  [97, 123],
];

const targetEnv = process.argv[2];
const configFileName = 'genvy.json';
const exprValues = {};

run();

function run() {
  console.log('--- Starting genvy');

  try {
    const [config, rootDir] = findConfig();
    validateConfig(config);

    const values = parseValues(config.values || {});
    for (const name in config.files) {
      const { source, target } = config.files[name];
      const sourceObj = findSource(source, rootDir);
      const targetObj = parseValues(sourceObj, values);
      writeToFile(targetObj, target, rootDir);
    }
  } catch (e) {
    console.error('Error:');
    console.error(e.message);
    if (!e.message.startsWith('>>')) {
      console.error(e.stack);
    }
    process.exit(1);
  }

  console.log('--- genvy finished successfully');
}

function findConfig(): [Config, string] {
  let rootDir = process.cwd();
  let configPath = '';
  do {
    configPath = path.join(rootDir, configFileName);
    if (!fs.existsSync(configPath)) {
      configPath = '';
      rootDir = path.join(rootDir, '..');
    }
  } while (!configPath && rootDir !== '/');
  if (!configPath) reject('Could not find configuration file.');

  const configSrc = fs.readFileSync(configPath, { encoding: 'utf8' });
  return [JSON.parse(configSrc), rootDir];
}

function validateConfig(config: Config) {
  if (!config.files) {
    reject('Configuration file must contain a files block.');
  }
  if (config.environments) {
    const { environments } = config;
    if (!targetEnv) {
      reject(
        'Target environment must be specified ' +
          'if environment list is provided.',
      );
    } else if (!environments.includes(targetEnv)) {
      reject(
        `Target environment ${targetEnv} is not listed ` +
          `in environment list ${JSON.stringify(environments)}`,
      );
    }
  }
}

function findSource(sourcePath: string, rootDir: string): Values {
  const fullPath = path.join(rootDir, sourcePath);
  if (!fs.existsSync(fullPath)) {
    reject(`Source file not found: ${fullPath}`);
  }

  console.log('Found source', fullPath);
  return JSON.parse(fs.readFileSync(fullPath, { encoding: 'utf8' }));
}

function writeToFile(
  outValues: FlatValues,
  targetPath: string,
  rootDir: string,
) {
  const fullPath = path.join(rootDir, targetPath);
  const content = Object.entries(outValues)
    .map(([key, value]) => `${key.toUpperCase()}=${value}`)
    .join('\n');

  fs.writeFileSync(fullPath, content);
  console.log('Wrote to target', fullPath, '\n');
}

function parseValues(source: Values, values?: FlatValues): FlatValues {
  const result = {};
  for (const key in source) {
    result[key] = resolveValue(source[key], values);
  }
  return result;
}

function resolveValue(def: ValueDef, values?: FlatValues): string {
  if (typeof def !== 'object') return String(def);
  if (Object.keys(def).length > 1)
    reject(
      JSON.stringify(def),
      'Non-primitive values must specify exactly one of the following keys:',
      'value, secret, expr, if_env',
    );

  if ('value' in def) {
    if (!values)
      reject(JSON.stringify(def), 'Cannot use named values in configuration.');
    return values[def.value];
  }
  if ('if_env' in def) {
    if (!def.if_env[targetEnv])
      reject(
        JSON.stringify(def),
        `No value specified for environment "${targetEnv}"`,
      );
    return resolveValue(def.if_env[targetEnv], values);
  }
  if ('expr' in def) {
    return resolveExpression(def);
  }
  if ('secret' in def) {
    return resolveSecret(def);
  }
  return null;
}

function resolveExpression(def: ExprValue): string {
  if (!EXPR.test(def.expr)) reject(JSON.stringify(def), 'Invalid expression.');

  const { expr } = def;
  if (!exprValues[expr]) {
    const evalExpr = new Function(`return ${expr}`);
    exprValues[expr] = evalExpr();
  }
  return exprValues[expr];
}

function resolveSecret(def: SecretValue): string {
  const { secret } = def;
  if (typeof secret === 'number') {
    return generateSecret(secret, DEFAULT_SECRET_RANGES);
  } else if (Array.isArray(secret)) {
    const [length, ...ranges] = secret;
    return generateSecret(length, ranges.map(parseRange).filter(Boolean));
  } else {
    reject(JSON.stringify(def), 'Invalid secret definition.');
  }
}

function parseRange(range: string): number[] {
  if (range === '!') return SPECIAL_SECRET_RANGE;
  if (range.length !== 3 || range.charAt(1) !== '-') return null;

  const fromCode = range.charCodeAt(0);
  const toCode = range.charCodeAt(2);
  if (fromCode >= toCode) return null;
  return [fromCode, toCode + 1];
}

function generateSecret(length: number, ranges: number[][]): string {
  ranges.sort((one, other) => one[0] - other[0]);

  const intervals = ranges.map(([from, to]) => to - from);
  const totalRange = intervals.reduce((total, sub) => total + sub, 0);

  const codes = [];
  for (let i = 0; i < length; i++) {
    let n = Math.trunc(Math.random() * totalRange);
    let j = 0;
    while (n >= intervals[j]) {
      n -= intervals[j];
      j++;
    }
    codes[i] = ranges[j][0] + n;
  }
  return String.fromCharCode(...codes);
}

function reject(...message: string[]): never {
  throw Error('>> ' + message.join('\n'));
}
