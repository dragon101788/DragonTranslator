import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const modelsDir = resolve(import.meta.dirname, '..');
const wasmBinary = readFileSync(join(import.meta.dirname, 'node_modules/@browsermt/bergamot-translator/worker/bergamot-translator-worker.wasm'));
const runtimeJs = readFileSync(join(import.meta.dirname, 'node_modules/@browsermt/bergamot-translator/worker/bergamot-translator-worker.js'), 'utf-8');

const GEMM_KEYS = ['int8_prepare_a','int8_prepare_b','int8_prepare_b_from_transposed','int8_prepare_b_from_quantized_transposed','int8_prepare_bias','int8_multiply_and_add_bias','int8_select_columns_of_b'];
const GEMM_MAP = Object.fromEntries(GEMM_KEYS.map(k => {
  const fb = '_int8' + k[4].toUpperCase() + k.slice(5) + 'Fallback';
  // e.g. int8_prepare_a -> _int8PrepareAFallback
  return [k, fb];
}));

function createGemStubs() {
  const stubs = {};
  for (const [key, fb] of Object.entries(GEMM_MAP)) {
    stubs[key] = (...args) => {
      const m = globalThis.Module;
      return m && m['asm'] && m['asm'][fb] ? m['asm'][fb](...args) : 0;
    };
  }
  return stubs;
}

// Per-call: re-init everything to avoid WASM memory corruption
async function translate(text, dir) {
  return new Promise((resolve, reject) => {
    globalThis.Module = {
      wasmBinary,
      onRuntimeInitialized: () => {
        try {
          const M = globalThis.Module;
          const svc = new M.BlockingService({cacheSize: 0});

          // Load model files
          const dirPath = join(modelsDir, dir);
          const lp = dir === 'enzh' ? 'enzh' : 'zhen';
          const mb = readFileSync(join(dirPath, `model.${lp}.intgemm.alphas.bin`));
          const lb = readFileSync(join(dirPath, `lex.50.50.${lp}.s2t.bin`));
          const vb = readFileSync(join(dirPath, `vocab.${lp}.spm`));

          const mm = new M.AlignedMemory(mb.byteLength, 256); mm.getByteArrayView().set(new Int8Array(mb));
          const sm = new M.AlignedMemory(lb.byteLength, 64); sm.getByteArrayView().set(new Int8Array(lb));
          const vm = new M.AlignedMemory(vb.byteLength, 64); vm.getByteArrayView().set(new Int8Array(vb));
          const vl = new M.AlignedMemoryList(); vl.push_back(vm);

          const cfg = ['beam-size: 1','normalize: 1.0','mini-batch-words: 1024','workspace: 256','gemm-precision: int8shiftAlphaAll'].join('\n');
          const model = new M.TranslationModel(cfg, mm, sm, vl, null);

          const in_ = new M.VectorString(); in_.push_back(text);
          const opts = new M.VectorResponseOptions();
          const out = svc.translate(model, in_, opts);

          let result = '';
          try {
            if (out.size() > 0) {
              const resp = out.get(0);
              if (resp) result = resp.getTranslatedText() || '';
            }
          } catch(e) {}

          // Clean everything
          try { out.delete(); } catch {}
          try { opts.delete(); } catch {}
          try { in_.delete(); } catch {}
          try { model.delete(); } catch {}
          try { svc.delete(); } catch {}

          resolve(result);
        } catch(e) {
          reject(e);
        }
      },
      print: () => {},
      printErr: () => {},
      instantiateWasm: (info, accept) => {
        info['wasm_gemm'] = createGemStubs();
        WebAssembly.instantiate(wasmBinary, info).then(({instance}) => accept(instance));
        return {};
      },
    };

    try { (0, eval)(runtimeJs); } catch(e) { reject(e); }
  });
}

async function main() {
  console.log('Testing per-call re-init...\n');

  const tests = [
    ['enzh', 'Hello world'],
    ['enzh', 'What time is the meeting?'],
    ['zhen', '你好'],
    ['zhen', '明天几点开会？'],
    ['enzh', 'Goodbye'],
    ['zhen', '这是一个测试'],
  ];

  for (const [dir, txt] of tests) {
    const start = Date.now();
    try {
      const result = await translate(txt, dir);
      const elapsed = Date.now() - start;
      console.log(`${dir}: "${txt}" → "${result}" (${elapsed}ms)`);
    } catch(e) {
      console.log(`${dir}: "${txt}" → ❌ ${e.message}`);
    }
  }

  console.log('\nDone');
}

main();
