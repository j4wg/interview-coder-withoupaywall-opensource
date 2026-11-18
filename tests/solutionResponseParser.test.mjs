// `electron/solutionResponseParser.ts` 单测：零新依赖，直接跑 tsc 产物（`dist-electron`）。
// 覆盖点：中文返回 / 英文返回的结构化抽取（正常路径）、缺分节时的兜底（错误路径）、
// 行内复杂度与无 O() 标记的边界值；标题形态按「半角/全角括号 × 有/无序号 × 有/无加粗 ×
// 有/无冒号」的完整矩阵跑，避免再出现「标题残渣漏进正文」这类只在中文态复现的缺陷。
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const distFile = path.resolve(here, "../dist-electron/solutionResponseParser.js")

if (!fs.existsSync(distFile)) {
  throw new Error(
    `缺少编译产物 ${distFile}，请先执行 \`npx tsc -p tsconfig.electron.json\``
  )
}

const { parseSolutionResponse, sectionHeader } = require(distFile)

const fallbacks = {
  thoughts: "FALLBACK_THOUGHTS",
  timeComplexity: "FALLBACK_TIME",
  spaceComplexity: "FALLBACK_SPACE",
}

const zhResponse = `1. 代码 (Code)：
\`\`\`java
class Solution {
    public int[] twoSum(int[] nums, int target) {
        // 哈希表存值到下标
        return new int[]{0, 1};
    }
}
\`\`\`

2. 思路 (Thoughts)：
- 用哈希表把已访问元素的下标存起来
- 每步检查 target - nums[i] 是否出现过

3. 时间复杂度 (Time Complexity)：O(n)，因为数组只遍历一次，每次哈希查找是 O(1)。
4. 空间复杂度 (Space Complexity)：O(n)，因为最坏情况下要把全部元素存进哈希表。
`

const enResponse = `1. Code:
\`\`\`java
class Solution {
    public int[] twoSum(int[] nums, int target) {
        return new int[]{0, 1};
    }
}
\`\`\`

2. Thoughts:
- Store visited values in a hashmap
- Check whether target - nums[i] was seen

3. Time complexity: O(n) because we iterate the array only once.
4. Space complexity: O(n) because we may store all elements in the hashmap.
`

test("中文返回：代码块、思路要点、复杂度都被抽到（不退回兜底）", () => {
  const result = parseSolutionResponse(zhResponse, fallbacks, "zh")
  assert.match(result.code, /class Solution/)
  assert.ok(result.thoughts.length >= 2)
  assert.match(result.thoughts.join("\n"), /哈希表/)
  assert.match(result.time_complexity, /^O\(n\)/)
  assert.match(result.time_complexity, /因为数组只遍历一次/)
  assert.match(result.space_complexity, /^O\(n\)/)
  assert.match(result.space_complexity, /哈希表/)
  for (const value of [result.time_complexity, result.space_complexity]) {
    assert.ok(!value.includes("FALLBACK"), "不应退回兜底文案")
  }
})

test("英文返回：英文分节标题同样能抽到", () => {
  const result = parseSolutionResponse(enResponse, fallbacks, "en")
  assert.match(result.code, /class Solution/)
  assert.ok(result.thoughts.length >= 2)
  assert.match(result.thoughts.join("\n"), /hashmap/)
  assert.match(result.time_complexity, /^O\(n\)/)
  assert.match(result.time_complexity, /we iterate the array only once/)
  assert.match(result.space_complexity, /^O\(n\)/)
})

test("错误路径：没有分节标题时全部退回兜底文案，且不抛错", () => {
  const result = parseSolutionResponse("这是一段没有结构的回答。", fallbacks, "zh")
  assert.deepEqual(result.thoughts, ["FALLBACK_THOUGHTS"])
  assert.equal(result.time_complexity, "FALLBACK_TIME")
  assert.equal(result.space_complexity, "FALLBACK_SPACE")
  assert.equal(result.code, "这是一段没有结构的回答。")
})

test("错误路径：空串与非字符串输入不抛错", () => {
  assert.doesNotThrow(() => parseSolutionResponse("", fallbacks, "en"))
  const result = parseSolutionResponse(undefined, fallbacks, "en")
  assert.deepEqual(result.thoughts, ["FALLBACK_THOUGHTS"])
})

