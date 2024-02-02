import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import fs from 'node:fs';

// import eslint from 'esbuild-plugin-eslint';

import browserslist from 'browserslist';
import {
    esbuildPluginBrowserslist,
    resolveToEsbuildTarget,
} from 'esbuild-plugin-browserslist';

let result = await esbuild.build({
    entryPoints: [
        { out: 'index', in: 'index.js'},
    ],
    bundle: true,
    minify: true,
    sourcemap: true,
    metafile: true,
    format: 'esm',
    splitting: true,
    globalName: 'electoralareas',
    outdir: 'static',
    plugins: [
        sassPlugin({
            async transform(source) {
                const { css } = await postcss([autoprefixer]).process(source, { from: undefined });
                return css;
            },
        }),
        esbuildPluginBrowserslist(browserslist('>0.2%, not dead, not op_mini all, not chrome < 51, not safari < 10, not android < 5, not ie < 12'), {
            printUnknownTargets: false,
        }),
    ],
});
// console.log(await esbuild.analyzeMetafile(result.metafile));
fs.writeFileSync('static/meta.json', JSON.stringify(result.metafile));
