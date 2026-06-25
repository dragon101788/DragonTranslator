import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const modelsDir = resolve(import.meta.dirname, '..');

// We need to load WASM through the Emscripten glue code properly.
// The key is that the worker.js expects `self` (WebWorker global scope).
// In Node.js we need to provide the proper Emscripten Module setup.
// Use the npm's own worker.js approach.

// Read the worker translator JS
const workerJs = readFileSync(
  join(import.meta.dirname, 'node_modules/@browsermt/bergamot-translator/worker/translator-worker.js'),
  'utf-8'
);

// Make the module globals available
globalThis.Module = {};

// Provide the GEMM fallback mapping expected by translator-worker.js
globalThis.BergamotTranslatorWorker = {
  GEMM_TO_FALLBACK_FUNCTIONS_MAP: {
    'int8_prepare_a': 'int8PrepareAFallback',
    'int8_prepare_b': 'int8PrepareBFallback',
    'int8_prepare_b_from_transposed': 'int8PrepareBFromTransposedFallback',
    'int8_prepare_b_from_quantized_transposed': 'int8PrepareBFromQuantizedTransposedFallback',
    'int8_prepare_bias': 'int8PrepareBiasFallback',
    'int8_multiply_and_add_bias': 'int8MultiplyAndAddBiasFallback',
    'int8_select_columns_of_b': 'int8SelectColumnsOfBFallback'
  }
};

