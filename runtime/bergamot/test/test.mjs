import {join, resolve, sep} from 'node:path';
import {BatchTranslator} from "./node_modules/@browsermt/bergamot-translator/translator.js";

const modelsDir = resolve(import.meta.dirname, '..');

const testCases = {
  enzh: [
    { label: "日常对话", text: "What time is the meeting tomorrow?" },
    { label: "技术内容", text: "The system requires 16GB of RAM to run efficiently." },
    { label: "长难句", text: "Despite the challenges posed by the rapidly changing market conditions, the company managed to maintain its competitive edge through innovative product development and strategic partnerships." },
  ],
  zhen: [
    { label: "日常对话", text: "明天几点开会？" },
    { label: "技术内容", text: "这个算法的时间复杂度是O(n log n)，在数据量较大时表现优异。" },
    { label: "长难句", text: "尽管项目初期遇到了一些困难，但在团队的努力下，我们最终按时交付了产品。" },
  ],
};

async function testDirection(dir, cases) {
  const translator = new BatchTranslator();
  const langPair = dir;
  const modelDir = join(modelsDir, dir);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`方向: ${dir === 'enzh' ? '英语 → 中文' : '中文 → 英语'}`);
  console.log(`模型: ${modelDir}`);
  console.log(`${'='.repeat(60)}`);

  // Set custom model root - use forward slash file URL
  translator.modelRoot = `file:///${modelDir.replace(/\\/g, '/')}/`;

  // Register custom model
  translator.modelRegistry = [
    {
      from: 'en',
      to: 'zh',
      files: {
        model: { name: `model.${langPair}.intgemm.alphas.bin`, size: 0 },
        lex: { name: `lex.50.50.${langPair}.s2t.bin`, size: 0 },
        vocab: { name: `vocab.${langPair}.spm`, size: 0 },
      }
    }
  ];

  for (const tc of cases) {
    console.log(`\n📝 [${tc.label}] "${tc.text}"`);
    try {
      const response = await translator.translate({
        from: dir === 'enzh' ? 'en' : 'zh',
        to: dir === 'enzh' ? 'zh' : 'en',
        text: tc.text,
        html: false,
        qualityScores: false,
      });
      console.log(`✅ 译文: ${response.target.text}`);
    } catch (e) {
      console.log(`❌ 错误: [${e.constructor?.name}] ${e.message}`);
      break;
    }
  }

  translator.delete();
}

console.log('Bergamot 离线翻译测试');
console.log(`模型目录: ${modelsDir}\n`);

await testDirection('enzh', testCases.enzh);
await testDirection('zhen', testCases.zhen);

console.log('\n测试完成');
