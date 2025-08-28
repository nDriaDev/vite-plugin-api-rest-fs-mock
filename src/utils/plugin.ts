import { IncomingMessage, ServerResponse } from "node:http";
import { Connect } from "vite";
import { Logger } from "./Logger";
import { ApiRestFsMockDataResponse, ApiRestFsMockHandler, ApiRestFsMockOptionsRequired, ApiRestFsMockRequest, HandledRequestData } from "src/models/index.model";
import { Utils } from "./utils";
import { join, parse } from "node:path";
import { MimeType } from "./MimeType";
import { Constants } from "./constants";
import { AntPathMatcher } from "./AntPathMatcher";
import { ApiRestFsMockError } from "./Errors";

/**
 * @ignore
 * Not used for now. It simulates the options http request behavior
 */
function handlingOptionsRequest(logger: Logger, matcher: AntPathMatcher, fullUrl: URL, request: ApiRestFsMockRequest, handlers: ApiRestFsMockHandler[], endpointNoPrefix: string, result: HandledRequestData): boolean {
	logger.debug("handlingOptionsRequest: START");
	try {
		if (request.method !== "OPTIONS") {
			return false;
		}
		let allow: Set<string> = new Set<string>();
		for (const handle of handlers) {
			const handlerMatched = matcher.doMatch(
				Utils.requests.addSlash(handle.pattern, "leading"),
				Utils.requests.addSlash(endpointNoPrefix, "leading"),
				true,
				request.params
			);
			if (handlerMatched) {
				if (request.method === handle.method) {
					return false;
				} else {
					allow.add(request.method!);
				}
			}
		}
		if (allow.size > 0) {
			result.status = Constants.HTTP_STATUS_CODE.OK;
			result.data = null;
			result.headers.push({
				name: "Allow",
				value: [...allow].join(", ")
			});
			const hasCors = !!request.headers["access-control-request-methods"] || !!request.headers["access-control-request-headers"];
			if (hasCors) {
				result.headers.push({
					name: "Access-Control-Allow-Methods",
					value: [...allow].join(", ")
				});
			}
			return true;
		}
		throw new ApiRestFsMockError("Request with OPTIONS method doesn't match endpointPrefix.", "NO_HANDLER", fullUrl.pathname);
	} finally {
		logger.debug("handlingOptionsRequest: END");
	}
}

