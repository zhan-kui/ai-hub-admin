// vite.config.ts
import { resolve } from "path";
import { loadEnv } from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0/node_modules/vite/dist/node/index.js";
import Vue from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/@vitejs+plugin-vue@5.2.1_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0__vue@3.5.13_typescript@5.7.3_/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import VueJsx from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/@vitejs+plugin-vue-jsx@4.1.1_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0__vue@3.5.13_typescript@5.7.3_/node_modules/@vitejs/plugin-vue-jsx/dist/index.mjs";
import progress from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/vite-plugin-progress@0.0.7_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0_/node_modules/vite-plugin-progress/dist/index.mjs";
import EslintPlugin from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/vite-plugin-eslint@1.8.1_eslint@9.17.0_jiti@2.4.2__vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0_/node_modules/vite-plugin-eslint/dist/index.mjs";
import { ViteEjsPlugin } from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/vite-plugin-ejs@1.7.0_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0_/node_modules/vite-plugin-ejs/index.js";
import { viteMockServe } from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/vite-plugin-mock@2.9.6_mockjs@1.1.0_rollup@4.30.1_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0_/node_modules/vite-plugin-mock/dist/index.js";
import PurgeIcons from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/vite-plugin-purge-icons@0.10.0_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0_/node_modules/vite-plugin-purge-icons/dist/index.mjs";
import ServerUrlCopy from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/vite-plugin-url-copy@1.1.4_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0_/node_modules/vite-plugin-url-copy/dist/index.js";
import VueI18nPlugin from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/@intlify+unplugin-vue-i18n@6.0.3_@vue+compiler-dom@3.5.13_eslint@9.17.0_jiti@2.4.2__rollup@4._23zjp6h6eyotzgxh6dzcocpjpu/node_modules/@intlify/unplugin-vue-i18n/lib/vite.mjs";
import { createSvgIconsPlugin } from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/vite-plugin-svg-icons@2.0.1_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0_/node_modules/vite-plugin-svg-icons/dist/index.mjs";
import { createStyleImportPlugin, ElementPlusResolve } from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/vite-plugin-style-import@2.0.0_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@5.37.0_/node_modules/vite-plugin-style-import/dist/index.mjs";
import UnoCSS from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/unocss@0.65.4_postcss@8.4.49_rollup@4.30.1_vite@5.4.19_@types+node@22.10.5_less@4.2.1_terser@_ahilxyds23r4xs5pwcrl542ogi/node_modules/unocss/dist/vite.mjs";
import { visualizer } from "file:///D:/probject/ai-hub-admin/node_modules/.pnpm/rollup-plugin-visualizer@5.14.0_rollup@4.30.1/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_dirname = "D:\\probject\\ai-hub-admin";
var root = process.cwd();
function pathResolve(dir) {
  return resolve(root, ".", dir);
}
var vite_config_default = ({ command, mode }) => {
  let env = {};
  const isBuild = command === "build";
  if (!isBuild) {
    env = loadEnv(process.argv[3] === "--mode" ? process.argv[4] : process.argv[3], root);
  } else {
    env = loadEnv(mode, root);
  }
  return {
    base: env.VITE_BASE_PATH,
    plugins: [
      Vue({
        script: {
          // 开启defineModel
          defineModel: true
        }
      }),
      VueJsx(),
      ServerUrlCopy(),
      progress(),
      env.VITE_USE_ALL_ELEMENT_PLUS_STYLE === "false" ? createStyleImportPlugin({
        resolves: [ElementPlusResolve()],
        libs: [
          {
            libraryName: "element-plus",
            esModule: true,
            resolveStyle: (name) => {
              if (name === "click-outside") {
                return "";
              }
              return `element-plus/es/components/${name.replace(/^el-/, "")}/style/css`;
            }
          }
        ]
      }) : void 0,
      EslintPlugin({
        cache: false,
        failOnWarning: false,
        failOnError: false,
        include: ["src/**/*.vue", "src/**/*.ts", "src/**/*.tsx"]
        // 检查的文件
      }),
      VueI18nPlugin({
        runtimeOnly: true,
        compositionOnly: true,
        include: [resolve(__vite_injected_original_dirname, "src/locales/**")]
      }),
      createSvgIconsPlugin({
        iconDirs: [pathResolve("src/assets/svgs")],
        symbolId: "icon-[dir]-[name]",
        svgoOptions: true
      }),
      PurgeIcons(),
      env.VITE_USE_MOCK === "true" ? viteMockServe({
        ignore: /^\_/,
        mockPath: "mock",
        localEnabled: !isBuild,
        prodEnabled: isBuild,
        injectCode: `
          import { setupProdMockServer } from '../mock/_createProductionServer'

          setupProdMockServer()
          `
      }) : void 0,
      ViteEjsPlugin({
        title: env.VITE_APP_TITLE
      }),
      UnoCSS()
    ],
    css: {
      preprocessorOptions: {
        less: {
          additionalData: '@import "./src/styles/variables.module.less";',
          javascriptEnabled: true
        }
      }
    },
    resolve: {
      extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".less", ".css"],
      alias: [
        {
          find: "vue-i18n",
          replacement: "vue-i18n/dist/vue-i18n.cjs.js"
        },
        {
          find: /\@\//,
          replacement: `${pathResolve("src")}/`
        }
      ]
    },
    esbuild: {
      pure: env.VITE_DROP_CONSOLE === "true" ? ["console.log"] : void 0,
      drop: env.VITE_DROP_DEBUGGER === "true" ? ["debugger"] : void 0
    },
    build: {
      target: "es2015",
      outDir: env.VITE_OUT_DIR || "dist",
      sourcemap: env.VITE_SOURCEMAP === "true",
      // brotliSize: false,
      rollupOptions: {
        plugins: env.VITE_USE_BUNDLE_ANALYZER === "true" ? [visualizer()] : void 0,
        // 拆包
        output: {
          manualChunks: {
            "vue-chunks": ["vue", "vue-router", "pinia", "vue-i18n"],
            "element-plus": ["element-plus"],
            "wang-editor": ["@wangeditor/editor", "@wangeditor/editor-for-vue"],
            echarts: ["echarts", "echarts-wordcloud"]
          }
        }
      },
      cssCodeSplit: !(env.VITE_USE_CSS_SPLIT === "false"),
      cssTarget: ["chrome31"]
    },
    server: {
      port: 4e3,
      proxy: {
        // 选项写法
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "")
        }
      },
      hmr: {
        overlay: false
      },
      host: "0.0.0.0"
    },
    optimizeDeps: {
      include: [
        "vue",
        "vue-router",
        "vue-types",
        "element-plus/es/locale/lang/zh-cn",
        "element-plus/es/locale/lang/en",
        "@iconify/iconify",
        "@vueuse/core",
        "axios",
        "qs",
        "echarts",
        "echarts-wordcloud",
        "qrcode",
        "@wangeditor/editor",
        "@wangeditor/editor-for-vue",
        "vue-json-pretty",
        "@zxcvbn-ts/core",
        "dayjs",
        "cropperjs"
      ]
    }
  };
};
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxwcm9iamVjdFxcXFxhaS1odWItYWRtaW5cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXHByb2JqZWN0XFxcXGFpLWh1Yi1hZG1pblxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovcHJvYmplY3QvYWktaHViLWFkbWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnXHJcbmltcG9ydCB7IGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xyXG5pbXBvcnQgdHlwZSB7IFVzZXJDb25maWcsIENvbmZpZ0VudiB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCBWdWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJ1xyXG5pbXBvcnQgVnVlSnN4IGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZS1qc3gnXHJcbmltcG9ydCBwcm9ncmVzcyBmcm9tICd2aXRlLXBsdWdpbi1wcm9ncmVzcydcclxuaW1wb3J0IEVzbGludFBsdWdpbiBmcm9tICd2aXRlLXBsdWdpbi1lc2xpbnQnXHJcbmltcG9ydCB7IFZpdGVFanNQbHVnaW4gfSBmcm9tICd2aXRlLXBsdWdpbi1lanMnXHJcbmltcG9ydCB7IHZpdGVNb2NrU2VydmUgfSBmcm9tICd2aXRlLXBsdWdpbi1tb2NrJ1xyXG5pbXBvcnQgUHVyZ2VJY29ucyBmcm9tICd2aXRlLXBsdWdpbi1wdXJnZS1pY29ucydcclxuaW1wb3J0IFNlcnZlclVybENvcHkgZnJvbSAndml0ZS1wbHVnaW4tdXJsLWNvcHknXHJcbmltcG9ydCBWdWVJMThuUGx1Z2luIGZyb20gJ0BpbnRsaWZ5L3VucGx1Z2luLXZ1ZS1pMThuL3ZpdGUnXHJcbmltcG9ydCB7IGNyZWF0ZVN2Z0ljb25zUGx1Z2luIH0gZnJvbSAndml0ZS1wbHVnaW4tc3ZnLWljb25zJ1xyXG5pbXBvcnQgeyBjcmVhdGVTdHlsZUltcG9ydFBsdWdpbiwgRWxlbWVudFBsdXNSZXNvbHZlIH0gZnJvbSAndml0ZS1wbHVnaW4tc3R5bGUtaW1wb3J0J1xyXG5pbXBvcnQgVW5vQ1NTIGZyb20gJ3Vub2Nzcy92aXRlJ1xyXG5pbXBvcnQgeyB2aXN1YWxpemVyIH0gZnJvbSAncm9sbHVwLXBsdWdpbi12aXN1YWxpemVyJ1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuY29uc3Qgcm9vdCA9IHByb2Nlc3MuY3dkKClcclxuXHJcbmZ1bmN0aW9uIHBhdGhSZXNvbHZlKGRpcjogc3RyaW5nKSB7XHJcbiAgcmV0dXJuIHJlc29sdmUocm9vdCwgJy4nLCBkaXIpXHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0ICh7IGNvbW1hbmQsIG1vZGUgfTogQ29uZmlnRW52KTogVXNlckNvbmZpZyA9PiB7XHJcbiAgbGV0IGVudiA9IHt9IGFzIGFueVxyXG4gIGNvbnN0IGlzQnVpbGQgPSBjb21tYW5kID09PSAnYnVpbGQnXHJcbiAgaWYgKCFpc0J1aWxkKSB7XHJcbiAgICBlbnYgPSBsb2FkRW52KHByb2Nlc3MuYXJndlszXSA9PT0gJy0tbW9kZScgPyBwcm9jZXNzLmFyZ3ZbNF0gOiBwcm9jZXNzLmFyZ3ZbM10sIHJvb3QpXHJcbiAgfSBlbHNlIHtcclxuICAgIGVudiA9IGxvYWRFbnYobW9kZSwgcm9vdClcclxuICB9XHJcbiAgcmV0dXJuIHtcclxuICAgIGJhc2U6IGVudi5WSVRFX0JBU0VfUEFUSCxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgVnVlKHtcclxuICAgICAgICBzY3JpcHQ6IHtcclxuICAgICAgICAgIC8vIFx1NUYwMFx1NTQyRmRlZmluZU1vZGVsXHJcbiAgICAgICAgICBkZWZpbmVNb2RlbDogdHJ1ZVxyXG4gICAgICAgIH1cclxuICAgICAgfSksXHJcbiAgICAgIFZ1ZUpzeCgpLFxyXG4gICAgICBTZXJ2ZXJVcmxDb3B5KCksXHJcbiAgICAgIHByb2dyZXNzKCksXHJcbiAgICAgIGVudi5WSVRFX1VTRV9BTExfRUxFTUVOVF9QTFVTX1NUWUxFID09PSAnZmFsc2UnXHJcbiAgICAgICAgPyBjcmVhdGVTdHlsZUltcG9ydFBsdWdpbih7XHJcbiAgICAgICAgICAgIHJlc29sdmVzOiBbRWxlbWVudFBsdXNSZXNvbHZlKCldLFxyXG4gICAgICAgICAgICBsaWJzOiBbXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbGlicmFyeU5hbWU6ICdlbGVtZW50LXBsdXMnLFxyXG4gICAgICAgICAgICAgICAgZXNNb2R1bGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICByZXNvbHZlU3R5bGU6IChuYW1lKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgIGlmIChuYW1lID09PSAnY2xpY2stb3V0c2lkZScpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJydcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gYGVsZW1lbnQtcGx1cy9lcy9jb21wb25lbnRzLyR7bmFtZS5yZXBsYWNlKC9eZWwtLywgJycpfS9zdHlsZS9jc3NgXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBdXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIDogdW5kZWZpbmVkLFxyXG4gICAgICBFc2xpbnRQbHVnaW4oe1xyXG4gICAgICAgIGNhY2hlOiBmYWxzZSxcclxuICAgICAgICBmYWlsT25XYXJuaW5nOiBmYWxzZSxcclxuICAgICAgICBmYWlsT25FcnJvcjogZmFsc2UsXHJcbiAgICAgICAgaW5jbHVkZTogWydzcmMvKiovKi52dWUnLCAnc3JjLyoqLyoudHMnLCAnc3JjLyoqLyoudHN4J10gLy8gXHU2OEMwXHU2N0U1XHU3Njg0XHU2NTg3XHU0RUY2XHJcbiAgICAgIH0pLFxyXG4gICAgICBWdWVJMThuUGx1Z2luKHtcclxuICAgICAgICBydW50aW1lT25seTogdHJ1ZSxcclxuICAgICAgICBjb21wb3NpdGlvbk9ubHk6IHRydWUsXHJcbiAgICAgICAgaW5jbHVkZTogW3Jlc29sdmUoX19kaXJuYW1lLCAnc3JjL2xvY2FsZXMvKionKV1cclxuICAgICAgfSksXHJcbiAgICAgIGNyZWF0ZVN2Z0ljb25zUGx1Z2luKHtcclxuICAgICAgICBpY29uRGlyczogW3BhdGhSZXNvbHZlKCdzcmMvYXNzZXRzL3N2Z3MnKV0sXHJcbiAgICAgICAgc3ltYm9sSWQ6ICdpY29uLVtkaXJdLVtuYW1lXScsXHJcbiAgICAgICAgc3Znb09wdGlvbnM6IHRydWVcclxuICAgICAgfSksXHJcbiAgICAgIFB1cmdlSWNvbnMoKSxcclxuICAgICAgZW52LlZJVEVfVVNFX01PQ0sgPT09ICd0cnVlJ1xyXG4gICAgICAgID8gdml0ZU1vY2tTZXJ2ZSh7XHJcbiAgICAgICAgICAgIGlnbm9yZTogL15cXF8vLFxyXG4gICAgICAgICAgICBtb2NrUGF0aDogJ21vY2snLFxyXG4gICAgICAgICAgICBsb2NhbEVuYWJsZWQ6ICFpc0J1aWxkLFxyXG4gICAgICAgICAgICBwcm9kRW5hYmxlZDogaXNCdWlsZCxcclxuICAgICAgICAgICAgaW5qZWN0Q29kZTogYFxyXG4gICAgICAgICAgaW1wb3J0IHsgc2V0dXBQcm9kTW9ja1NlcnZlciB9IGZyb20gJy4uL21vY2svX2NyZWF0ZVByb2R1Y3Rpb25TZXJ2ZXInXHJcblxyXG4gICAgICAgICAgc2V0dXBQcm9kTW9ja1NlcnZlcigpXHJcbiAgICAgICAgICBgXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIDogdW5kZWZpbmVkLFxyXG4gICAgICBWaXRlRWpzUGx1Z2luKHtcclxuICAgICAgICB0aXRsZTogZW52LlZJVEVfQVBQX1RJVExFXHJcbiAgICAgIH0pLFxyXG4gICAgICBVbm9DU1MoKVxyXG4gICAgXSxcclxuXHJcbiAgICBjc3M6IHtcclxuICAgICAgcHJlcHJvY2Vzc29yT3B0aW9uczoge1xyXG4gICAgICAgIGxlc3M6IHtcclxuICAgICAgICAgIGFkZGl0aW9uYWxEYXRhOiAnQGltcG9ydCBcIi4vc3JjL3N0eWxlcy92YXJpYWJsZXMubW9kdWxlLmxlc3NcIjsnLFxyXG4gICAgICAgICAgamF2YXNjcmlwdEVuYWJsZWQ6IHRydWVcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgICByZXNvbHZlOiB7XHJcbiAgICAgIGV4dGVuc2lvbnM6IFsnLm1qcycsICcuanMnLCAnLnRzJywgJy5qc3gnLCAnLnRzeCcsICcuanNvbicsICcubGVzcycsICcuY3NzJ10sXHJcbiAgICAgIGFsaWFzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgZmluZDogJ3Z1ZS1pMThuJyxcclxuICAgICAgICAgIHJlcGxhY2VtZW50OiAndnVlLWkxOG4vZGlzdC92dWUtaTE4bi5janMuanMnXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBmaW5kOiAvXFxAXFwvLyxcclxuICAgICAgICAgIHJlcGxhY2VtZW50OiBgJHtwYXRoUmVzb2x2ZSgnc3JjJyl9L2BcclxuICAgICAgICB9XHJcbiAgICAgIF1cclxuICAgIH0sXHJcbiAgICBlc2J1aWxkOiB7XHJcbiAgICAgIHB1cmU6IGVudi5WSVRFX0RST1BfQ09OU09MRSA9PT0gJ3RydWUnID8gWydjb25zb2xlLmxvZyddIDogdW5kZWZpbmVkLFxyXG4gICAgICBkcm9wOiBlbnYuVklURV9EUk9QX0RFQlVHR0VSID09PSAndHJ1ZScgPyBbJ2RlYnVnZ2VyJ10gOiB1bmRlZmluZWRcclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICB0YXJnZXQ6ICdlczIwMTUnLFxyXG4gICAgICBvdXREaXI6IGVudi5WSVRFX09VVF9ESVIgfHwgJ2Rpc3QnLFxyXG4gICAgICBzb3VyY2VtYXA6IGVudi5WSVRFX1NPVVJDRU1BUCA9PT0gJ3RydWUnLFxyXG4gICAgICAvLyBicm90bGlTaXplOiBmYWxzZSxcclxuICAgICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICAgIHBsdWdpbnM6IGVudi5WSVRFX1VTRV9CVU5ETEVfQU5BTFlaRVIgPT09ICd0cnVlJyA/IFt2aXN1YWxpemVyKCldIDogdW5kZWZpbmVkLFxyXG4gICAgICAgIC8vIFx1NjJDNlx1NTMwNVxyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAgICd2dWUtY2h1bmtzJzogWyd2dWUnLCAndnVlLXJvdXRlcicsICdwaW5pYScsICd2dWUtaTE4biddLFxyXG4gICAgICAgICAgICAnZWxlbWVudC1wbHVzJzogWydlbGVtZW50LXBsdXMnXSxcclxuICAgICAgICAgICAgJ3dhbmctZWRpdG9yJzogWydAd2FuZ2VkaXRvci9lZGl0b3InLCAnQHdhbmdlZGl0b3IvZWRpdG9yLWZvci12dWUnXSxcclxuICAgICAgICAgICAgZWNoYXJ0czogWydlY2hhcnRzJywgJ2VjaGFydHMtd29yZGNsb3VkJ11cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGNzc0NvZGVTcGxpdDogIShlbnYuVklURV9VU0VfQ1NTX1NQTElUID09PSAnZmFsc2UnKSxcclxuICAgICAgY3NzVGFyZ2V0OiBbJ2Nocm9tZTMxJ11cclxuICAgIH0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgcG9ydDogNDAwMCxcclxuICAgICAgcHJveHk6IHtcclxuICAgICAgICAvLyBcdTkwMDlcdTk4NzlcdTUxOTlcdTZDRDVcclxuICAgICAgICAnL2FwaSc6IHtcclxuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODAwMCcsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpLywgJycpXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBobXI6IHtcclxuICAgICAgICBvdmVybGF5OiBmYWxzZVxyXG4gICAgICB9LFxyXG4gICAgICBob3N0OiAnMC4wLjAuMCdcclxuICAgIH0sXHJcbiAgICBvcHRpbWl6ZURlcHM6IHtcclxuICAgICAgaW5jbHVkZTogW1xyXG4gICAgICAgICd2dWUnLFxyXG4gICAgICAgICd2dWUtcm91dGVyJyxcclxuICAgICAgICAndnVlLXR5cGVzJyxcclxuICAgICAgICAnZWxlbWVudC1wbHVzL2VzL2xvY2FsZS9sYW5nL3poLWNuJyxcclxuICAgICAgICAnZWxlbWVudC1wbHVzL2VzL2xvY2FsZS9sYW5nL2VuJyxcclxuICAgICAgICAnQGljb25pZnkvaWNvbmlmeScsXHJcbiAgICAgICAgJ0B2dWV1c2UvY29yZScsXHJcbiAgICAgICAgJ2F4aW9zJyxcclxuICAgICAgICAncXMnLFxyXG4gICAgICAgICdlY2hhcnRzJyxcclxuICAgICAgICAnZWNoYXJ0cy13b3JkY2xvdWQnLFxyXG4gICAgICAgICdxcmNvZGUnLFxyXG4gICAgICAgICdAd2FuZ2VkaXRvci9lZGl0b3InLFxyXG4gICAgICAgICdAd2FuZ2VkaXRvci9lZGl0b3ItZm9yLXZ1ZScsXHJcbiAgICAgICAgJ3Z1ZS1qc29uLXByZXR0eScsXHJcbiAgICAgICAgJ0B6eGN2Ym4tdHMvY29yZScsXHJcbiAgICAgICAgJ2RheWpzJyxcclxuICAgICAgICAnY3JvcHBlcmpzJ1xyXG4gICAgICBdXHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBZ1EsU0FBUyxlQUFlO0FBQ3hSLFNBQVMsZUFBZTtBQUV4QixPQUFPLFNBQVM7QUFDaEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sY0FBYztBQUNyQixPQUFPLGtCQUFrQjtBQUN6QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHFCQUFxQjtBQUM5QixPQUFPLGdCQUFnQjtBQUN2QixPQUFPLG1CQUFtQjtBQUMxQixPQUFPLG1CQUFtQjtB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