test("错误路径：locale 非法时按英文排版兜底，不拼出半中半英", () => {
  const raw = `思路：\n- 遍历一次\n时间复杂度：只遍历一次数组\n`
  const result = parseSolutionResponse(raw, fallbacks, "fr")
  assert.equal(result.time_complexity, "O(n) - 只遍历一次数组")
})

test("边界值：中文态复杂度缺 O() 标记时用全角逗号，不用英文破折号", () => {
  const raw = `2. 思路 (Thoughts)：
- 遍历一次
3. 时间复杂度 (Time Complexity)：线性，只遍历一次数组。
4. 空间复杂度 (Space Complexity)：常数，只用了几个变量。
`
  const result = parseSolutionResponse(raw, fallbacks, "zh")
  assert.equal(result.time_complexity, "O(n)，线性，只遍历一次数组。")
  assert.equal(result.space_complexity, "O(n)，常数，只用了几个变量。")
  for (const value of [result.time_complexity, result.space_complexity]) {
    assert.ok(!value.includes(" - "), `中文态不应出现英文破折号分隔符：${value}`)
  }
})

test("边界值：英文态复杂度缺 O() 标记时仍用英文破折号", () => {
  const raw = `Thoughts:\n- single pass\nTime complexity: linear, we visit each element once\nSpace complexity: constant, only two pointers\n`
  const result = parseSolutionResponse(raw, fallbacks, "en")
  assert.equal(result.time_complexity, "O(n) - linear, we visit each element once")
  assert.equal(result.space_complexity, "O(n) - constant, only two pointers")
})

test("边界值：中文态已带全角逗号解释时不重复插入分隔符", () => {
  const raw = `思路：\n- 一次遍历\n时间复杂度：O(n)，因为只遍历一次数组\n空间复杂度：O(1)，因为只用了两个变量\n`
  const result = parseSolutionResponse(raw, fallbacks, "zh")
  assert.equal(result.time_complexity, "O(n)，因为只遍历一次数组")
  assert.equal(result.space_complexity, "O(1)，因为只用了两个变量")
  for (const value of [result.time_complexity, result.space_complexity]) {
    assert.ok(!/，[，,]/.test(value), `不应拼出重复标点：${value}`)
  }
})

test("边界值：加粗 / 无序号 / 英文括号别名都能被识别", () => {
  const raw = `**思路**：用双指针
**时间复杂度**：O(1) 因为它只做一次比较
**空间复杂度**：O(1) 因为只用了两个变量
`
  const result = parseSolutionResponse(raw, fallbacks, "zh")
  assert.ok(result.thoughts.some((t) => t.includes("双指针")))
  assert.match(result.time_complexity, /^O\(1\)/)
  assert.match(result.space_complexity, /^O\(1\)/)
})

// 复核给出的最小复现：全角括号 + 加粗，标题别名整段漏进正文
test("回归：全角括号 + 加粗的标题不把标题残渣漏进正文", () => {
  const raw =
    "**代码（Code）**\n```java\nx\n```\n" +
    "**思路（Thoughts）**\n中文全角括号版\n" +
    "**时间复杂度（Time Complexity）**\nO(n)\n" +
    "**空间复杂度（Space Complexity）**\nO(1)"
  const result = parseSolutionResponse(raw, fallbacks, "zh")
  assert.equal(result.code, "x")
  assert.deepEqual(result.thoughts, ["中文全角括号版"])
  assert.equal(result.time_complexity, "O(n)")
  assert.equal(result.space_complexity, "O(1)")
})

test("边界值：【】包裹的标题也被剥离", () => {
  const raw = `【思路】\n- 双指针夹逼\n【时间复杂度】\nO(n)\n【空间复杂度】\nO(1)\n`
  const result = parseSolutionResponse(raw, fallbacks, "zh")
  assert.deepEqual(result.thoughts, ["双指针夹逼"])
  assert.equal(result.time_complexity, "O(n)")
  assert.equal(result.space_complexity, "O(1)")
})

test("边界值：没有代码块时把整段响应当代码（与改动前行为一致）", () => {
  const result = parseSolutionResponse("就一段文字", fallbacks, "zh")
  assert.equal(result.code, "就一段文字")
})

