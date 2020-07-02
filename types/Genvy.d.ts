export declare class Genvy {
    private readonly targetEnv;
    private exprValues;
    private secrets;
    private values;
    private rootDir;
    private currentName;
    constructor(targetEnv?: string);
    generate(): void;
    private findConfig;
    private findSecrets;
    private findSource;
    private writeEnvFile;
    private writeSecretsFile;
    private parseValues;
    private resolveValue;
    private resolveExpression;
    private resolveSecret;
    private generateSecret;
    private validateConfig;
    private reject;
    private handleError;
}
