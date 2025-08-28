import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
		testTimeout: 0,
		fileParallelism: false,
		retry: 1,
		coverage: {
			provider: "v8",
			reporter: ["text", "json"],
			include: [
				"src/index.ts",
				"src/utils/utils.ts",
				"src/utils/plugin.ts",
			],
			all: true,
			reportsDirectory: 'coverage'
		}
	},
})
