import { IncomingMessage, ServerResponse } from "node:http";
import { AntPathMatcher } from "src/utils/AntPathMatcher";
import { ApiRestFsMockError } from "src/utils/Errors";
import { Connect, LogLevel, ResolvedConfig } from "vite";

/**
 * Http method handled by plugin.
 */
type ApiRestFsMockHttpMethod = "HEAD" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

/**
 * Type for request handled by plugin. It extends _Http.IncomingMessage_ to facilitate request's data like express's request type.
 */
export interface ApiRestFsMockRequest extends IncomingMessage {
    body: any;
    params: Record<string, string> | null;
	query: URLSearchParams;
	files: {
		name: string;
		content: Buffer<ArrayBuffer>;
		contentType: string;
	}[] | null;
}

export type ApiRestFsMockSimpleHandleFunction = (req: ApiRestFsMockRequest, res: ServerResponse) => void | Promise<void>;
export type ApiRestFsMockMiddlewareFunction = (req: ApiRestFsMockRequest, res: ServerResponse, next: Connect.NextFunction) => void | Promise<void>;
export type ApiRestFsMockErrorHandleFunction = (err: any, req: ApiRestFsMockRequest | IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => void | Promise<void>;
export type ApiRestFsMockParserFunction = (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => void | Promise<void>;

export type APiRestFsMockParser = boolean | {
	parser: ApiRestFsMockParserFunction | ApiRestFsMockParserFunction[],
	transform: (req: IncomingMessage) => {
		body: any | undefined;
		files: {
			name: string;
			content: Buffer<ArrayBuffer>;
			contentType: string;
		}[] | undefined;
		query: URLSearchParams | undefined;
	}
};

/**
 * It defines the pagination object's type. It will be used to paginate results.
 */
type ApiRestFsMockPaginationCommon = {
    /**String representative the limit key in url request or field path in body, which value will be used to limit results. **Required** */
    limit?: string;
    /**String representative the skip key in url request or field path in body, which value will be used to skip results. **Required** */
    skip?: string;
    /**String representative the sort key in url request or field path in body, which value will be used to sort results. */
    sort?: string;
    /**String representative which order will be used to order results. */
    order?: "ASC" | "DESC";
}

type ApiRestFsMockPagination = (
    | {
        /**Defines where pagination options are provided: in body or like query-param */
        type: "body";
        /**Defines root pagination object in body, if it exists. */
        root?: string;
    }
    | {
        type: "query-param";
        root?: never;
    }
) & ApiRestFsMockPaginationCommon;

/**
 * It defines the filter object's type. It will be used to filter results.
 */
type ApiRestFsMockFilterCommon = {
    /**String representative the key in url request or field path in body, which value will be used to filter results. **Required** */
    key: string;
    /**String representative filter value's type or function that returns parsed value. **Required** */
    valueType: "string" | "boolean" | "number" | "date" | "string[]" | "boolean[]" | "number[]" | "date[]" | ((val: any) => any);
    /**String representative comparison filter type. **Required** */
	comparison: "eq" | "ne" | "in" | "nin" | "lt" | "lte" | "gt" | "gte" | "regex";
	/**Regex flags for comparison. Valid only for __regex__ comparison. */
    regexFlags?: string;
}

type ApiRestFsMockFilter = (
    | {
        /**Defines where pagination options are provided: in body or like query-param. **Required** */
        type: "body";
        /**Defines root pagination object in body, if it exists. */
		root?: string;
		/**List of filters */
		filters: ApiRestFsMockFilterCommon[];
    }
    | {
        type: "query-param";
        root?: never;
		filters: ApiRestFsMockFilterCommon[];
    }
);

type ApiRestFsMockHandlerCommon = {
    /**
     * Apache Ant-style path pattern. **Required**
     *
     * The mapping matches URLs using the following rules:
     * - **?** matches one character;
     * - __*__ matches zero or more characters;
     * - __**__ matches zero or more directories in a path;
     * - __{spring:[a-z]+}__ matches the regexp __[a-z]+__ as a path variable named __spring__.
     */
    pattern: string;
    /**Disable the handler. @default false */
    disabled?: boolean;
    /**Like *delay* of plugin options but applied only for this handler. If it isn't present, delay plugin option value is used. */
	delay?: number;
	/** Like *parser* of plugin options but applied only for __REST__ handler. If both options are settled, plugin option is discarded. */
	parser?: APiRestFsMockParser;
}

/**
 * It defines the object type of the handler for a request.
 */
export type ApiRestFsMockHandler = (
    | {
        /**
         * HTTP method handled by plugin:
         * - __HEAD__
         * - __GET__
         * - __POST__
         * - __PUT__
         * - __PATCH__
         * - __DELETE__
         * - __OPTIONS__
         */
        method: "HEAD" | "GET" | "POST";
        /**
         * Handler for requests that matches __pattern__ option. **Required**
         *
         * It can be:
         * - a string with value **fs**. So handle searchs file on the file system starting from value indicates in _fsDir_ plugin option.
         * - a custom void **ApiRestFsMockSimpleHandleFunction** function, sync or async, with **ApiRestFsMockRequest** _req_ and **Http.ServerResponse** _res_ params.
         */
        handle: "FS";
        /**
         * It is applied to request before applying _handle_ option.
         *
         * It can be:
         * - a void function, sync or async, with **ApiRestFsMockRequest** _req_ param
         * - an object that will be used to change url request, with a property __transform__ that can be:
         *      - a function that returns a string,
         *      - an object array with _searchValue_ and _replaceValue_ properties.
         */
        preHandle?: {
            transform: ((originalEndpoint: string) => string) | { searchValue: string, replaceValue: string }[];
        };
        /**
         * Function applied after __fs__ handling request to handle response with three param:
         * - **ApiRestFsMockRequest** _req_
         * - **Http.IncomingMessage** _res_
         * - data, the file read from file system.
         */
        postHandle?: never;
        /**
         * Like *pagination* of plugin options but applied only for this handler.
         *
         * It can be:
         * - a string __none__, so no pagination will be used
         * - an object which:
         *      - _value_ is an **ApiRestFsMockPagination** object.
         *      - _key_ is a string that can be:
         *          - __exclusive__, so only this object will be used to paginate results
         *          - __inclusive__, so this object and _pagination plugin option_ object, if it's present, will be merged and used to paginate results
         *
         * If it isn't present, _pagination plugin option_ will be used if it's present.
         */
        pagination?: "none" | Record<"exclusive"|"inclusive",ApiRestFsMockPagination>;
        /**
         * Like *filters* of plugin options but applied only for this handler.
         *
         * It can be:
         * - a string __none__, so no filters will be used
         * - an object which:
         *      - _value_ is an **ApiRestFsMockPagination** objects list
         *      - _key_ is a string that can be:
         *          - __exclusive__, so only this objects list will be used to filter results
         *          - __inclusive__, so this objects list and _filters plugin option_ objects list, if it's present, will be merged and used to filter results
         */
		filters?: "none" | Record<"exclusive" | "inclusive", ApiRestFsMockFilter>;
	}
	| {
		method: "HEAD" | "GET" | "POST";
		handle: "FS";
		preHandle?: {
			transform: ((originalEndpoint: string) => string) | { searchValue: string, replaceValue: string }[];
		};
		postHandle?: (req: ApiRestFsMockRequest, res: ServerResponse, data: string | null) => void | Promise<void>;
		pagination?: never;
		filters?: never;
	}
	| {
		method: "PUT" | "PATCH" | "DELETE";
		handle: "FS";
		preHandle?: {
			transform: ((originalEndpoint: string) => string) | { searchValue: string, replaceValue: string }[];
		};
		postHandle?: (req: ApiRestFsMockRequest, res: ServerResponse, data: string | null) => void | Promise<void>;
		pagination?: never;
		filters?: never;
	}
    | {
		method: "HEAD" | "GET" | "POST" | "PUT" | "PATCH" | "OPTIONS" | "DELETE";
        handle: ApiRestFsMockSimpleHandleFunction;
        preHandle?: never;
        postHandle?: never;
        pagination?: never;
		filters?: never;
    }
) & ApiRestFsMockHandlerCommon;

export interface ApiRestFsMockOptions {
    /**It disables plugin. @default false */
	disable?: boolean;
    /**Log level. @default "info" */
    logLevel?: LogLevel | "debug";
    /** Simulate a timeout from gateway and force response to http status 504 but it doesn't block execution. */
    gatewayTimeout?: number;
    /**Set a delay to every response. @default 0 */
    delay?: number;
    /**Value or values list that will be used by plugin to match requests and handle them. @default "/api" */
    endpointPrefix?: string | string[];
    /**Directory's path starting from vite.config file directory, that will be used to handle __FS__ requests.*/
    fsDir?: string | null;
    /**Option that indicates behavior for request not handled by plugin. If its value is _forward_, it bypasses __errorMiddlewares option__. @default "404" */
	noHandledRequestsAction?: "404" | "forward";
	/**
	 * Option that defines how and whether to parse the request body, route parameters, and query parameters, which will be used to construct the **ApiRestFsMockRequest**. It is executed after __handlerMiddlewares__.
	 *
	 * It can take the following values:
	 * - __boolean__
	 *      - ___true___: enables the library's default simple parser,
	 *      - ___false___: disables request parsing entirely.
	 * - __object__ - must contain the following properties:
	 *      - ___parser___: a function or an array of functions compatible with Express parsers, used to process the incoming request.
	 *      - __transform__: a function that receives the parsed request and returns an object containing *body*, *query*, *files*, which will then be used to build the final **ApiRestFsMockRequest** only if they don't ___undefined___.
	 *
	 * @default true
	 */
	parser?: APiRestFsMockParser;
    /****ApiRestFsMockMiddlewareFunction** functions like express's middleware executed before each request handled by plugin handlers (not works with __FS__ request). Express's middlewares can be used also. */
    handlerMiddlewares?: ApiRestFsMockMiddlewareFunction[];
    /****ApiRestFsMockErrorHandleFunction** functions list linked for each request handled by plugin that throw error, like express's middlewares. */
    errorMiddlewares?: ApiRestFsMockErrorHandleFunction[];
    /****ApiRestFsMockHandler** objects list used by plugin to handle requests. If it's not present, plugin works only for file-based request. */
    handlers?: ApiRestFsMockHandler[];
    /**Object that defines how paginate the requests handled by FS API that supports it, individually by http method or for all them. **Work only for json file which contains array value** */
    pagination?: Record<"ALL" | "HEAD" | "GET" | "POST", ApiRestFsMockPagination> | null;
    /**Object that defines how filter the requests handled by FS API that supports it, individually by http method or for all them. **Work only for json file which contains array value** */
    filters?: Record<"ALL" | "HEAD" | "GET" | "POST", ApiRestFsMockFilter> | null;
}

/** @internal */
export type ApiRestFsMockOptionsRequired = Omit<Required<ApiRestFsMockOptions>, "handlerMiddlewares" | "endpointPrefix"> & { endpointPrefix: string[], fullFsDir: string | null, config: ResolvedConfig, matcher: AntPathMatcher, middlewares: ApiRestFsMockMiddlewareFunction[] };

/** @internal */
export type ApiRestFsMockErrorType = "NO_HANDLER" | "ERROR" | "TIMEOUT" | "MANUALLY_HANDLED" | "READ_FILE";

/** @internal */
export interface HandledRequestData {
    status: number | null,
	data: any | null;
    headers: {
        name: string;
		value: string | number | readonly string[];
	}[];
}

/** @internal */
export interface ApiRestFsMockDataResponse {
	status: number;
	data: any | null;
	readFile: boolean;
	isError: boolean;
	headers: { name: string, value: string | number | readonly string[] }[],
	error?: ApiRestFsMockError;
	req?: ApiRestFsMockRequest | IncomingMessage;
	errorMiddlewares?: ApiRestFsMockOptionsRequired["errorMiddlewares"];
}
