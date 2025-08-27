import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
        onConsoleLog(log, type) {
            if (
                type === "stderr" &&
                (log.match(/websocket server error/i) ||
                    log.match(/error: (redirect|test)/i) ||
                    log.match(/generated an empty chunk/i))
            )
                return false;
        },
        testTimeout: 0,
        fileParallelism: false,
        retry: 1,
        coverage: {
            provider: "v8",
            reporter: ["text", "json"],
            exclude: ["**/*.{test,spec,config,model}.?(c|m)[jt]s?(x)"],
            all: true,
            reportsDirectory: 'coverage'
        }
    },
})