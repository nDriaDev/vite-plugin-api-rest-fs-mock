import { ApiRestFsMockErrorType } from "src/models/index.model";
import { Constants } from "./constants";

export class ApiRestFsMockError extends Error {
	private type: ApiRestFsMockErrorType;
	private path: string;
	private code: number = Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;
	private extra: any;


    constructor(e: string, type: ApiRestFsMockErrorType, path: string, code?: number, extra?: any);
    constructor(e: Error, type: ApiRestFsMockErrorType, path: string, code?: number, extra?: any);
    constructor(e: string | Error, type: ApiRestFsMockErrorType, path: string, code?: number, extra?: any) {
        if (typeof e === "string") {
            super(e);
        } else {
            super(e.message, { cause: e.cause });
			this.stack = `${this.name}: ${this.message}\nCaused by: ${e.stack}`;
		}
		this.type = type;
		this.path = path;
		!!code && (this.code = code);
		!!extra && (this.extra = extra);
    }

    getType(): ApiRestFsMockErrorType {
        return this.type;
	}

	getPath(): string {
		return this.path;
	}

	getCode(): number {
		return this.code;
	}

	getExtra(): any {
		return this.extra;
	}
}