test("sectionHeader：正则元字符被转义，不会因为标签含特殊字符而崩", () => {
  const pattern = new RegExp(sectionHeader(["O(n)", "时间复杂度"]), "i")
  assert.ok(pattern.test("时间复杂度："))
  assert.ok(pattern.test("O(n)："))
})

test("sectionHeader：半角/全角括号、序号、加粗、冒号都能匹配", () => {
  const pattern = new RegExp(`^(?:${sectionHeader(["思路", "Thoughts"])})$`)
  const cases = [
    "思路：",
    "思路:",
    "思路（Thoughts）：",
    "思路(Thoughts):",
    "**思路（Thoughts）**",
    "**思路(Thoughts)**:",
    "1. 思路 (Thoughts)：",
    "2、**思路**：",
    "### 思路（Thoughts）",
  ]
  for (const value of cases) {
    assert.ok(pattern.test(value), `应匹配：${value}`)
  }
})

// ---- 标题形态矩阵：半角/全角括号 × 有/无序号 × 有/无加粗 × 有/无冒号 ----

const BODY = {
  zh: {
    thoughts: "用哈希表存下标",
    time: "只遍历一次数组",
    space: "只用了两个变量",
    timeExpected: "O(n)，只遍历一次数组",
    spaceExpected: "O(1)，只用了两个变量",
  },
  en: {
    thoughts: "store indexes in a hashmap",
    time: "we visit each element once",
    space: "only two variables are used",
    timeExpected: "O(n) - we visit each element once",
    spaceExpected: "O(1) - only two variables are used",
  },
}

const LABELS = {
  zh: {
    thoughts: ["思路", "Thoughts"],
    time: ["时间复杂度", "Time Complexity"],
    space: ["空间复杂度", "Space Complexity"],
  },
  en: {
    thoughts: ["Thoughts", "Key Insights"],
    time: ["Time complexity", "Time Complexity"],
    space: ["Space complexity", "Space Complexity"],
  },
}

/** 按矩阵里的一组开关拼一个分节标题 */
function headerText(label, alias, variant) {
  const [open, close] = variant.fullWidthParen ? ["（", "）"] : ["(", ")"]
  let out = `${label}${open}${alias}${close}`
  if (variant.bold) out = `**${out}**`
  if (variant.numbered) out = `${variant.numbered}. ${out}`
  if (variant.colon) out += "："
  return out
}

function headerVariants() {
  const variants = []
  let numbered = 0
  for (const fullWidthParen of [false, true]) {
    for (const numbering of [false, true]) {
      for (const bold of [false, true]) {
        for (const colon of [false, true]) {
          variants.push({
            fullWidthParen,
            bold,
            colon,
            numbered: numbering ? ++numbered : 0,
          })
        }
      }
    }
  }
  return variants
}

test("标题矩阵：32 种标题形态（中英 × 16）都不留标题残渣", () => {
  const variants = headerVariants()
  assert.equal(variants.length, 16)

  for (const locale of ["zh", "en"]) {
    const body = BODY[locale]
    const labels = LABELS[locale]

    for (const variant of variants) {
      const desc = `${locale} ${JSON.stringify(variant)}`
      const raw = [
        headerText(labels.thoughts[0], labels.thoughts[1], variant),
        `- ${body.thoughts}`,
        headerText(labels.time[0], labels.time[1], { ...variant, numbered: 0 }),
        body.timeExpected,
        headerText(labels.space[0], labels.space[1], { ...variant, numbered: 0 }),
        body.spaceExpected,
      ].join("\n")

      const result = parseSolutionResponse(raw, fallbacks, locale)
      const thoughts = result.thoughts.join("\n")

      assert.ok(thoughts.includes(body.thoughts), `${desc} 思路正文缺失：${thoughts}`)
      assert.ok(
        !/[*#]|Thoughts|Key Insights|思路|\(|\)|（|）/.test(thoughts),
        `${desc} 思路里残留标题：${thoughts}`
      )
      assert.equal(result.time_complexity, body.timeExpected, `${desc} 时间复杂度`)
      assert.equal(result.space_complexity, body.spaceExpected, `${desc} 空间复杂度`)
      for (const value of [result.time_complexity, result.space_complexity]) {
        assert.ok(
          !/Time Complexity|Space Complexity|时间复杂度|空间复杂度|[*#]|（|）/.test(value),
          `${desc} 复杂度里残留标题：${value}`
        )
      }
    }
  }
})
