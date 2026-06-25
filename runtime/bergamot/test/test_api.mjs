import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {Worker} from 'node:worker_threads';

const modelsDir = resolve(import.meta.dirname, '..');
const wasmPath = join(import.meta.dirname, 'bergamot-translator-worker.wasm');
const workerJsPath = join(import.meta.dirname, 'node_modules', '@browsermt', 'bergamot-translator', 'worker', 'translator-worker.js');

// Use the npm's module approach - load through the proper API
import {BatchTranslator} from "./node_modules/@browsermt/bergamot-translator/translator.js";

// Create properly configured translator
const options = {
  useNativeIntGemm: false, // Use the fallback (embedded) gemm
  cacheSize: 0,
  downloadTimeout: 30000,
  workerUrl: 'file:///' + join(import.meta.dirname, 'node_modules', '@browsermt', 'bergamot-translator', 'worker', 'translator-worker.js').replace(/\\/g, '/'),
};

// Override the TranslatorBacking to use local files instead of fetching from registry
const translator = new BatchTranslator(options);

// Monkey-patch the backing's loadTranslationModel to read local files
const originalLoad = translator.backing.loadTranslationModel.bind(translator.backing);
translator.backing.loadTranslationModel = async function({from, to}, opts) {
  const dir = from === 'en' ? 'enzh' : 'zhen';
  const langPair = dir;

  console.log(`Loading model for ${from}->${to} from ${dir}...`);

  const modelBuf = readFileSync(join(modelsDir, dir, `model.${langPair}.intgemm.alphas.bin`)).buffer;
  const lexBuf = readFileSync(join(modelsDir, dir, `lex.50.50.${langPair}.s2t.bin`)).buffer;
  const vocabBuf = readFileSync(join(modelsDir, dir, `vocab.${langPair}.spm`)).buffer;

  return {model: modelBuf, shortlist: lexBuf, vocab: vocabBuf};
};

// Monkey-patch registry to return our model
translator.backing.registry = Promise.resolve([
  { from: 'en', to: 'zh', files: { model: {name:'model.enzh.intgemm.alphas.bin'}, lex: {name:'lex.50.50.enzh.s2t.bin'}, vocab: {name:'vocab.enzh.spm'} } },
  { from: 'zh', to: 'en', files: { model: {name:'model.zhen.intgemm.alphas.bin'}, lex: {name:'lex.50.50.zhen.s2t.bin'}, vocab: {name:'vocab.zhen.spm'} } },
]);

// Test
const testCases = [
  { dir: 'enzh', from: 'en', to: 'zh', label: '日常对话', text: 'What time is the meeting tomorrow?' },
  { dir: 'enzh', from: 'en', to: 'zh', label: '技术内容', text: 'The system requires 16GB of RAM to run efficiently.' },
  { dir: 'enzh', from: 'en', to: 'zh', label: '长难句', text: 'Despite the challenges posed by the rapidly changing market conditions, the company managed to maintain its competitive edge through innovative product development and strategic partnerships.' },
  { dir: 'zhen', from: 'zh', to: 'en', label: '日常对话', text: '明天几点开会？' },
  { dir: 'zhen', from: 'zh', to: 'en', label: '技术内容', text: '这个算法的时间复杂度是O(n log n)，在数据量较大时表现优异。' },
  { dir: 'zhen', from: 'zh', to: 'en', label: '长难句', text: '尽管项目初期遇到了一些困难，但在团队的努力下，我们最终按时交付了产品，并且获得了客户的高度认可。' },
];

console.log('Bergamot 翻译测试\n');

for (const tc of testCases) {
  console.log(`📝 [${tc.label}] ${tc.text.substring(0, 60)}...`);
  try {
    const response = await translator.translate({
      from: tc.from,
      to: tc.to,
      text: tc.text,
      html: false,
      qualityScores: false,
    });
    console.log(`✅ ${response.target.text}\n`);
  } catch (e) {
    console.log(`❌ [${e.constructor?.name}] ${e.message}\n`);
  }
}

translator.delete();
console.log('测试完成');
