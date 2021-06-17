// @flow

const flowRemoveTypes = require('flow-remove-types');
const { createFilter } = require('rollup-pluginutils');
const { readFile } = require('fs');

type VitePlugin = {
  enforce: string,
  name: string | RegExp,
  transform: (string, string) => (void | { code: string, map:string })
};

type VitePluginOptions = {
  include: string | RegExp | Array<string | RegExp>,
  exclude: string | RegExp | Array<string | RegExp>
};

type OnLoadOptions = {
  filter: RegExp,
  namespace?: string
};

type OnLoadArgs = {
  path: string,
  namespace: string,
  pluginData?: any
};

type OnLoadCallback = (OnLoadArgs) => Promise<OnLoadResult> | OnLoadResult;

type OnLoadFunc = (OnLoadOptions, OnLoadCallback) => void;

type OnLoadResult = {
  contents: string,
  loader: string
} | {
  errors: Array<Message>;
};

type Message = {
  text: string,
  location: Location | null,
  detail: Error
};

type Location = {
  file: string,
  namespace: string
};

type EsbuildPlugin = {
  name: string,
  setup: ({onLoad: OnLoadFunc}) => void
};

/**
 * Create a Vite plugin object
 * @param {Object} [options] Filter options
 * @param {string | Regexp | Array<string | Regexp>} [options.include=/\.(flow|jsx?)$/] - Strings and/or regular expressions matching file paths to include
 * @param {string | Regexp | Array<string | Regexp>} [options.exclude=/node_modules/] - Strings and/or regular expressions matching ffile paths to exclude
 * @returns {VitePlugin} Returns esbuild plugin object
 */
module.exports.flowPlugin = function (options: VitePluginOptions = { include: /\.(flow|jsx?)$/, exclude: /node_modules/ }):VitePlugin {
  const filter = createFilter(options.include, options.exclude);
  return {
    enforce: 'pre',
    name: 'flow',
    transform(src:string, id:string) { // eslint-disable-line consistent-return
      if (filter(id)) {
        const transformed = flowRemoveTypes(src);
        return {
          code: transformed.toString(),
          map: transformed.generateMap(),
        };
      }
    },
  };
};

const jsxRegex = /\.jsx$/;

const defaultloaderFunction = (path:string) => (jsxRegex.test(path) ? 'jsx' : 'js');

/**
 * Create an esbuild plugin object
 * @param {RegExp} [filter=/\.(flow|jsx?)$/] Regular expression matching the path a files to be processed ({@link https://esbuild.github.io/plugins/#resolve-callbacks|esbuild plugins documentation})
 * @param {(string) => string} [loaderFunction] Function that accepts the file path and returning the esbuild loader type
 * @returns {EsbuildPlugin} Returns esbuild plugin object
 */
module.exports.esbuildFlowPlugin = function (filter: RegExp = /\.(flow|jsx?)$/, loaderFunction: (string) => string = defaultloaderFunction):EsbuildPlugin {
  return {
    name: 'flow',
    setup(build) {
      build.onLoad({ filter }, async ({ path, namespace }) => {
        try {
          const src = await new Promise((resolve, reject) => {
            readFile(path, (error, data) => {
              if (error) {
                reject(error);
              } else {
                resolve(data.toString('utf-8'));
              }
            });
          });
          const transformed = flowRemoveTypes(src);
          return {
            contents: transformed.toString(),
            loader: loaderFunction(path),
          };
        } catch (error) {
          return {
            errors: [{
              text: error.message,
              location: {
                file: path,
                namespace,
              },
              detail: error,
            }],
          };
        }
      });
    },
  };
};
