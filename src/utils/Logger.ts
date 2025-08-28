import { ILogger } from "src/models/logger.model";
import { LogLevel } from "vite";

export class Logger implements ILogger {
	private packageName;
	private logLevel;
	private colors = {
		reset: '\x1b[0m',
		debug: '\x1b[1;93m',
		red: '\x1b[1;31m',
		green: '\x1b[1;32m',
		yellow: '\x1b[1;33m'
	};

	constructor(packageName: string, logLevel: LogLevel | "debug" = "info") {
		this.packageName = packageName;
		this.logLevel = logLevel;
	}

	private log(msg: string[], prefix: string = "") {
		this.logLevel !== "silent" && process.stdout.write(`${prefix}${this.packageName}${prefix ? this.colors.reset : ''} ${msg.join(" ")}\n`);
	}

	debug(...msg: string[]): void {
		this.logLevel === "debug" && this.log(msg, this.colors.debug);
	}

	info(...msg: string[]): void {
		["debug", "info", "warn"].includes(this.logLevel) && this.log(msg);
	}
	success(...msg: string[]): void {
		["debug", "info", "warn"].includes(this.logLevel) && this.log(msg, this.colors.green);
	}
	warn(...msg: string[]): void {
		["info", "warn"].includes(this.logLevel) && this.log(msg, this.colors.yellow);
	}
	error(...msg: string[]): void {
		this.log(msg, this.colors.red);
	}
}
