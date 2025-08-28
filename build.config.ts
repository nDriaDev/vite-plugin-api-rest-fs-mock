import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
    name: "vite-plugin-rest-fs-api",
    entries: ['src/index'],
    externals: ['vite'],
    clean: true,
    declaration: true,
    rollup: {
        emitCJS: true,
        inlineDependencies: true,
        esbuild: {
            minify: true,
            minifyWhitespace: true,
            minifySyntax: true,
            minifyIdentifiers: true,
            treeShaking: true,
            ignoreAnnotations: true,
            legalComments: "none"
        }
    },
})
