import { Connect, Plugin } from "vite";
import { ApiRestFsMockOptions, ApiRestFsMockOptionsRequired } from "./models/index.model";
import { Logger } from "./utils/Logger";
import { Constants } from "./utils/constants";
import { Utils } from "./utils/utils";
import { IncomingMessage, ServerResponse } from "node:http";
import { runPlugin } from "./utils/plugin";

function plugin(opts?: ApiRestFsMockOptions): Plugin {
	let options: ApiRestFsMockOptionsRequired,
		logger: Logger;
	return {
		name: Constants.PLUGIN_NAME,
		apply: "serve",
		async configResolved(conf) {
			options = Utils.plugin.initOptions(opts, conf);
			logger = new Logger(Constants.PLUGIN_NAME, options.logLevel);
			logger.debug("Vite configResolved: START");
			logger.info(`plugin initializing ...`);
			if (!options.fsDir || !(await Utils.files.isDirExists(options.fullFsDir!))) {
				options.fullFsDir = null;
				logger.info(`Directory with path ${options.fsDir} doesn't exist.`);
			}
			if (options.endpointPrefix.length === 0) {
				logger.warn(`Endpoint prefix empty or invalid.`);
				options.disable = true;
			}

			logger.info(`plugin ${options.disable ? "disabled" : "started"}`);
			logger.debug("Vite configResolved: FINISH");
		},
		configureServer(server) {
			if (options.disable) {
				return;
			}
			logger.debug("Vite configureServer: START", `options= ${JSON.stringify({ ...options, config: "", matcher: "" }, null, 2)}`);
			server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
				runPlugin(req, res, next, logger, options);
			})
			logger.debug("Vite configureServer: FINISH");
		},
		configurePreviewServer(server) {
			if (options.disable) {
				return;
			}
			logger.debug("Vite configurePreviewServer: START", `options= ${JSON.stringify({ ...options, config: "", matcher: "" }, null, 2)}`);
			server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
				runPlugin(req, res, next, logger, options);
			})
			logger.debug("Vite configurePreviewServer: FINISH");
		}
	}
}

export default plugin;
