export const Constants = {
	PLUGIN_NAME: "vite-plugin-rest-fs-api",
    TOTAL_ELEMENTS_HEADER: "X-Total-Count",
    HTTP_STATUS_CODE: {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        METHOD_NOT_ALLOWED: 405,
        CONFLICT: 409,
		INTERNAL_SERVER_ERROR: 500,
		GATEWAY_TIMEOUT: 504
    }
}
