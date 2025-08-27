import { createReadStream, createWriteStream, PathLike, statSync } from "node:fs";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { IncomingMessage, ServerResponse } from "node:http";
import { ApiRestFsMockDataResponse, ApiRestFsMockErrorHandleFunction, ApiRestFsMockHandler, ApiRestFsMockMiddlewareFunction, ApiRestFsMockOptions, ApiRestFsMockOptionsRequired, APiRestFsMockParser, ApiRestFsMockParserFunction, ApiRestFsMockRequest, HandledRequestData } from "src/models/index.model";
import { ResolvedConfig } from "vite";
import { AntPathMatcher } from "./AntPathMatcher";
import { join, parse as parsePath } from "node:path";
import { parse, URLSearchParams } from "node:url";
import { StringDecoder } from "node:string_decoder";
import { MimeType, MimeTypeExt } from "./MimeType";
import { Logger } from "./Logger";
import { Constants } from "./constants";
import { ApiRestFsMockError } from "./Errors";

export const Utils = {
    plugin: {
        initOptions(opts: ApiRestFsMockOptions | undefined, config: ResolvedConfig): ApiRestFsMockOptionsRequired {
            const fullFsDir = join(config.root, opts?.fsDir ?? "");
            const endpointPrefix = opts?.endpointPrefix
                ? Array.isArray(opts.endpointPrefix) && opts.endpointPrefix.length > 0
                    ? opts.endpointPrefix.map(el => {
                        let endpoint = Utils.requests.addSlash(el, "leading");
                        endpoint = Utils.requests.removeSlash(endpoint, "trailing");
                        return endpoint;
                    })
                    : Array.isArray(opts.endpointPrefix) ? opts.endpointPrefix : [opts.endpointPrefix]
                : ['/api'];
            return {
                disable: opts?.disable ?? false,
                logLevel: opts?.logLevel || "info",
                delay: !!opts?.delay ? opts.delay : 0,
                gatewayTimeout: opts?.gatewayTimeout ?? 0,
                endpointPrefix: endpointPrefix.filter(el => el !== "" && el !== "/"),
                fsDir: opts?.fsDir ?? null,
                fullFsDir: fullFsDir || null,
				noHandledRequestsAction: opts?.noHandledRequestsAction ?? "404",
				parser: opts?.parser ?? true,
                middlewares: opts?.handlerMiddlewares ?? [],
                errorMiddlewares: opts?.errorMiddlewares ?? [],
                handlers: opts?.handlers ?? [],
                pagination: opts?.pagination ?? null,
                filters: opts?.filters ?? null,
                config,
                matcher: new AntPathMatcher()
            };
		},
		validatingOptions() {
			//TODO
		}
    },
    files: {
        async isDirExists(s: PathLike) {
            try {
                return (await stat(s)).isDirectory();
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    return false;
                }
                throw err;
            }
        },
        async createDir(s: PathLike) {
            try {
                await mkdir(s, { recursive: true });
            } catch (error) {
                throw error;
            }
        },
        async directoryFileList(s: PathLike, options?: { encoding: BufferEncoding | null; withFileTypes?: false | undefined; recursive?: boolean | undefined; }) {
            try {
                return await readdir(s, options);
            } catch (err: any) {
                if (err.code === 'ENOTDIR') {
                    return [];
                }
                throw err;
            }
        },
        async isFileExists(s: PathLike) {
            try {
                return (await stat(s)).isFile();
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    return false;
                }
                throw err;
            }
        },
        async readingFile(s: PathLike) {
            try {
                await readFile(s, 'utf-8');
            } catch (err: any) {
                throw err;
            }
		},
		async readingStreamFile(s: PathLike) {
			const { promise, reject, resolve } = Promise.withResolvers<string>();
			const stream = createReadStream(s, { encoding: "utf-8" });
			let data = "";
			stream.on('data', chunk => {
				data += chunk;
			});
			stream.on('end', () => {
				resolve(data);
			});
			stream.on('error', (err: any) => {
				reject(err);
			})
			return promise;
		},
		async writingStreamFile(s: PathLike, data: any, options: Parameters<typeof createWriteStream>[1]) {
			const { promise, reject, resolve } = Promise.withResolvers<void>();
			const stream = createWriteStream(s, options);
			stream.on('error', reject);
			stream.on('finish', ()=> resolve());
			stream.write(data, "utf-8");
			stream.end();
			return promise;
		},
        async writingFile(s: string, fileFound: boolean, data: any, mimeType: MimeType | null, withStream: boolean) {
            try {
                const { dir, ext, name } = parsePath(Utils.requests.removeSlash(s, "both"));
                let file, path = s;
                if (!fileFound) {
                    await Utils.files.createDir(dir);
                }
                if (!ext && mimeType != null) {
                    path += `${MimeTypeExt[mimeType]}`;
                }
                if (mimeType != null && mimeType.toString() === MimeTypeExt["application/json"] || !!ext && ext === MimeTypeExt["application/json"]) {
                    file = JSON.stringify(data, null, 2);
                } else {
                    file = JSON.stringify(data);
				}
				withStream
					? await this.writingStreamFile(s, file, { encoding: "utf-8" })
					: await writeFile(s, file, { encoding: "utf-8" });
            } catch (err: any) {
                throw err;
            }
        },
        async removeFile(s: PathLike) {
            try {
                await unlink(s);
            } catch (error) {
                throw error;
            }
        },
        getByteLength(data: any) {
            return Buffer.byteLength(data === "string" ? data : JSON.stringify(data), "utf-8").toString();
        },
        isDeepEqual(objA: unknown, objB: unknown, map = new WeakMap()): boolean {
            if (Object.is(objA, objB)) {
                return true;
            }

            if (objA instanceof Date && objB instanceof Date) {
                return objA.getTime() === objB.getTime();
            }
            if (objA instanceof RegExp && objB instanceof RegExp) {
                return objA.toString() === objB.toString();
            }

            if (
                typeof objA !== 'object' ||
                objA === null ||
                typeof objB !== 'object' ||
                objB === null
            ) {
                return false;
            }

            if (map.get(objA) === objB) {
                return true;
            }

            map.set(objA, objB);

            const keysA = Reflect.ownKeys(objA);
            const keysB = Reflect.ownKeys(objB);

            if (keysA.length !== keysB.length) {
                return false;
            }

            for (let i = 0; i < keysA.length; i++) {
                if (
                    !Reflect.has(objB, keysA[i]) ||
                    !this.isDeepEqual((objA as { [key: string | symbol]: unknown })[keysA[i]], (objB as { [key: string | symbol]: unknown })[keysA[i]], map)
                ) {
                    return false;
                }
            }

            return true;
        }
    },
    requests: {
        addSlash(url: string, type: "leading" | "trailing" | "both") {
            let newUrl = url;
            if (["both", "leading"].includes(type)) {
                !newUrl.startsWith("/") && (newUrl = "/" + newUrl);
            }
            if (["both", "trailing"].includes(type)) {
                !newUrl.endsWith("/") && (newUrl += "/");
            }
            return newUrl;
        },
        removeSlash(url: string, type: "leading" | "trailing" | "both") {
            let newUrl = url;
            if (["both", "leading"].includes(type)) {
                newUrl.startsWith("/") && (newUrl = newUrl.substring(1));
            }
            if (["both", "trailing"].includes(type)) {
                newUrl.endsWith("/") && (newUrl = newUrl.substring(newUrl.length - 1));
            }
            return newUrl;
        },
        buildFullUrl(req: IncomingMessage, config: ResolvedConfig): URL {
			return new URL(req.url!, `http${config.server.https ? 's' : ''}://${config.server.host ?? req.headers.host ?? "localhost"}`);
        },
        matchesEndpointPrefix(url: string | undefined, prefixes: string[]) {
            return url && prefixes.some(el => url.startsWith(el));
        },
        removeEndpointPrefix(originalUrl: string, prefixes: string[]) {
            let url = "";
            if (originalUrl) {
                for (const prefix of prefixes) {
                    if (originalUrl.startsWith(prefix)) {
                        url = originalUrl.substring(prefix.length);
                        break;
                    }
                }
            }
            return url;
        },
        async mergeBodyChunk(req: IncomingMessage): Promise<string> {
            let body = '';
            const decoder = new StringDecoder("utf8");
            const { promise, resolve, reject } = Promise.withResolvers<typeof body>();
            req.on("data", chunk => {
                body += decoder.write(chunk);
            })
            req.on("error", () => {
                reject(new Error("Error parsing request body"));
            })
            req.on("end", () => {
                resolve(body);
            })
            return promise;
		},
		createRequest(req: IncomingMessage): ApiRestFsMockRequest {
			const request: ApiRestFsMockRequest = req as ApiRestFsMockRequest;
			request.body = null;
			request.files = null;
			request.params = null;
			request.query = new URLSearchParams();
			return request;
		},
		async parseRequest(request: ApiRestFsMockRequest, res: ServerResponse, fullUrl: URL, parserRequest: APiRestFsMockParser) {
			if (!!parserRequest) {
				if (typeof parserRequest === "object") {
					const { promise, reject, resolve } = Promise.withResolvers<any>();
					const next = (error?: any) => resolve(error);
					let parserFunc: ApiRestFsMockParserFunction[] = [];
					if (!Array.isArray(parserRequest.parser)) {
						parserFunc.push(parserRequest.parser);
					} else {
						parserFunc = parserRequest.parser;
					}
					Promise.all(parserFunc.map(callbackfn => callbackfn(request, res, next))).then(() => resolve("done")).catch(reject);
					let result;
					try {
						result = await promise;
					} catch (error) {
						throw new ApiRestFsMockError("Error parsing request.", "ERROR", fullUrl.pathname);
					}
					if (!!result && result !== "done") {
						throw result;
					}
					try {
						const { body, files, query } = parserRequest.transform(request);
						body != undefined && (request.body = body);
						files != undefined && (request.files = files);
						query != undefined && (request.query = query);
					} catch (error) {
						throw new ApiRestFsMockError("Error parsing request.", "ERROR", fullUrl.pathname);
					}
				} else {
					try {
						const { query } = parse(request.url!, true);
						let body: any,
							files: ApiRestFsMockRequest["files"] = null;
						if (!["GET", "HEAD", "OPTIONS"].includes(request.method!)) {
							const mergedChunk = await this.mergeBodyChunk(request);
							const contentType = request.headers["content-type"];
							if (contentType?.includes("text")) {
								body = mergedChunk;
							}
							if (contentType?.includes("application/json")) {
								try {
									body = JSON.parse(mergedChunk);
								} catch (error) {
									throw error;
								}
							}
							if (contentType?.includes("application/x-www-form-urlencoded")) {
								body = new URLSearchParams(mergedChunk);
							}
							if (contentType?.includes('multipart/form-data')) {
								const boundary = contentType.split("boundary=")[1];
								const parts: Record<string, string>[] = [];
								const boundaryStr = `--${boundary}`;
								const endBoundaryStr = `--${boundary}--`;

								const bodyWithouEndBoundary = mergedChunk.split(endBoundaryStr)[0];
								const rawParts: string[] = bodyWithouEndBoundary.split(boundaryStr).filter((part: string) => part.trim() !== '');

								rawParts.forEach(part => {
									const partData: Record<string, string> = {};
									const headersAndBody = part.split('\r\n\r\n');
									const headers = headersAndBody[0].trim();
									const body = headersAndBody[1];
									const headerLines = headers.split("\r\n");

									headerLines.forEach(line => {
										const [key, value] = line.split(": ");
										if (key && value) {
											partData[key.toLowerCase()] = value;
										}
									})

									partData.body = body.trim();
									parts.push(partData);
								});
								body = {};
								parts.forEach(part => {
									if (part["content-disposition"]) {
										const disposition = part["content-disposition"];
										const partContentType = part["content-type"];
										let [, name, filename] = disposition.split(";");
										if (name && name.includes("name=")) {
											name = name.split("name=")[1].replace(/"/g, "");
										}
										if (filename && filename.includes("filename=")) {
											filename = filename.split("filename=")[1].replace(/"/g, "");
										}
										if (partContentType.includes("application/json")) {
											body[name] = JSON.parse(part.body);
										} else if (partContentType.includes("text")) {
											body[name] = part.body;
										} else if (partContentType.includes("application/x-www-form-urlencoded")) {
											body[name] = new URLSearchParams(part.body);
										} else {
											const file = Buffer.from(part.body, "binary");
											if (!files) {
												files = [];
											}
											files.push({
												name,
												content: file,
												contentType: partContentType
											})
										}
									}
								});
							}
						}
						request.query = new URLSearchParams();
						if (!!query) {
							Object.entries(query).forEach(([key, value]) => {
								request.query.append(key, Array.isArray(value) ? value.join(",") : value ?? '');
							});
						}
						request.body = body;
						request.files = files;
					} catch (error) {
						throw new ApiRestFsMockError("Error parsing request.", "ERROR", fullUrl.pathname);
					}
				}
			}
        },
        MiddlewaresChain() {
            const middlewares: ApiRestFsMockMiddlewareFunction[] = [];
            const errorMiddlewares: ApiRestFsMockErrorHandleFunction[] = [];
            let currentIndex = 0;

            function use(m: ApiRestFsMockMiddlewareFunction[], me: ApiRestFsMockErrorHandleFunction[]) {
                m.forEach(mi => {
                    if (mi !== null) {
                        middlewares.push(mi);
                    }
                });
                me.forEach(mi => {
                    if (mi !== null) {
                        errorMiddlewares.push(mi);
                    }
                });
            }

            async function handle(req: ApiRestFsMockRequest, res: ServerResponse) {
                await _next(req, res);
                return true;
            }

            async function _next(req: ApiRestFsMockRequest, res: ServerResponse, error?: any) {
                if (error) {
                    if (errorMiddlewares.length > 0) {
                        const currentErrorMiddleware = errorMiddlewares[0];
                        errorMiddlewares.shift();
                        try {
                            return await currentErrorMiddleware(error, req, res, () => _next(req, res, error));
                        } catch (error) {
                            return await _next(req, res, error);
                        }
                    } else {
                        throw error;
                    }
                }
                if (currentIndex < middlewares.length) {
                    const currentMiddleware = middlewares[currentIndex];
                    currentIndex++;
                    try {
                        await currentMiddleware(req, res, (err) => _next(req, res, err));
                    } catch (error) {
                        await _next(req, res, error);
                    }
                } else {
                    //INFO middleware execution ended
                }
            }

            async function handleError(req: ApiRestFsMockRequest, res: ServerResponse, error: any, errorMiddlewares: ApiRestFsMockErrorHandleFunction[]) {
                if (errorMiddlewares.length > 0) {
                    const currentErrorMiddleware = errorMiddlewares[0];
                    errorMiddlewares.shift();
                    try {
                        return await currentErrorMiddleware(error, req, res, () => handleError(req, res, error, errorMiddlewares));
                    } catch (error) {
                        return await handleError(req, res, error, errorMiddlewares)
                    }
                } else {
                    throw error;
                }
            }

            return {
                handle,
                handleError,
                use
            };
		},
		hasPaginationOrFilters(method: ApiRestFsMockRequest["method"], paginationPlugin: ApiRestFsMockOptionsRequired["pagination"], filterPlugin: ApiRestFsMockOptionsRequired["filters"], paginationHandler: ApiRestFsMockHandler["pagination"], filtersHandler: ApiRestFsMockHandler["filters"]) {
			return (!!paginationHandler && paginationHandler !== "none")
				|| (!!filtersHandler && filtersHandler !== null)
				|| (paginationPlugin !== null && (method! in paginationPlugin || "ALL" in paginationPlugin))
				|| (filterPlugin !== null && (method! in filterPlugin || "ALL" in filterPlugin))
		},
        getPaginationAndFilters(request: ApiRestFsMockRequest, paginationHandler: ApiRestFsMockHandler["pagination"], filtersHandler: ApiRestFsMockHandler["filters"], paginationPlugin: ApiRestFsMockOptions["pagination"], filtersPlugin: ApiRestFsMockOptions["filters"]): { pagination: null | { limit: null | number, skip: null | number, sort: null | string, order: null | string }, filters: null | { key: string, value: any, comparison: string, regexFlags?: string }[] } {
            const result: { pagination: null | { limit: null | number, skip: null | number, sort: null | string, order: null | string }, filters: null | { key: string, value: any, comparison: string, regexFlags?: string }[] } = {
                pagination: null,
				filters: null
            }
            let pagPlugin: typeof result.pagination = null;
            let filtPlugin: typeof result.filters = null;
            if (!!paginationPlugin && (request.method! in paginationPlugin || "ALL" in paginationPlugin && ["HEAD", "GET", "POST"].includes(request.method!))) {
                const pag = request.method! in paginationPlugin
                    ? paginationPlugin[request.method! as keyof typeof paginationPlugin]
					: paginationPlugin.ALL;
                const limit = pag.limit
                    ? pag.type === "query-param"
                        ? request.query.get(pag.limit) !== null
                            ? Number(request.query.get(pag.limit))
                            : null
                        : null
                    : pag.root && pag.root in request.body
                        ? pag.limit && pag.limit in request.body[pag.root]
                            ? !!request.body[pag.root][pag.limit]
                                ? Number(request.body[pag.root][pag.limit])
                                : null
                            : null
                        : pag.limit && pag.limit in request.body
                            ? !!request.body[pag.limit]
                                ? Number(request.body[pag.limit])
                                : null
                            : null;
                const skip = pag.skip
                    ? pag.type === "query-param"
                        ? request.query.get(pag.skip) !== null
                            ? Number(request.query.get(pag.skip))
                            : null
                        : null
                    : pag.root && pag.root in request.body
                        ? pag.skip && pag.skip in request.body[pag.root]
                            ? !!request.body[pag.root][pag.skip]
                                ? Number(request.body[pag.root][pag.skip])
                                : null
                            : null
                        : pag.skip && pag.skip in request.body
                            ? !!request.body[pag.skip]
                                ? Number(request.body[pag.skip])
                                : null
                            : null;
                const order = pag.order
                    ? pag.type === "query-param"
                        ? request.query.get(pag.order) !== null
                            ? request.query.get(pag.order)
                            : null
                        : null
                    : pag.root && pag.root in request.body
                        ? pag.order && pag.order in request.body[pag.root]
                            ? !!request.body[pag.root][pag.order]
                                ? request.body[pag.root][pag.order]
                                : null
                            : null
                        : pag.order && pag.order in request.body
                            ? !!request.body[pag.order]
                                ? request.body[pag.order]
                                : null
                            : null;
                const sort = pag.sort
                    ? pag.type === "query-param"
                        ? request.query.get(pag.sort) !== null
                            ? request.query.get(pag.sort)
                            : null
                        : null
                    : pag.root && pag.root in request.body
                        ? pag.sort && pag.sort in request.body[pag.root]
                            ? !!request.body[pag.root][pag.sort]
                                ? request.body[pag.root][pag.sort]
                                : null
                            : null
                        : pag.sort && pag.sort in request.body
                            ? !!request.body[pag.sort]
                                ? request.body[pag.sort]
                                : null
                            : null;
                pagPlugin = {
                    limit,
                    skip,
                    sort,
                    order
                }
            }
            if (!!filtersPlugin && (request.method! in filtersPlugin || "ALL" in filtersPlugin && ["HEAD", "GET", "POST"].includes(request.method!))) {
                const filts = request.method! in filtersPlugin
                    ? filtersPlugin[request.method! as keyof typeof filtersPlugin]
					: filtersPlugin.ALL;
                filts.filters.forEach(filt => {
                    let value: any = filts.type === "query-param"
                        ? request.query.get(filt.key)
                        : filts.root && filts.root in request.body
                            ? filt.key in request.body[filts.root]
                                ? request.body[filts.root][filt.key]
                                : null
                            : filt.key in request.body
                                ? request.body[filt.key]
                                : null
                        ;
                    if (value != null) {
                        if (typeof filt.valueType === "string") {
                            switch (filt.valueType) {
                                case "string":
                                    break;
                                case "boolean":
                                    value = !["false", "0"].includes(value);
                                    break;
                                case "number":
                                    value = Number(value);
                                    break;
                                case "date":
                                    value = new Date(value);
                                    break;
                                case "string[]":
                                    value = value.split(",");
                                    break;
                                case "boolean[]":
                                    value = value.split(",").map((el: string) => !["false", "0"].includes(el));
                                    break;
                                case "number[]":
                                    value = value.split(",").map((el: string) => Number(el));
                                    break;
                                case "date[]":
                                    value = value.split(",").map((el: string) => new Date(el));
                                    break;
                            }
                        } else {
                            value = filt.valueType(value);
                        }
                        filtPlugin!.push({
                            key: `${filts.root ? filts.root + "." : ""}${filt.key}`,
                            value,
                            comparison: filt.comparison,
                            ...(filt.regexFlags ? { regexFlags: filt.regexFlags } : {})
                        });
                    }
                });
            }

            if (paginationHandler && paginationHandler !== "none") {
				const exclIncl = !!paginationHandler.exclusive ? "exclusive" : "inclusive";
                const limit = paginationHandler[exclIncl].limit
                    ? paginationHandler[exclIncl].type === "query-param"
                        ? request.query.get(paginationHandler[exclIncl].limit) !== null
                            ? Number(request.query.get(paginationHandler[exclIncl].limit))
                            : null
                        : null
                    : paginationHandler[exclIncl].root && paginationHandler[exclIncl].root in request.body
                        ? paginationHandler[exclIncl].limit && paginationHandler[exclIncl].limit in request.body[paginationHandler[exclIncl].root]
                            ? !!request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].limit]
                                ? Number(request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].limit])
                                : null
                            : null
                        : paginationHandler[exclIncl].limit && paginationHandler[exclIncl].limit in request.body
                            ? !!request.body[paginationHandler[exclIncl].limit]
                                ? Number(request.body[paginationHandler[exclIncl].limit])
                                : null
                            : null;
                const skip = paginationHandler[exclIncl].skip
                    ? paginationHandler[exclIncl].type === "query-param"
                        ? request.query.get(paginationHandler[exclIncl].skip) !== null
                            ? Number(request.query.get(paginationHandler[exclIncl].skip))
                            : null
                        : null
                    : paginationHandler[exclIncl].root && paginationHandler[exclIncl].root in request.body
                        ? paginationHandler[exclIncl].skip && paginationHandler[exclIncl].skip in request.body[paginationHandler[exclIncl].root]
                            ? !!request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].skip]
                                ? Number(request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].skip])
                                : null
                            : null
                        : paginationHandler[exclIncl].skip && paginationHandler[exclIncl].skip in request.body
                            ? !!request.body[paginationHandler[exclIncl].skip]
                                ? Number(request.body[paginationHandler[exclIncl].skip])
                                : null
                            : null;
                const order = paginationHandler[exclIncl].order
                    ? paginationHandler[exclIncl].type === "query-param"
                        ? request.query.get(paginationHandler[exclIncl].order) !== null
                            ? request.query.get(paginationHandler[exclIncl].order)
                            : null
                        : null
                    : paginationHandler[exclIncl].root && paginationHandler[exclIncl].root in request.body
                        ? paginationHandler[exclIncl].order && paginationHandler[exclIncl].order in request.body[paginationHandler[exclIncl].root]
                            ? !!request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].order]
                                ? request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].order]
                                : null
                            : null
                        : paginationHandler[exclIncl].order && paginationHandler[exclIncl].order in request.body
                            ? !!request.body[paginationHandler[exclIncl].order]
                                ? request.body[paginationHandler[exclIncl].order]
                                : null
                            : null;
                const sort = paginationHandler[exclIncl].sort
                    ? paginationHandler[exclIncl].type === "query-param"
                        ? request.query.get(paginationHandler[exclIncl].sort) !== null
                            ? request.query.get(paginationHandler[exclIncl].sort)
                            : null
                        : null
                    : paginationHandler[exclIncl].root && paginationHandler[exclIncl].root in request.body
                        ? paginationHandler[exclIncl].sort && paginationHandler[exclIncl].sort in request.body[paginationHandler[exclIncl].root]
                            ? !!request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].sort]
                                ? request.body[paginationHandler[exclIncl].root][paginationHandler[exclIncl].sort]
                                : null
                            : null
                        : paginationHandler[exclIncl].sort && paginationHandler[exclIncl].sort in request.body
                            ? !!request.body[paginationHandler[exclIncl].sort]
                                ? request.body[paginationHandler[exclIncl].sort]
                                : null
                            : null;
                if (paginationHandler.inclusive) {
                    pagPlugin != null && (
                        result.pagination = {
                            ...pagPlugin
                        }
                    );
                }
                result.pagination = {
                    ...(result.pagination != null ? result.pagination : {}),
                    limit,
                    skip,
                    sort,
                    order
                }
            }
            if (filtersHandler && filtersHandler !== "none") {
				const exclIncl = filtersHandler.exclusive ? "exclusive" : "inclusive" as keyof typeof filtersHandler;
				const filters: typeof result.filters = [];
                filtersHandler[exclIncl].filters.forEach(filt => {
					let value: any = filtersHandler[exclIncl].type === "query-param"
                        ? request.query.get(filt.key)
                        : filtersHandler[exclIncl].root && filtersHandler[exclIncl].root in request.body
							? filt.key in request.body[filtersHandler[exclIncl].root]
								? request.body[filtersHandler[exclIncl].root][filt.key]
                                : null
                            : filt.key in request.body
                                ? request.body[filt.key]
                                : null
                        ;
                    if (value != null) {
                        if (typeof filt.valueType === "string") {
                            switch (filt.valueType) {
                                case "string":
                                    break;
                                case "boolean":
                                    value = !["false", "0"].includes(value);
                                    break;
                                case "number":
                                    value = Number(value);
                                    break;
                                case "date":
                                    value = new Date(value);
                                    break;
                                case "string[]":
                                    value = value.split(",");
                                    break;
                                case "boolean[]":
                                    value = value.split(",").map((el: string) => !["false", "0"].includes(el));
                                    break;
                                case "number[]":
                                    value = value.split(",").map((el: string) => Number(el));
                                    break;
                                case "date[]":
                                    value = value.split(",").map((el: string) => new Date(el));
                                    break;
                            }
                        } else {
                            value = filt.valueType(value);
                        }
                        filters!.push({
                            key: `${filtersHandler[exclIncl].root ? filtersHandler[exclIncl].root + "." : ""}${filt.key}`,
                            value,
                            comparison: filt.comparison,
                            ...(filt.regexFlags ? {regexFlags: filt.regexFlags} : {})
                        });
                    }
                });
                if (filtersHandler.inclusive) {
                    filtPlugin != null && (result.filters = [...filtPlugin]);
                }
                result.filters = [
                    ...(result.filters != null ? result.filters : []),
                    ...filters
                ];
            }
            return result;
		},
		applyPaginationAndFilters(request: ApiRestFsMockRequest, paginationHandler: ApiRestFsMockHandler["pagination"], filtersHandler: ApiRestFsMockHandler["filters"], paginationPlugin: ApiRestFsMockOptions["pagination"], filtersPlugin: ApiRestFsMockOptions["filters"], dataFile: { originalData: any, data: any, mimeType: string, total: number}) {
			const data = JSON.parse(dataFile.data);
			dataFile.originalData = JSON.parse(dataFile.data);
			dataFile.data = data;
			if (dataFile.data !== null && Array.isArray(dataFile.data)) {
				const { pagination, filters } = this.getPaginationAndFilters(request, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin);
				if (filters !== null) {
					dataFile.data = dataFile.data.filter(el => {
						return filters.every(filter => {
							let value = null;
							if (filter.key.includes(".")) {
								const keySplitted = filter.key.split(".");
								value = Reflect.get(el, keySplitted[0]);
								value = Reflect.get(value, keySplitted[1]);
							} else {
								value = Reflect.get(el, filter.key);
							}
							let result;
							switch (filter.comparison) {
								case "eq":
									result = value === filter.value;
									break;
								case "ne":
									result = value !== filter.value;
									break;
								case "in":
									if (Array.isArray(value)) {
										if (Array.isArray(filter.value)) {
											result = filter.value.every(el => value.includes(el));
										} else {
											result = value.includes(filter.value);
										}
									} else {
										if (Array.isArray(filter.value)) {
											result = filter.value.includes(value);
										} else {
											result = filter.value === filter
										}
									}
									break;
								case "nin":
									if (Array.isArray(value)) {
										if (Array.isArray(filter.value)) {
											result = filter.value.every(el => !value.includes(el));
										} else {
											result = !value.includes(filter.value);
										}
									} else {
										if (Array.isArray(filter.value)) {
											result = !filter.value.includes(value);
										} else {
											result = filter.value !== filter
										}
									}
									break;
								case "lt":
									result = value < filter.value;
									break;
								case "lte":
									result = value <= filter.value;
									break;
								case "gt":
									result = value > filter.value;
									break;
								case "gte":
									result = value >= filter.value;
									break;
								case "regex":
									result = RegExp(filter.value, filter.regexFlags || "")
									break;
							}
							return result;
						});
					})
				}
				if (pagination !== null) {
					if (pagination.sort !== null && pagination.order !== null) {
						dataFile.data = dataFile.data.sort((a: any, b: any) => {
							return pagination.order === "ASC"
								? Reflect.get(a, pagination.sort as keyof typeof a) > Reflect.get(b, pagination.sort as keyof typeof b)
									? 1
									: Reflect.get(a, pagination.sort as keyof typeof a) < Reflect.get(b, pagination.sort as keyof typeof b)
										? -1
										: 0
								: Reflect.get(a, pagination.sort as keyof typeof a) < Reflect.get(b, pagination.sort as keyof typeof b)
									? 1
									: Reflect.get(a, pagination.sort as keyof typeof a) > Reflect.get(b, pagination.sort as keyof typeof b)
										? -1
										: 0
						});
					}
					dataFile.data = (dataFile.data as Array<any>).slice(pagination.skip ?? undefined, ((pagination.limit ?? 0) + (pagination.skip ?? 0) || undefined))
				}
				dataFile.total = dataFile.data.length;
			}
		},
        getCleanBody(contentType: string | undefined ,request: ApiRestFsMockRequest, paginationHandler: ApiRestFsMockHandler["pagination"], filtersHandler: ApiRestFsMockHandler["filters"], paginationPlugin: ApiRestFsMockOptions["pagination"], filtersPlugin: ApiRestFsMockOptions["filters"]): any {
            if (contentType !== MimeType[".json"]) {
                return request.body;
            }
            if (!request.body || Array.isArray(request.body) && request.body.length === 0 || typeof request.body === "object" && Reflect.ownKeys(request.body).length === 0) {
                return null;
            }
            if (Array.isArray(request.body)) {
                let newBody: any = [];
                request.body.forEach(elem => {
                    const keys = Reflect.ownKeys(elem);
                    let keysToExclude = [];
                    if (paginationHandler && paginationHandler !== "none" && (paginationHandler?.exclusive || paginationHandler?.inclusive)?.type === "body") {
                        const exclIncl = paginationHandler?.exclusive ? "exclusive" : "inclusive";
                        paginationHandler[exclIncl].root && paginationHandler[exclIncl].root in elem && keysToExclude.push(paginationHandler[exclIncl].root);
                        !paginationHandler[exclIncl].root && paginationHandler[exclIncl].limit && paginationHandler[exclIncl].limit in elem && keysToExclude.push(paginationHandler[exclIncl].limit);
                        !paginationHandler[exclIncl].root && paginationHandler[exclIncl].skip && paginationHandler[exclIncl].skip in elem && keysToExclude.push(paginationHandler[exclIncl].skip);
                        !paginationHandler[exclIncl].root && paginationHandler[exclIncl].sort && paginationHandler[exclIncl].sort in elem && keysToExclude.push(paginationHandler[exclIncl].sort);
                        !paginationHandler[exclIncl].root && paginationHandler[exclIncl].order && paginationHandler[exclIncl].order in elem && keysToExclude.push(paginationHandler[exclIncl].order);
                    }
                    if (paginationPlugin && (paginationPlugin[request.method! as keyof typeof paginationPlugin] || paginationPlugin.ALL && ["HEAD", "GET", "POST"].includes(request.method!))) {
                        const pag = request.method && request.method in paginationPlugin ? paginationPlugin[request.method as keyof typeof paginationPlugin] : paginationPlugin.ALL;
                        if (pag.type === "body") {
                            pag.root && pag.root in elem && keysToExclude.push(pag.root);
                            !pag.root && pag.limit && pag.limit in elem && keysToExclude.push(pag.limit);
                            !pag.root && pag.skip && pag.skip in elem && keysToExclude.push(pag.skip);
                            !pag.root && pag.sort && pag.sort in elem && keysToExclude.push(pag.sort);
                            !pag.root && pag.order && pag.order in elem && keysToExclude.push(pag.order);
                        }
                    }
                    if (filtersHandler && filtersHandler !== "none" && (filtersHandler?.exclusive || filtersHandler.inclusive).filters.length > 0) {
						const filters = (filtersHandler.inclusive || filtersHandler.exclusive);
						filters.filters.forEach(filter => {
                            if (filters.type === "body") {
                                filters.root && filters.root in elem && keysToExclude.push(filters.root);
                                !filters.root && filter.key && filter.key in elem && keysToExclude.push(filter.key);
                            }
                        })
                    }
                    if (filtersPlugin && (filtersPlugin[request.method! as keyof typeof filtersPlugin] || filtersPlugin.ALL && ["HEAD", "GET", "POST"].includes(request.method!)).filters.length > 0) {
						const filters = (filtersPlugin[request.method! as keyof typeof filtersPlugin] || filtersPlugin.ALL);
						filters.filters.forEach(filter => {
                            if (filters.type === "body") {
                                filters.root && filters.root in elem && keysToExclude.push(filters.root);
                                !filters.root && filter.key && filter.key in elem && keysToExclude.push(filter.key);
                            }
                        })
                    }
                    let newElem = {};
                    for (const key of keys) {
                        !keysToExclude.includes(key as string) && Reflect.set(newElem, key, Reflect.get(elem, key));
                    }
                    Reflect.ownKeys(newElem).length > 0 && newBody.push(newElem);
                });
                newBody.length === 0 && (newBody = null);
                return newBody;
            }
            if (typeof request.body === "object") {
                let newBody: any = {};
                const keys = Reflect.ownKeys(request.body);
                let keysToExclude = [];
                if (paginationHandler && paginationHandler !== "none" && (paginationHandler?.exclusive || paginationHandler?.inclusive)?.type === "body") {
                    const exclIncl = paginationHandler?.exclusive ? "exclusive" : "inclusive";
                    paginationHandler[exclIncl].root && paginationHandler[exclIncl].root in request.body && keysToExclude.push(paginationHandler[exclIncl].root);
                    !paginationHandler[exclIncl].root && paginationHandler[exclIncl].limit && paginationHandler[exclIncl].limit in request.body && keysToExclude.push(paginationHandler[exclIncl].limit);
                    !paginationHandler[exclIncl].root && paginationHandler[exclIncl].skip && paginationHandler[exclIncl].skip in request.body && keysToExclude.push(paginationHandler[exclIncl].skip);
                    !paginationHandler[exclIncl].root && paginationHandler[exclIncl].sort && paginationHandler[exclIncl].sort in request.body && keysToExclude.push(paginationHandler[exclIncl].sort);
                    !paginationHandler[exclIncl].root && paginationHandler[exclIncl].order && paginationHandler[exclIncl].order in request.body && keysToExclude.push(paginationHandler[exclIncl].order);
                }
                if (paginationPlugin && (paginationPlugin[request.method! as keyof typeof paginationPlugin] || paginationPlugin.ALL && ["HEAD", "GET", "POST"].includes(request.method!))) {
                    const pag = request.method && request.method in paginationPlugin ? paginationPlugin[request.method as keyof typeof paginationPlugin] : paginationPlugin.ALL;
                    if (pag.type === "body") {
                        pag.root && pag.root in request.body && keysToExclude.push(pag.root);
                        !pag.root && pag.limit && pag.limit in request.body && keysToExclude.push(pag.limit);
                        !pag.root && pag.skip && pag.skip in request.body && keysToExclude.push(pag.skip);
                        !pag.root && pag.sort && pag.sort in request.body && keysToExclude.push(pag.sort);
                        !pag.root && pag.order && pag.order in request.body && keysToExclude.push(pag.order);
                    }
                }
                if (filtersHandler && filtersHandler !== "none" && (filtersHandler?.exclusive || filtersHandler.inclusive).filters.length > 0) {
					const filters = (filtersHandler.inclusive || filtersHandler.exclusive);
					filters.filters.forEach(filter => {
                        if (filters.type === "body") {
                            filters.root && filters.root in request.body && keysToExclude.push(filters.root);
                            !filters.root && filter.key && filter.key in request.body && keysToExclude.push(filter.key);
                        }
                    })
                }
                if (filtersPlugin && (filtersPlugin[request.method! as keyof typeof filtersPlugin] || filtersPlugin.ALL && ["HEAD", "GET", "POST"].includes(request.method!)).filters.length > 0) {
					const filters = (filtersPlugin[request.method! as keyof typeof filtersPlugin] || filtersPlugin.ALL);
					filters.filters.forEach(filter => {
                        if (filters.type === "body") {
                            filters.root && filters.root in request.body && keysToExclude.push(filters.root);
                            !filters.root && filter.key && filter.key in request.body && keysToExclude.push(filter.key);
                        }
                    })
                }
                for (const key of keys) {
                    !keysToExclude.includes(key as string) && Reflect.set(newBody, key, Reflect.get(request.body, key));
                }
                Reflect.ownKeys(newBody).length === 0 && (newBody = null);
                return newBody;
            }
            return request.body;
		},
		getBodyOtherData(originalBody: any, bodyClean: any, contentType: string) {
			if (contentType !== MimeType[".json"]) {
				return originalBody;
			}
			if (!originalBody || Array.isArray(originalBody) && originalBody.length === 0 || typeof originalBody === "object" && Reflect.ownKeys(originalBody).length === 0) {
				return null;
			}
			const cleanBodyKeys = Reflect.ownKeys(bodyClean);
			const originalBodyKeys = Reflect.ownKeys(originalBody);
			let otherDataBody = {};
			originalBodyKeys.forEach(key => {
				!cleanBodyKeys.includes(key) && Reflect.set(otherDataBody, key, Reflect.get(originalBody, key));
			})
			return otherDataBody;
		},
		isBodyJson(body: any): boolean {
			if (typeof body === "string") {
				try {
					JSON.parse(body);
					return true;
				} catch (error) {
					return false;
				}
			}
			return [null, undefined].includes(body) || typeof body === 'object' && !Array.isArray(body);
		}
    },
	response: {
		async sendStreamFile(res: ServerResponse, filePath: PathLike) {
			const { promise, reject, resolve } = Promise.withResolvers<void>();
			const { size } = statSync(filePath);
			const stream = createReadStream(filePath);
			stream.on('error', reject);
			res.on('error', reject);
			res.on('finish', resolve);
			res.setHeader("content-length", size);
			stream.pipe(res);
			return promise;
		},
        async settingResponse(logger: Logger, res: ServerResponse, data: ApiRestFsMockDataResponse) {
			logger.debug(`settingResponse: START`);
			try {
				let responseData = data;
				if (res.writableEnded) {
					return;
				}

				if (!responseData.isError && typeof responseData.data !== "string") {
					try {
						responseData.data = [null, undefined].includes(responseData.data) ? "" : JSON.stringify(responseData.data);
					} catch (error) {
						logger.error(`settingResponse: ERROR - failed to parse body response.`, (error as Error).message);
						responseData = {
							...responseData,
							status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
							data: "Error parsing body response",
							isError: true,
							error: new ApiRestFsMockError(error as Error, "ERROR", responseData.error?.getPath() ?? "", Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR),
						}
					}
				}

				if (responseData.isError && responseData.errorMiddlewares && Array.isArray(responseData.errorMiddlewares) && responseData.errorMiddlewares.length > 0) {
					logger.debug(`settingResponse: errorMiddlewares founded.`);
					const chain = Utils.requests.MiddlewaresChain();
					try {
						await chain.handleError(responseData.req as ApiRestFsMockRequest, res, responseData.error, responseData.errorMiddlewares);
						if (!res.writableEnded) {
							logger.debug(`settingResponse: errorMiddlewares not sending response.`);
							responseData = {
								status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
								data: (!!responseData.data ? { message: responseData.data } : responseData.error as Error).message ?? "Internal Server Error",
								isError: true,
								readFile: false,
								error: responseData.error,
								headers: responseData.headers
							};
						} else {
							return;
						}
					} catch (error) {
						logger.error(`settingResponse: ERROR - failed to evalute errorMiddlewares.`, (error as Error).message);
						responseData = {
							status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
							data: `Failed to evalute errorMiddlewares. Original error: ${(!!responseData.data ? { message: responseData.data } : responseData.error as Error).message ?? "Internal Server Error"}`,
							isError: true,
							readFile: false,
							error: responseData.error,
							headers: responseData.headers
						};
					}
				}

				if (responseData.readFile && !responseData.isError) {
					try {
						res.statusCode = responseData.status;
						responseData.headers.forEach(({ name, value }) => {
							res.setHeader(name, value);
						});
						if (responseData.req?.method === "HEAD") {
							const { size } = statSync(responseData.data);
							const { ext } = parsePath(responseData.data);
							res.setHeader("content-type", ext in MimeType ? MimeType[ext as keyof typeof MimeType] : MimeType[".bin"]);
							res.setHeader("content-length", size);
						} else {
							await this.sendStreamFile(res, responseData.data);
						}
					} catch (error) {
						logger.error(`settingResponse: ERROR - failed to send stream data.`, (error as Error).message);
						responseData.headers.forEach(({ name }) => {
							res.removeHeader(name);
						});
						responseData = {
							status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
							data: `Failed to send stream data`,
							isError: true,
							readFile: false,
							error: responseData.error,
							headers: responseData.headers
						};
					}
				}

				function callbackErrorWritingResponse(error: Error | null | undefined) {
					if (error instanceof Error) {
						logger.debug(`settingResponse: ERROR - failed to write response `, error.message);
						res.statusCode = Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;
						res.write(JSON.stringify({
							status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
							error: Object.entries(Constants.HTTP_STATUS_CODE).find(el => el[1] === responseData.status)?.[0] ?? "Internal Server Error",
							messsage: "Error writing response",
							path: "",
							timestamp: new Date().toISOString()
						}));
					}
					res.end();
				}

				res.statusCode = responseData.status;
				if (responseData.isError) {
					res.setHeader("Content-Type", MimeType[".json"]);
					res.write(
						JSON.stringify({
							status: responseData.status,
							error: Object.entries(Constants.HTTP_STATUS_CODE).find(el => el[1] === responseData.status)?.[0] ?? "Internal Server Error",
							messsage: responseData.data ?? responseData.error?.message ?? "",
							path: responseData.error?.getPath() ?? "",
							timestamp: new Date().toISOString()
						}),
						callbackErrorWritingResponse
					);
				} else {
					responseData.headers.forEach(({ name, value }) => {
						res.setHeader(name, value);
					});
					res.write(
						responseData.data,
						callbackErrorWritingResponse
					);
				}
				!res.writableEnded && res.end();
			} finally {
				logger.debug(`settingResponse: END`);
			}
        }
    }
}
