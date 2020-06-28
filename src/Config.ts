export interface Config {
  files: Files;
  environments?: string[];
  values?: Values;
}

export interface Files {
  [name: string]: {
    source: string;
    target: string;
  };
}

export interface Values {
  [name: string]: ValueDef;
}

export type FlatValues = Record<string, string>;

export type ValueDef =
  | string
  | number
  | boolean
  | NamedValue
  | SecretValue
  | ExprValue
  | EnvValue;

export interface NamedValue {
  value: string;
}

export interface SecretValue {
  secret: number | any[];
}

export interface ExprValue {
  expr: string;
}

export interface EnvValue {
  if_env: Record<string, ValueDef>;
}
