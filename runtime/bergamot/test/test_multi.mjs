import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const modelsDir = resolve(import.meta.dirname, '..');
const wasmBinary = readFileSync(join(import.meta.dirname, 'node_modules/@browsermt/bergamot-translator/worker/bergamot-translator-worker.wasm'));
const runtimeJs = readFileSync(join(import.meta.dirname, 'node_modules/@browsermt/bergamot-translator/worker/bergamot-translator-worker.js'), 'utf-8');

const GEMM_MAP = {};
['int8_prepare_a','int8_prepare_b','int8_prepare_b_from_transposed','int8_prepare_b_from_quantized_transposed','int8_prepare_bias','int8_multiply_and_add_bias','int8_select_columns_of_b'].forEach(k => {
  const fb = '_int8' + k[4].toUpperCase() + k.slice(5) + 'Fallback';
  GEMM_MAP[k] = fb;
});

globalThis.Module = {
  wasmBinary,
  onRuntimeInitialized: run,
  print: () => {},
  printErr: () => {},
  instantiateWasm: (info, accept) => {
    const stubs = {};
    for (const [key, fb] of Object.entries(GEMM_MAP)) {
      stubs[key] = (...args) => {
        const m = globalThis.Module;
        return m && m['asm'] && m['asm'][fb] ? m['asm'][fb](...args) : 0;
      };
    }
    info['wasm_gemm'] = stubs;
    WebAssembly.instantiate(wasmBinary, info).then(({instance}) => accept(instance));
    return {};
  },
};

eval.call(globalThis, runtimeJs);

async function run() {
  const M = globalThis.Module;
  const svc = new M.BlockingService({cacheSize: 0});

  function load(dir, lp) {
    const mb = readFileSync(join(modelsDir, dir, `model.${lp}.intgemm.alphas.bin`));
    const lb = readFileSync(join(modelsDir, dir, `lex.50.50.${lp}.s2t.bin`));
    const vb = readFileSync(join(modelsDir, dir, `vocab.${lp}.spm`));
    const mm = new M.AlignedMemory(mb.byteLength, 256); mm.getByteArrayView().set(new Int8Array(mb));
    const sm = new M.AlignedMemory(lb.byteLength, 64); sm.getByteArrayView().set(new Int8Array(lb));
    const vm = new M.AlignedMemory(vb.byteLength, 64); vm.getByteArrayView().set(new Int8Array(vb));
    const vl = new M.AlignedMemoryList(); vl.push_back(vm);
    const cfg = ['beam-size: 1','normalize: 1.0','mini-batch-words: 1024','workspace: 256','gemm-precision: int8shiftAlphaAll'].join('\n');
    return new M.TranslationModel(cfg, mm, sm, vl, null);
  }

  const enzh = load('enzh', 'enzh');
  const zhen = load('zhen', 'zhen');
  console.log('Loaded');

  function xlate(model, txt) {
    const in_ = new M.VectorString(); in_.push_back(txt);
    const opts = new M.VectorResponseOptions();
    const out = svc.translate(model, in_, opts);
    let r = '';
    if (out.size() > 0) { const resp = out.get(0); if (resp) r = resp.getTranslatedText() || ''; }
    try { out.delete(); } catch {}
    try { opts.delete(); } catch {}
    try { in_.delete(); } catch {}
    return r;
  }

  // Test: call same model multiple times
  const cases = ['Hello world', 'Good morning', 'How are you?'];
  for (const txt of cases) {
    console.log(`en→zh "${txt}" → "${xlate(enzh, txt)}"`);
  }

  const cases2 = ['你好', '今天天气不错', '再见'];
  for (const txt of cases2) {
    console.log(`zh→en "${txt}" → "${xlate(zhen, txt)}"`);
  }

  // Test repeated calls - this is the issue
  console.log('\n=== Repeated calls ===');
  for (let i = 0; i < 5; i++) {
    console.log(`Call ${i}: "${xlate(enzh, "What time is it?")}"`);
  }

  console.log('\nDone');
}
