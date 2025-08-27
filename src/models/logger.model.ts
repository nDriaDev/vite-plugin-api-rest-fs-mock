/** @internal */
export interface ILogger {
    info(...msg: string[]): void;
    success(...msg: string[]): void;
    warn(...msg: string[]): void;
    error(...msg: string[]): void;
}