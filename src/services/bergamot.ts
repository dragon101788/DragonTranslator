import { logger } from "./logger";

let ready = false;
let initFailed = false;
let worker: any = null;

const FILES: Record<string, { from: string; to: string; model: string; lex: string; vocab: string }> = {
  enzh: { from: "en", to: "zh", model: "model.enzh.intgemm.alphas.bin", lex: "lex.50.50.enzh.s2t.bin", vocab: "vocab.enzh.spm" },
  zhen: { from: "zh", to: "en", model: "model.zhen.intgemm.alphas.bin", lex: "lex.50.50.zhen.s2t.bin", vocab: "vocab.zhen.spm" },
};

export async function initBergamot(): Promise<boolean> {
  if (ready) return true;
  if (initFailed) return false;

  try {
    logger.info("Bergamot: 正在加载 WASM 引擎...");
    const base = "/bergamot/";

    // 1. Fetch all resources
    const [wasmResp, glueResp, wrapResp] = await Promise.all([
      fetch(base + "bergamot-translator-worker.wasm"),
      fetch(base + "bergamot-translator-worker.js"),
      fetch(base + "translator-worker.js"),
    ]);
    if (!wasmResp.ok || !glueResp.ok || !wrapResp.ok) {
      initFailed = true;
      logger.warn("Bergamot: 资源文件未找到 (WASM/JS)");
      return false;
    }
    const wasmBinary = await wasmResp.arrayBuffer();
    const glueJs = await glueResp.text();
    const wrapJs = await wrapResp.text();

    // 2. Mock importScripts for main thread
    const origImportScripts = (self as any).importScripts;
    (self as any).importScripts = function (_path: string) {
      (0, eval)(glueJs);
    };

    // 3. Eval wrapper + expose BergamotTranslatorWorker class to self
    (0, eval)(wrapJs + ";\nself._BWT = BergamotTranslatorWorker;\n");
    const BWT = (self as any)._BWT;
    if (!BWT) throw new Error("BergamotTranslatorWorker 类未定义");

    // Restore original importScripts if any
    if (origImportScripts !== undefined) {
      (self as any).importScripts = origImportScripts;
    }

    // 4. Override loadModule to use pre-loaded WASM binary instead of streaming fetch
    const GEMM_MAP = BWT.GEMM_TO_FALLBACK_FUNCTIONS_MAP;
    BWT.prototype.loadModule = function () {
      return new Promise<any>((resolve, reject) => {
        const GM = (globalThis as any).Module;
        Object.assign(GM, {
          wasmBinary,
          onRuntimeInitialized: () => {
            // Must resolve with Module — BergamotTranslatorWorker stores it as this.module
            resolve(GM);
          },
          instantiateWasm: (info: any, accept: Function) => {
            // Setup intgemm fallbacks with dual naming (with/without underscore)
            const mapping = Object.entries(GEMM_MAP).map(
              ([key, name]: [string, string]) => {
                return [key, (...args: any[]) => {
                  const asm = GM["asm"];
                  if (!asm) return 0;
                  if (typeof asm[name] === "function") return asm[name](...args);
                  const altName = "_" + name;
                  if (typeof asm[altName] === "function") return asm[altName](...args);
                  return 0;
                }];
              }
            );
            (info as any)["wasm_gemm"] = Object.fromEntries(mapping);
            WebAssembly.instantiate(wasmBinary, info)
              .then((r) => accept(r.instance)).catch(reject);
            return {};
          },
        });
        (self as any).importScripts("./bergamot-translator-worker.js");
      });
    };

    // 5. Create worker instance and initialize
    worker = new BWT({ cacheSize: 0 });
    await worker.initialize({ cacheSize: 0 });
    logger.info("Bergamot: WASM 引擎初始化完成");

    // 6. Load translation models
    let loaded = 0;
    for (const [dir, files] of Object.entries(FILES)) {
      try {
        const p = base + dir + "/";
        const [mr, lr, vr] = await Promise.all([
          fetch(p + files.model),
          fetch(p + files.lex),
          fetch(p + files.vocab),
        ]);
        if (!mr.ok) continue;
        const [mb, lb, vb] = await Promise.all([
          mr.arrayBuffer(),
          lr.ok ? lr.arrayBuffer() : new ArrayBuffer(0),
          vr.ok ? vr.arrayBuffer() : new ArrayBuffer(0),
        ]);
        await worker.loadTranslationModel(
          { from: files.from, to: files.to },
          { model: mb, shortlist: lb, vocabs: [vb], config: {} }
        );
        loaded++;
        logger.info(`Bergamot: ${dir} 模型加载成功`);
      } catch (e: any) {
        logger.warn(`Bergamot: ${dir} 加载失败: ${e?.message || e}`);
      }
    }

    if (loaded === 0) {
      initFailed = true;
      logger.warn("Bergamot: 无可用模型");
      return false;
    }
    ready = true;
    logger.info("Bergamot: 初始化完成");
    return true;
  } catch (e: any) {
    initFailed = true;
    logger.warn(`Bergamot: 初始化失败: ${e?.message || e}`);
    return false;
  }
}

export async function translateBergamot(text: string): Promise<string> {
  if (!ready) {
    const ok = await initBergamot();
    if (!ok) throw new Error("Bergamot 引擎未就绪");
  }
  if (!text.trim()) return "";

  const dir = /[一-鿿]/.test(text) ? "zhen" : "enzh";
  const from = dir === "enzh" ? "en" : "zh";
  const to = dir === "enzh" ? "zh" : "en";

  try {
    const responses = await worker.translate({
      models: [{ from, to }],
      texts: [{ text, html: false, qualityScores: false }],
    });
    return responses[0]?.target?.text || "";
  } catch (e: any) {
    logger.warn(`Bergamot: 翻译失败: ${e?.message || e}`);
    throw e;
  }
}

export function isBergamotReady(): boolean {
  return ready;
}