// Provide fetch polyfill that loads local files
globalThis.fetch = async (url) => {
  const urlStr = typeof url === 'string' ? url : url.url;
  const isLocal = urlStr.startsWith('file://') || urlStr.startsWith('.') || !urlStr.includes('://');

  let filePath;
  if (urlStr.startsWith('file:///')) {
    filePath = urlStr.slice(8).replace(/\//g, '\\'); // file:///D:/... -> D:\...
  } else if (urlStr.startsWith('./')) {
    filePath = join(import.meta.dirname, urlStr.slice(2));
  } else {
    // Remote URL - don't support
    throw new Error(`Cannot fetch remote URL: ${urlStr}`);
  }

  const buffer = readFileSync(filePath);
  return {
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(buffer.buffer.slice(0)),
    blob: () => Promise.resolve(new Blob([buffer])),
    headers: new Headers({'content-length': String(buffer.length)}),
  };
};

// Provide Worker polyfill (translator-worker.js uses Worker for multi-threading)
// But the low-level API uses BlockingService synchronously
// Actually, translator-worker.js IS the worker code. The translater js creates
// a Worker from it. For simplicity, let's use the Emscripten approach directly.

// Actually, let's step back and use the simplest approach:
// The node-test.js from the repo works - it reads the WASM and runtime JS.
// The issue is GEMM. Let's use the exact same pattern and provide instantiateWasm.

// Read npm's bergamot-translator-worker files (Emscripten glue code)
const wasmBinary = readFileSync(
  join(import.meta.dirname, 'node_modules/@browsermt/bergamot-translator/worker/bergamot-translator-worker.wasm')
);
const runtimeJs = readFileSync(
  join(import.meta.dirname, 'node_modules/@browsermt/bergamot-translator/worker/bergamot-translator-worker.js'),
  'utf-8'
);

// Reset Module
delete globalThis.Module;

// Setup proper Emscripten module with GEMM linking
globalThis.Module = {
  wasmBinary,
  onRuntimeInitialized: run,
  print: (t) => {},
  printErr: (t) => {},
  instantiateWasm: (info, accept) => {
    // Provide fallback GEMM implementations by reading the main WASM's exports
    info['wasm_gemm'] = info['wasm_gemm'] || {};

    // Try to get the fallback functions from the Module itself or provide stubs
    const fallbackMap = BergamotTranslatorWorker.GEMM_TO_FALLBACK_FUNCTIONS_MAP;

    // We need the WASM module's own fallback functions. Since we're loading
    // via instantiateWasm callback, we use linkFallbackIntGemm pattern.
    const stubs = {};
    for (const [key, fallbackName] of Object.entries(fallbackMap)) {
      stubs[key] = (...args) => {
        if (Module['asm'] && Module['asm'][fallbackName]) {
          return Module['asm'][fallbackName](...args);
        }
        throw new Error(`${fallbackName} not available yet (stub called during init)`);
      };
    }
    info['wasm_gemm'] = stubs;

    // Now instantiate! This will fail if any GEMM function is called during init
    WebAssembly.instantiate(wasmBinary, info).then(({instance}) => {
      accept(instance);
    }).catch(err => {
      console.error('WASM instantiate error:', err);
      throw err;
    });
    return {};
  },
};

eval.call(globalThis, runtimeJs);

async function run() {
  try {
    console.log('✅ WASM 引擎初始化成功');
    const M = globalThis.Module;

    // Patch GEMM functions after instantiation - they should now be available
    // as Module.asm.fallbackName(...)

    console.log('Module类的关键方法:', Object.getOwnPropertyNames(M)
      .filter(k => typeof M[k] === 'function' && k[0] === k[0].toUpperCase())
      .join(', '));

    async function loadModel(dir, langPair) {
      console.log(`\n加载 ${langPair} 模型...`);
      const modelBuf = readFileSync(join(modelsDir, dir, `model.${langPair}.intgemm.alphas.bin`));
      const lexBuf = readFileSync(join(modelsDir, dir, `lex.50.50.${langPair}.s2t.bin`));
      const vocabBuf = readFileSync(join(modelsDir, dir, `vocab.${langPair}.spm`));

      const modelMem = new M.AlignedMemory(modelBuf.byteLength, 256);
      modelMem.getByteArrayView().set(new Int8Array(modelBuf));

      const shortlistMem = new M.AlignedMemory(lexBuf.byteLength, 64);
      shortlistMem.getByteArrayView().set(new Int8Array(lexBuf));

      const vocabMem = new M.AlignedMemory(vocabBuf.byteLength, 64);
      vocabMem.getByteArrayView().set(new Int8Array(vocabBuf));

      const vocabs = new M.AlignedMemoryList();
      vocabs.push_back(vocabMem);

      const config = [
        'beam-size: 1', 'normalize: 1.0', 'word-penalty: 0',
        'alignment: soft', 'max-length-break: 128', 'mini-batch-words: 1024',
        'workspace: 256', 'max-length-factor: 2.0', 'skip-cost: true',
        'gemm-precision: int8shiftAlphaAll',
      ].join('\n');

      // TranslationModel(config, modelWeights, shortlist, vocabs, qualityModel(optional))
      const model = new M.TranslationModel(config, modelMem, shortlistMem, vocabs, null);
      console.log('  ✅ 模型创建成功');
      return model;
    }

    const enzh = await loadModel('enzh', 'enzh');
    const zhen = await loadModel('zhen', 'zhen');
    const svc = new M.BlockingService({cacheSize: 0});

    console.log('\n' + '='.repeat(50));

    const tests = [
      ['en→zh', enzh, '日常对话', 'What time is the meeting tomorrow?'],
      ['en→zh', enzh, '技术内容', 'The system requires 16GB of RAM to run efficiently.'],
      ['en→zh', enzh, '长难句', 'Despite the challenges posed by the rapidly changing market conditions, the company managed to maintain its competitive edge.'],
      ['zh→en', zhen, '日常对话', '明天几点开会？'],
      ['zh→en', zhen, '技术内容', '这个算法的时间复杂度是O(n log n)，在数据量较大时表现优异。'],
      ['zh→en', zhen, '长难句', '尽管项目初期遇到了一些困难，但在团队的努力下，我们最终按时交付了产品。'],
    ];

    for (const [dir, model, label, text] of tests) {
      console.log(`\n📝 [${dir}] ${label}: ${text.substring(0,50)}...`);
      try {
        const start = performance.now();

        // Bergamot expects VectorString (batch of input texts)
        const input = new M.VectorString();
        input.push_back(text);

        // ResponseOptions for each input - use the API that exists
        const options = new M.VectorResponseOptions();

        const output = svc.translate(model, input, options);
        const elapsed = ((performance.now()-start)/1000).toFixed(2);

        // output is a VectorResponse - use getTranslatedText()
        const out = output.size() > 0 ? output.get(0).getTranslatedText() : '(empty)';

        console.log(`   译文: ${out}`);
        console.log(`   用时: ${elapsed}s`);
      } catch(e) {
        console.log(`   ❌ ${e.message}`);
      }
    }

    console.log('\n✅ 测试完成');
  } catch(e) {
    console.error('❌', e.message);
  }
}