async function handlingApiFsRequest(logger: Logger, fullUrl: URL, request: ApiRestFsMockRequest, res: ServerResponse, paginationPlugin: ApiRestFsMockOptionsRequired["pagination"], filtersPlugin: ApiRestFsMockOptionsRequired["filters"], parser: ApiRestFsMockOptionsRequired["parser"], handler: ApiRestFsMockHandler | null, endpointPrefix: string[], fullFsDir: string | null, result: HandledRequestData): Promise<boolean> {
	logger.debug("handlingApiFsRequest: START");
	try {
		const IS_API_REST_FS = handler !== null && handler.handle === "FS",
			paginationHandler = handler !== null ? handler.pagination : "none",
			filtersHandler = handler !== null ? handler.filters : "none",
			postHandleHandler = handler !== null ? handler.postHandle : undefined;
		if (fullFsDir === null) {
			if (IS_API_REST_FS) {
				throw new ApiRestFsMockError("Request matching Api Rest Fs handler but fsDir provide doesn't exists.", "ERROR", fullUrl.pathname);
			} else {
				return false;
			}
		}
		handler === null && logger.info("Request handling with FS API");
		const dataFile: { originalData: any, data: any, mimeType: string, total: number } = {
			total: 0,
			data: null,
			originalData: null,
			mimeType: MimeType[".bin"]
		}
		let url = request.url ?? "";
		if (IS_API_REST_FS && handler.preHandle) {
			let pathname = fullUrl.pathname;
			if (Array.isArray(handler.preHandle.transform)) {
				handler.preHandle.transform.forEach(({ searchValue, replaceValue }) => {
					pathname = pathname.replace(searchValue, replaceValue);
				});
			} else {
				pathname = handler.preHandle.transform(pathname);
			}
			fullUrl.pathname = pathname;
			url = fullUrl.pathname + fullUrl.search;
		}

		const endpointNoPrefix = Utils.requests.removeSlash(Utils.requests.removeEndpointPrefix(url, endpointPrefix), "trailing");
		const filePath = join(fullFsDir, endpointNoPrefix);
		let file: string = filePath,
			fileFound;
		if (await Utils.files.isFileExists(filePath)) {
			file = filePath;
			fileFound = true;
		} else if (await Utils.files.isDirExists(filePath)) {
			const files: string[] = await Utils.files.directoryFileList(filePath);
			const fileIndex = files.find(el => el.startsWith("index.json")) ?? null;
			if (fileIndex) {
				fileFound = true;
				file = join(filePath, fileIndex)
			} else {
				fileFound = false;
			}
		} else {
			const pathBeforeLastSegment = join(filePath, "..");
			const lastSegmentPath = Utils.requests.removeSlash(filePath.substring(pathBeforeLastSegment.length), "both");
			if (lastSegmentPath !== "" && await Utils.files.isDirExists(pathBeforeLastSegment)) {
				const files: string[] = await Utils.files.directoryFileList(filePath);
				const fileExt = files.find(f => f.startsWith(lastSegmentPath)) ?? null;
				if (fileExt) {
					file = join(pathBeforeLastSegment, fileExt);
					fileFound = true;
				} else {
					fileFound = false;
				}
			} else {
				fileFound = false;
			}
		}
		if (fileFound) {
			const { ext } = parse(file);
			dataFile.mimeType = ext in MimeType ? MimeType[ext as keyof typeof MimeType] : MimeType[".bin"];
			try {
				dataFile.data = dataFile.mimeType === MimeType[".json"]
					? await Utils.files.readingStreamFile(file)
					: null;
				dataFile.total = 1;
			} catch (error: any) {
				logger.error("handlingApiFsRequest: Error reading file ", file, error);
				throw new ApiRestFsMockError(`Error reading file ${file}`, "ERROR", fullUrl.pathname);
			}
		}
		dataFile.originalData = dataFile.data;

		if (IS_API_REST_FS && !!postHandleHandler) {
			logger.debug("handlingApiFsRequest: applying postHandle");
			await postHandleHandler(
				request,
				res,
				fileFound
					? dataFile.originalData === null
						? await Utils.files.readingFile(file)
						: dataFile.originalData
					: null
			);
			throw new ApiRestFsMockError("FS REST", "MANUALLY_HANDLED", fullUrl.pathname);
		}

		switch (request.method!) {
			case "HEAD":
			case "GET":
				if (fileFound) {
					result.status = Constants.HTTP_STATUS_CODE.OK;
					result.headers = [
						...result.headers,
						{ name: "content-type", value: dataFile.mimeType },
						{ name: Constants.TOTAL_ELEMENTS_HEADER, value: dataFile.total }
					];
					if (dataFile.data && dataFile.mimeType === MimeType[".json"]) {
						if (Utils.requests.hasPaginationOrFilters(request.method, paginationPlugin, filtersPlugin, paginationHandler, filtersHandler)) {
							if (!IS_API_REST_FS) {
								logger.debug("handlingApiFsRequest: parsing request");
								await Utils.requests.parseRequest(request, res, fullUrl, parser);
							}
							try {
								logger.debug("handlingApiFsRequest: applying pagination and filters");
								Utils.requests.applyPaginationAndFilters(request, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin, dataFile);
							} catch (error: any) {
								logger.debug("handlingApiFsRequest: ERROR parsing json content file ", file!, error.toString());
								throw new ApiRestFsMockError(`Error parsing json content file ${file}`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
							}
						}
						request.method === "GET" && (result.data = dataFile.data);
						result.headers.push(
							{ name: "content-length", value: Utils.files.getByteLength(dataFile.data) },
						);
					} else {
						throw new ApiRestFsMockError(
							file,
							"READ_FILE",
							fullUrl.pathname,
							undefined,
							{
								headers: result.headers,
								requ: request
							}
						);
					}
				} else {
					throw new ApiRestFsMockError("Not found", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.NOT_FOUND);
				}
				break;
			case "POST":
				if (!IS_API_REST_FS) {
					logger.debug("handlingApiFsRequest: parsing request");
					await Utils.requests.parseRequest(request, res, fullUrl, parser);
				}
				if (fileFound) {
					result.status = Constants.HTTP_STATUS_CODE.OK;
					let writeFile, mimeType;
					if (dataFile.data && dataFile.mimeType === MimeType[".json"]) {
						try {
							if (Utils.requests.hasPaginationOrFilters(request.method, paginationPlugin, filtersPlugin, paginationHandler, filtersHandler)) {
								try {
									logger.debug("handlingApiFsRequest: applying pagination and filters");
									Utils.requests.applyPaginationAndFilters(request, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin, dataFile);
								} catch (error: any) {
									logger.debug("handlingApiFsRequest: ERROR parsing json content file ", file!, error.toString());
									throw new ApiRestFsMockError(`Error parsing json content file ${file}`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
								}
							}
							const bodyClean = Utils.requests.getCleanBody(Utils.requests.isBodyJson(request.body) ? MimeType[".json"] : MimeType[".bin"], request.body, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin);
							if (bodyClean !== null) {
								writeFile = !Utils.files.isDeepEqual(dataFile.originalData, dataFile.data) && Array.isArray(dataFile.originalData)
									? dataFile.originalData.map(data => {
										if (Utils.files.isDeepEqual(data, dataFile.data)) {
											return bodyClean;
										}
										return data;
									})
									: bodyClean;
							} else {
								writeFile = -1;
								result.data = dataFile.data;
								result.headers.push(
									...result.headers,
									{ name: "content-type", value: dataFile.mimeType },
									{ name: "content-length", value: Utils.files.getByteLength(dataFile.data) },
									{ name: Constants.TOTAL_ELEMENTS_HEADER, value: dataFile.total }
								);
							}
						} catch (error: any) {
							logger.error("handlingApiFsRequest: Error detecting data to write with POST method", error);
							throw new ApiRestFsMockError("Error updating data", "ERROR", fullUrl.pathname);
						}
					} else if (request.files !== null && request.files.length > 0) {
						writeFile = request.files[0].content;
						mimeType = request.files[0].contentType as MimeType;
					} else {
						throw new ApiRestFsMockError(
							file,
							"READ_FILE",
							fullUrl.pathname,
							undefined,
							{
								headers: result.headers
							}
						);
					}
					if (writeFile !== -1) {
						//INFO if writeFile is -1 when bodyClean is null and read file have to be sent
						try {
							await Utils.files.writingFile(file, fileFound, writeFile, mimeType as MimeType, true);
						} catch (error: any) {
							if (error instanceof ApiRestFsMockError) {
								throw error;
							}
							logger.error("handlingApiFsRequest: Error writing file with POST method", error);
							throw new ApiRestFsMockError("Error writing data", "ERROR", fullUrl.pathname);
						}
					}
				} else {
					result.status = Constants.HTTP_STATUS_CODE.CREATED;
					let writeFile, mimeType;
					const bodyClean = Utils.requests.getCleanBody(Utils.requests.isBodyJson(request.body) ? MimeType[".json"] : MimeType[".bin"], request.body, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin);
					if (bodyClean !== null) {
						writeFile = bodyClean;
						mimeType = Utils.requests.isBodyJson(bodyClean) ? MimeType[".json"] : request.headers["content-type"];
					} else if (request.files !== null && request.files.length > 0) {
						writeFile = request.files[0].content;
						mimeType = request.files[0].contentType as MimeType;
					} else {
						throw new ApiRestFsMockError("File not found", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.NOT_FOUND);
					}
					try {
						await Utils.files.writingFile(file, fileFound, writeFile, mimeType as MimeType, true);
					} catch (error: any) {
						logger.error("handlingApiFsRequest: Error writing file with POST method", error);
						throw new ApiRestFsMockError("Error writing data", "ERROR", fullUrl.pathname);
					}
				}
				break;
			case "PUT":
				if (!IS_API_REST_FS) {
					logger.debug("handlingApiFsRequest: parsing request");
					await Utils.requests.parseRequest(request, res, fullUrl, parser);
				}
				result.status = Constants.HTTP_STATUS_CODE[fileFound ? "OK" : "CREATED"];
				let writeFile, mimeType;
				if (request.body !== null) {
					writeFile = request.body
					mimeType = Utils.requests.isBodyJson(request.body) ? MimeType[".json"] : request.headers["content-type"] as MimeType;
				} else if (request.files !== null && request.files.length > 0) {
					writeFile = request.files[0].content;
					mimeType = request.files[0].contentType as MimeType;
				} else {
					throw new ApiRestFsMockError("No data provided", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
				}
				try {
					await Utils.files.writingFile(file, fileFound, writeFile, mimeType as MimeType, true);
				} catch (error: any) {
					logger.error(`handlingApiFsRequest: Error ${fileFound ? "updating" : "creating"} file with PUT method`, error);
					throw new ApiRestFsMockError(`Error ${fileFound ? "updating" : "creating"} data`, "ERROR", fullUrl.pathname);
				}
				break;
			case "PATCH":
				if (!IS_API_REST_FS) {
					logger.debug("handlingApiFsRequest: parsing request");
					await Utils.requests.parseRequest(request, res, fullUrl, parser);
				}
				if (!fileFound) {
					throw new ApiRestFsMockError("Resource to update not found", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.NOT_FOUND);
				}
				const bodyClean = Utils.requests.getCleanBody(Utils.requests.isBodyJson(request.body) ? MimeType[".json"] : MimeType[".bin"], request.body, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin);
				if (bodyClean === null || dataFile.mimeType !== MimeType[".json"]) {
					throw new ApiRestFsMockError(bodyClean === null ? "No data provided." : `Only json file can be processing with PATCH http method.`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
				}
				try {
					if (Utils.requests.hasPaginationOrFilters(request.method, paginationPlugin, filtersPlugin, paginationHandler, filtersHandler)) {
						try {
							logger.debug("handlingApiFsRequest: applying pagination and filters");
							Utils.requests.applyPaginationAndFilters(request, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin, dataFile);
						} catch (error: any) {
							logger.debug("handlingApiFsRequest: ERROR parsing json content file ", file!, error.toString());
							throw new ApiRestFsMockError(`Error parsing json content file ${file}`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
						}
					}
					let newData;
					if (Array.isArray(dataFile.data)) {
						newData = [...dataFile.data, ...bodyClean];
					} else {
						newData = { ...dataFile.data, ...bodyClean };
					}
					await Utils.files.writingFile(file, fileFound, newData, dataFile.mimeType, true);
					result.status = Constants.HTTP_STATUS_CODE.OK;
				} catch (error: any) {
					logger.error(`handlingApiFsRequest: Error partial updating file with PATCH method`, error);
					throw new ApiRestFsMockError("Error partial updating resource", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
				}
				break;
			case "OPTIONS":
				throw new ApiRestFsMockError("Method not allowed", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.METHOD_NOT_ALLOWED);
			case "DELETE":
				if (!fileFound) {
					throw new ApiRestFsMockError("Resource to delete not found", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.NOT_FOUND);
				}
				if (!IS_API_REST_FS) {
					logger.debug("handlingApiFsRequest: parsing request");
					await Utils.requests.parseRequest(request, res, fullUrl, parser);
				}
				try {
					if (dataFile.mimeType === MimeType[".json"] && Utils.requests.hasPaginationOrFilters(request.method, paginationPlugin, filtersPlugin, paginationHandler, filtersHandler)) {
						try {
							logger.debug("handlingApiFsRequest: applying pagination and filters");
							Utils.requests.applyPaginationAndFilters(request, paginationHandler, filtersHandler, paginationPlugin, filtersPlugin, dataFile);
						} catch (error: any) {
							logger.debug("handlingApiFsRequest: ERROR parsing json content file ", file!, error.toString());
							throw new ApiRestFsMockError(`Error parsing json content file ${file}`, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
						}
					}
					if (dataFile.mimeType !== MimeType[".json"] || dataFile.data && dataFile.mimeType === MimeType[".json"] && Utils.files.isDeepEqual(dataFile.originalData, dataFile.data)) {
						await Utils.files.removeFile(file);
					} else {
						let newData;
						if (Array.isArray(dataFile.originalData)) {
							newData = dataFile.originalData.filter(el => !(dataFile.data as Array<any>).includes(el));
						} else {
							const keyFiltered = Reflect.ownKeys(dataFile.data);
							const keyOrig = Reflect.ownKeys(dataFile.originalData).filter(key => !keyFiltered.includes(key));
							newData = {};
							for (const key of keyOrig) {
								Reflect.set(newData, key, Reflect.get(dataFile.originalData, key));
							}
						}
						await Utils.files.writingFile(file, fileFound, newData, MimeType[".json"], true);
					}
				} catch (error) {
					throw new ApiRestFsMockError("Error deleting resource", "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.BAD_REQUEST);
				}
				break;
			default:
				return false;
		}
		return true;
	} catch (error: any) {
		if (error instanceof ApiRestFsMockError) {
			throw error;
		}
		logger.debug("handlingApiFsRequest: ERROR - ", error);
		throw new ApiRestFsMockError(error, "ERROR", fullUrl.pathname);
	} finally {
		logger.debug("handlingApiFsRequest: END");
	}
}

async function handlingApiRestRequest(logger: Logger, matcher: AntPathMatcher, fullUrl: URL, request: ApiRestFsMockRequest, res: ServerResponse, handlers: ApiRestFsMockOptionsRequired["handlers"], middlewares: ApiRestFsMockOptionsRequired["middlewares"], errorMiddlewares: ApiRestFsMockOptionsRequired["errorMiddlewares"], delay: ApiRestFsMockOptionsRequired["delay"], pagination: ApiRestFsMockOptionsRequired["pagination"], filters: ApiRestFsMockOptionsRequired["filters"], parser: ApiRestFsMockOptionsRequired["parser"], endpointPrefix: string[], endpointNoPrefix: string, fullFsDir: string | null, result: HandledRequestData): Promise<boolean> {
	logger.debug("handlingApiRestRequest: START");
	try {
		let handler: typeof handlers[number] | null = null;
		for (const handle of handlers) {
			const handlerMatched = matcher.doMatch(
				Utils.requests.addSlash(handle.pattern, "leading"),
				Utils.requests.addSlash(endpointNoPrefix, "leading"),
				true,
				request.params
			);
			if (handlerMatched) {
				if (handle.disabled) {
					logger.debug("handlingApiRestRequest: Request handler is disabled");
				} else if (request.method !== handle.method) {
					logger.debug("handlingApiRestRequest: Request url and handler have different http method");
				} else {
					handler = handle;
					break;
				}
			}
		}
		if (handler !== null) {
			logger.debug("handlingApiRestRequest: using REST api");
			logger.info("Request handling with REST API: handler matched= ", handler.pattern);
			const chain = Utils.requests.MiddlewaresChain();
			try {
				chain.use(middlewares, errorMiddlewares);
				logger.debug("handlingApiRestRequest: applying middleware chain");
				await chain.handle(request, res);

				logger.debug("handlingApiRestRequest: parsing request");
				await Utils.requests.parseRequest(request, res, fullUrl, handler.parser !== undefined ? handler.parser : parser);

				if (handler.delay || delay) {
					const delayHandler = handler.delay || delay;
					logger.debug("handlingApiRestRequest: request execution will be delayed by ", delayHandler.toString());
					await new Promise(res => setTimeout(res, delayHandler));
				}

				if (handler.handle === "FS") {
					logger.debug("handlingApiRestRequest: API FS REST handler");
					return await handlingApiFsRequest(logger, fullUrl, request, res, pagination, filters, parser, handler, endpointPrefix, fullFsDir, result);
				}
				logger.debug("handlingApiRestRequest: API REST handler");
				await handler.handle(request, res);
				throw new ApiRestFsMockError("REST", "MANUALLY_HANDLED", fullUrl.pathname);
			} catch (error) {
				if (error instanceof ApiRestFsMockError) {
					throw error;
				}
				logger.debug("handlingApiRestRequest: ERROR applying middleware chain");
				throw new ApiRestFsMockError(error as Error, "ERROR", fullUrl.pathname);
			}
		}
		return false;
	} catch (error: any) {
		if (error instanceof ApiRestFsMockError) {
			throw error;
		}
		logger.debug("handlingApiRestRequest: ERROR - ", error);
		throw new ApiRestFsMockError(error, "ERROR", fullUrl.pathname);
	} finally {
		logger.debug("handlingApiRestRequest: END");
	}
}

export const runPlugin = async (req: IncomingMessage, response: ServerResponse, next: Connect.NextFunction, logger: Logger, options: ApiRestFsMockOptionsRequired) => {
	logger.debug(`runPlugin: START`);
	const { gatewayTimeout, errorMiddlewares, noHandledRequestsAction } = options;
	const { promise, reject, resolve } = Promise.withResolvers<ApiRestFsMockDataResponse>();
	let gatewayIdTimeout: NodeJS.Timeout;

	if (gatewayTimeout !== 0) {
		gatewayIdTimeout = setTimeout(() => {
			resolve({
				status: Constants.HTTP_STATUS_CODE.GATEWAY_TIMEOUT,
				readFile: false,
				isError: true,
				data: "Gateway Timeout",
				headers: [],
				req,
				errorMiddlewares
			});
		}, gatewayTimeout);
	}

	runPluginInternal(req, response, logger, options)
		.then(result => {
			clearTimeout(gatewayIdTimeout);
			const { status, data, headers } = result;
			resolve({
				status: status!,
				data,
				readFile: false,
				isError: false,
				headers
			});
		})
		.catch(async (error: ApiRestFsMockError) => {
			clearTimeout(gatewayIdTimeout);
			const dataResponse: ApiRestFsMockDataResponse = {
				status: Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
				data: error.message,
				isError: true,
				readFile: false,
				headers: [],
				error,
				req: error.getExtra()?.requ ?? req,
				errorMiddlewares: errorMiddlewares
			};
			switch (error.getType()) {
				case "TIMEOUT":
					dataResponse.status = Constants.HTTP_STATUS_CODE.GATEWAY_TIMEOUT;
					dataResponse.data = dataResponse.data ?? "Internal Server Error";
					resolve(dataResponse);
					break;
				case "NO_HANDLER":
					if (noHandledRequestsAction === "forward") {
						reject("next");
					} else {
						dataResponse.status = Constants.HTTP_STATUS_CODE.NOT_FOUND;
						dataResponse.data = dataResponse.data ?? "Not Found";
						resolve(dataResponse);
					}
					break;
				case "MANUALLY_HANDLED":
					dataResponse.data = `${error.message} Handle request not send any response`;
					resolve(dataResponse);
					break;
				case "ERROR":
					dataResponse.status = error.getCode();
					resolve(dataResponse);
					break;
				case "READ_FILE":
					dataResponse.status = Constants.HTTP_STATUS_CODE.OK;
					dataResponse.isError = false;
					dataResponse.readFile = true;
					dataResponse.headers = error.getExtra()?.headers ?? [];
					dataResponse.error = undefined;
					dataResponse.errorMiddlewares = undefined;
				default:
					dataResponse.status = Constants.HTTP_STATUS_CODE.GATEWAY_TIMEOUT;
					dataResponse.data = dataResponse.data ?? "Internal Server Error";
					resolve(dataResponse);
					break;
			}
		});

	try {
		logger.debug(`runPlugin: awaiting runInternalPlugin execution`);
		const result = await promise;
		Utils.response.settingResponse(logger, response, result);
	} catch (error) {
		logger.debug(`runPlugin: runInternalPlugin error`);
		if (error === "next") {
			next();
		} else {
			process.exitCode = -1;
			next(error);
		}
	} finally {
		logger.debug(`runPlugin: END`);
	}
}

export const runPluginInternal = async (req: IncomingMessage, res: ServerResponse, logger: Logger, options: ApiRestFsMockOptionsRequired) => {
	const { config, endpointPrefix, handlers, matcher, middlewares, errorMiddlewares, delay, fullFsDir, filters, pagination, parser } = options;
	const fullUrl = Utils.requests.buildFullUrl(req, config);
	const endpointNoPrefix = Utils.requests.removeEndpointPrefix(fullUrl.pathname, endpointPrefix);
	let requ: ApiRestFsMockRequest = req as ApiRestFsMockRequest;
	try {
		logger.debug(`runPluginInternal: START request url = ${req.url}`);

		const result: HandledRequestData = {
			status: null,
			data: null,
			headers: []
		}

		if (!Utils.requests.matchesEndpointPrefix(req.url, endpointPrefix)) {
			logger.info(`runPluginInternal: Request with url ${req.url} doesn't match endpointPrefix option.`);
			throw new ApiRestFsMockError("Request doesn't match endpointPrefix.", "NO_HANDLER", fullUrl.pathname);
		}
		const request = Utils.requests.createRequest(req);
		requ = request;

		logger.debug(`runPluginInternal: fullUrl=${endpointNoPrefix}, endpointNoPrefix=${endpointNoPrefix}`);

		let handled = await handlingApiRestRequest(logger, matcher, fullUrl, request, res, handlers, middlewares, errorMiddlewares, delay, pagination, filters, parser, endpointPrefix, endpointNoPrefix, fullFsDir, result);
		if (handled) {
			return result;
		}

		handled = await handlingApiFsRequest(logger, fullUrl, request, res, pagination, filters, parser, null, endpointPrefix, fullFsDir, result);
		if (handled) {
			return result;
		}

		throw new ApiRestFsMockError(`Impossible handling request with url ${fullUrl}`, "NO_HANDLER", fullUrl.pathname);
	} catch (error: any) {
		if (error instanceof ApiRestFsMockError) {
			throw error;
		}
		logger.error("runPluginInternal: ERROR - ", error);
		throw new ApiRestFsMockError(error, "ERROR", fullUrl.pathname, Constants.HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, { requ });
	} finally {
		logger.debug(`runPluginInternal: FINISH`);
	}
}
