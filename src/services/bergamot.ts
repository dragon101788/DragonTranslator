import { logger } from "./logger";

let ready = false;
let initFailed = false;
let M: any = null;
let service: any = null;
const models: Map<string, any> = new Map();

// Persistent WASM objects — allocate ONCE, reuse forever.
// translate() caches internal pointers to these; recreating them corrupts output.
let persistentInput: any = null;
let persistentOpts: any = null;

const FILES: Record<string, { model: string; lex: string; vocab: string }> = {
  enzh: { model: "model.enzh.intgemm.alphas.bin", lex: "lex.50.50.enzh.s2t.bin", vocab: "vocab.enzh.spm" },
  zhen: { model: "model.zhen.intgemm.alphas.bin", lex: "lex.50.50.zhen.s2t.bin", vocab: "vocab.zhen.spm" },
};

export async function initBergamot(): Promise<boolean> {
  if (ready) return true;
  if (initFailed) return false;

  try {
    logger.info("Bergamot: 正在加载 WASM 引擎...");

    const base = "/bergamot/";
    const [wasmResp, jsResp] = await Promise.all([
      fetch(base + "bergamot-translator-worker.wasm"),
      fetch(base + "bergamot-translator-worker.js"),
    ]);
    if (!wasmResp.ok || !jsResp.ok) { initFailed = true; logger.warn("Bergamot: WASM 文件未找到"); return false; }
    const wasmBinary = await wasmResp.arrayBuffer();
    const workerJs = await jsResp.text();

    const GEMM_FB: Record<string, string> = {
      int8_prepare_a: "_int8PrepareAFallback", int8_prepare_b: "_int8PrepareBFallback",
      int8_prepare_b_from_transposed: "_int8PrepareBFromTransposedFallback",
      int8_prepare_b_from_quantized_transposed: "_int8PrepareBFromQuantizedTransposedFallback",
      int8_prepare_bias: "_int8PrepareBiasFallback", int8_multiply_and_add_bias: "_int8MultiplyAndAddBiasFallback",
      int8_select_columns_of_b: "_int8SelectColumnsOfBFallback",
    };
    const gemmStubs: Record<string, Function> = {};
    for (const [k, v] of Object.entries(GEMM_FB)) {
      gemmStubs[k] = (...a: any[]) => { const x = (globalThis as any).Module; return x?.asm?.[v] ? x.asm[v](...a) : 0; };
    }

    await new Promise<void>((resolve, reject) => {
      (globalThis as any).Module = {
        wasmBinary,
        onRuntimeInitialized: () => resolve(),
        print: () => {},
        printErr: () => {},
        instantiateWasm: (info: any, accept: Function) => {
          info.wasm_gemm = gemmStubs;
          WebAssembly.instantiate(wasmBinary, info).then(r => accept(r.instance)).catch(reject);
          return {};
        },
      };
      try { (0, eval)(workerJs); } catch (e) { reject(e); }
    });

    M = (globalThis as any).Module;
    service = new M.BlockingService({ cacheSize: 0 });

    // Allocate persistent I/O objects ONCE — BlockingService.translate() keeps
    // internal references to their WASM memory addresses.
    persistentInput = new M.VectorString();
    persistentOpts = new M.VectorResponseOptions();

    let loaded = 0;
    for (const [dir, files] of Object.entries(FILES)) {
      try {
        const p = base + dir + "/";
        const [mr, lr, vr] = await Promise.all([fetch(p + files.model), fetch(p + files.lex), fetch(p + files.vocab)]);
        if (!mr.ok) continue;
        const [mb, lb, vb] = await Promise.all([mr.arrayBuffer(), lr.ok ? lr.arrayBuffer() : new ArrayBuffer(0), vr.ok ? vr.arrayBuffer() : new ArrayBuffer(0)]);
        const a = (b: ArrayBuffer, n: number) => { const m = new M.AlignedMemory(b.byteLength, n); m.getByteArrayView().set(new Int8Array(b)); return m; };
        const vl = new M.AlignedMemoryList(); vl.push_back(a(vb, 64));
        const cfg = ["beam-size: 1","normalize: 1.0","alignment: soft","max-length-break: 128","mini-batch-words: 1024","workspace: 256","max-length-factor: 2.0","skip-cost: true","gemm-precision: int8shiftAlphaAll"].join("\n");
        models.set(dir, new M.TranslationModel(cfg, a(mb, 256), lb.byteLength > 0 ? a(lb, 64) : new M.AlignedMemory(0, 64), vl, null));
        loaded++;
        logger.info(`Bergamot: ${dir} 模型加载成功`);
      } catch (e: any) { logger.warn(`Bergamot: ${dir} 加载失败: ${e?.message || e}`); }
    }

    if (loaded === 0) { initFailed = true; logger.warn("Bergamot: 无可用模型"); return false; }
    ready = true;
    logger.info("Bergamot: 初始化完成");
    return true;
  } catch (e: any) { initFailed = true; logger.warn(`Bergamot: 初始化失败: ${e?.message || e}`); return false; }
}

export async function translateBergamot(text: string): Promise<string> {
  if (!ready) {
    const ok = await initBergamot();
    if (!ok) throw new Error("Bergamot 引擎未就绪");
  }
  if (!text.trim()) return "";

  const dir = /[一-鿿]/.test(text) ? "zhen" : "enzh";
  const model = models.get(dir);
  if (!model) throw new Error(`模型未加载: ${dir}`);

  // SIMPLEST approach: new operator for every call, but keep OLD objects
  // alive via a growing _all array so V8 never GCs any WASM backing memory.
  // Once WASM heap pages are allocated they don't shrink, so this only costs
  // a few bytes per call (the JS wrapper object, not the WASM data).
  const input = new M.VectorString();
  input.push_back(text);
  const opts = new M.VectorResponseOptions();
  _all.push(input, opts);

  const out = service.translate(model, input, opts);
  let result = "";
  try {
    if (out.size() > 0) {
      result = out.get(0).getTranslatedText() || "";
    }
  } catch (e) {
    logger.warn(`Bergamot: 读取结果异常: ${e}`);
  }

  // Throttle: don't let _all grow unbounded.  Keep last 10.
  while (_all.length > 20) _all.shift();
  return result;
}

const _all: any[] = [];

export function isBergamotReady(): boolean {
  return ready;
}
