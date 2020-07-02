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

function parseRange(range: string): number[] {
  if (range === '!') return SPECIAL_SECRET_RANGE;
  if (range.length !== 3 || range.charAt(1) !== '-') return null;

  const fromCode = range.charCodeAt(0);
  const toCode = range.charCodeAt(2);
  if (fromCode >= toCode) return null;
  return [fromCode, toCode + 1];
}

const configFileName = 'genvy.json';
const secretsFileName = '.genvy.secrets';

export class Genvy {
  private exprValues: FlatValues = {};
  private secrets: FlatValues;
  private values: FlatValues;

  private rootDir: string;
  private currentName: string;

  constructor(private readonly targetEnv: string = '') {}

  generate() {
    try {
      console.log('--- Starting genvy');

      const config = this.findConfig();
      this.validateConfig(config);
      this.secrets = this.findSecrets();
      this.values = this.parseValues(config.values || {});

      for (const name in config.files) {
        this.currentName = name;
        const { source, target } = config.files[name];
        const sourceObj = this.findSource(source);
        const targetObj = this.parseValues(sourceObj);
        this.writeEnvFile(targetObj, target);
      }

      this.writeSecretsFile();
      console.log('--- genvy finished successfully');
    } catch (e) {
      this.handleError(e);
    }
  }

  // File operations

  private findConfig(): Config {
    this.rootDir = process.cwd();

    let configPath = '';
    do {
      configPath = path.join(this.rootDir, configFileName);
      if (!fs.existsSync(configPath)) {
        configPath = '';
        this.rootDir = path.join(this.rootDir, '..');
      }
    } while (!configPath && this.rootDir !== '/');
    if (!configPath) this.reject('Could not find configuration file.');

    const configSrc = fs.readFileSync(configPath, { encoding: 'utf8' });
    return JSON.parse(configSrc);
  }

  private findSecrets(): FlatValues {
    const fullPath = path.join(this.rootDir, `.genvy.secrets`);
    if (!fs.existsSync(fullPath)) return {};

    const src = fs.readFileSync(fullPath, { encoding: 'utf8' });
    return JSON.parse(src);
  }

  private findSource(sourcePath: string): Values {
    const fullPath = path.join(this.rootDir, sourcePath);
    if (!fs.existsSync(fullPath)) {
      this.reject(`Source file not found: ${fullPath}`);
    }

    console.log('Found source', fullPath);
    return JSON.parse(fs.readFileSync(fullPath, { encoding: 'utf8' }));
  }

  private writeEnvFile(outValues: FlatValues, targetPath: string) {
    const fullPath = path.join(this.rootDir, targetPath);
    const content = Object.entries(outValues)
      .map(([key, value]) => `${key.toUpperCase()}=${value}`)
      .join('\n');

    fs.writeFileSync(fullPath, content);
    console.log('Wrote to target', fullPath, '\n');
  }

  private writeSecretsFile() {
    const fullPath = path.join(this.rootDir, secretsFileName);
    const content = JSON.stringify(this.secrets, null, 2);
    fs.writeFileSync(fullPath, content);
    console.log('Wrote secrets file', fullPath, '\n');
  }

  // Processing

  private parseValues(source: Values): FlatValues {
    const result = {};
    for (const key in source) {
      result[key] = this.resolveValue(key, source[key]);
    }
    return result;
  }

  private resolveValue(key: string, def: ValueDef): string {
    if (typeof def !== 'object') return String(def);
    if (Object.keys(def).length > 1)
      this.reject(
        JSON.stringify(def),
        'Non-primitive values must specify exactly one of the following keys:',
        'value, secret, expr, if_env',
      );

    if ('value' in def) {
      if (!this.currentName)
        this.reject(
          JSON.stringify(def),
          'Cannot use named values in configuration.',
        );
      return this.values[def.value];
    }
    if ('if_env' in def) {
      const { targetEnv } = this;
      if (!def.if_env[targetEnv])
        this.reject(
          JSON.stringify(def),
          `No value specified for environment "${targetEnv}"`,
        );
      return this.resolveValue(key, def.if_env[targetEnv]);
    }
    if ('expr' in def) {
      return this.resolveExpression(def);
    }
    if ('secret' in def) {
      return this.resolveSecret(key, def);
    }
    return null;
  }

  private resolveExpression(def: ExprValue): string {
    if (!EXPR.test(def.expr))
      this.reject(JSON.stringify(def), 'Invalid expression.');

    const { expr } = def;
    if (!this.exprValues[expr]) {
      const evalExpr = new Function(`return ${expr}`);
      this.exprValues[expr] = evalExpr();
    }
    return this.exprValues[expr];
  }

  private resolveSecret(key: string, def: SecretValue): string {
    const { secret } = def;
    if (typeof secret === 'number') {
      return this.generateSecret(key, secret, DEFAULT_SECRET_RANGES);
    } else if (Array.isArray(secret)) {
      const [length, ...ranges] = secret;
      return this.generateSecret(
        key,
        length,
        ranges.map(parseRange).filter(Boolean),
      );
    } else {
      this.reject(JSON.stringify(def), 'Invalid secret definition.');
    }
  }

  private generateSecret(
    key: string,
    length: number,
    ranges: number[][],
  ): string {
    const secretKey = this.currentName
      ? `${this.currentName}::${key}::${this.targetEnv}`
      : `${key}::${this.targetEnv}`;
    if (secretKey in this.secrets) return this.secrets[secretKey];

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
    const secret = String.fromCharCode(...codes);

    this.secrets[secretKey] = secret;
    return secret;
  }

  // Miscellaneous

  private validateConfig({ files, environments }: Config) {
    if (!files) {
      this.reject('Configuration file must contain a files block.');
    }
    if (environments) {
      const { targetEnv } = this;

      if (!targetEnv) {
        this.reject(
          'Target environment must be specified ' +
            'if environment list is provided.',
        );
      } else if (!environments.includes(targetEnv)) {
        this.reject(
          `Target environment ${targetEnv} is not listed ` +
            `in environment list ${JSON.stringify(environments)}`,
        );
      }
    }
  }

  private reject(...message: string[]): never {
    throw Error('>> ' + message.join('\n'));
  }

  private handleError(e: Error): never {
    console.error('Error:');
    console.error(e.message);
    if (!e.message.startsWith('>>')) {
      console.error(e.stack);
    }
    process.exit(1);
  }
}
