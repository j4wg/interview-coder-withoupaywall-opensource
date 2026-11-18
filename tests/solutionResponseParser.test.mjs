// `electron/solutionResponseParser.ts` 单测：零新依赖，直接跑 tsc 产物（`dist-electron`）。
// 覆盖点：中文返回 / 英文返回的结构化抽取（正常路径）、缺分节时的兜底（错误路径）、
// 行内复杂度与无 O() 标记的边界值。
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
  const result = parseSolutionResponse(zhResponse, fallbacks)
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
  const result = parseSolutionResponse(enResponse, fallbacks)
  assert.match(result.code, /class Solution/)
  assert.ok(result.thoughts.length >= 2)
  assert.match(result.thoughts.join("\n"), /hashmap/)
  assert.match(result.time_complexity, /^O\(n\)/)
  assert.match(result.time_complexity, /we iterate the array only once/)
  assert.match(result.space_complexity, /^O\(n\)/)
})

test("错误路径：没有分节标题时全部退回兜底文案，且不抛错", () => {
  const result = parseSolutionResponse("这是一段没有结构的回答。", fallbacks)
  assert.deepEqual(result.thoughts, ["FALLBACK_THOUGHTS"])
  assert.equal(result.time_complexity, "FALLBACK_TIME")
  assert.equal(result.space_complexity, "FALLBACK_SPACE")
  assert.equal(result.code, "这是一段没有结构的回答。")
})

test("错误路径：空串与非字符串输入不抛错", () => {
  assert.doesNotThrow(() => parseSolutionResponse("", fallbacks))
  const result = parseSolutionResponse(undefined, fallbacks)
  assert.deepEqual(result.thoughts, ["FALLBACK_THOUGHTS"])
})

test("边界值：复杂度缺 O() 标记时补上 O(n) 前缀", () => {
  const raw = `2. 思路 (Thoughts)：
- 遍历一次
3. 时间复杂度 (Time Complexity)：线性，只遍历一次数组。
4. 空间复杂度 (Space Complexity)：常数，只用了几个变量。
`
  const result = parseSolutionResponse(raw, fallbacks)
  assert.equal(result.time_complexity, "O(n) - 线性，只遍历一次数组。")
  assert.equal(result.space_complexity, "O(n) - 常数，只用了几个变量。")
})

test("边界值：加粗 / 无序号 / 英文括号别名都能被识别", () => {
  const raw = `**思路**：用双指针
**时间复杂度**：O(1) 因为它只做一次比较
**空间复杂度**：O(1) 因为只用了两个变量
`
  const result = parseSolutionResponse(raw, fallbacks)
  assert.ok(result.thoughts.some((t) => t.includes("双指针")))
  assert.match(result.time_complexity, /^O\(1\)/)
  assert.match(result.space_complexity, /^O\(1\)/)
})

test("边界值：没有代码块时把整段响应当代码（与改动前行为一致）", () => {
  const result = parseSolutionResponse("就一段文字", fallbacks)
  assert.equal(result.code, "就一段文字")
})

test("sectionHeader：正则元字符被转义，不会因为标签含特殊字符而崩", () => {
  const pattern = new RegExp(sectionHeader(["O(n)", "时间复杂度"]), "i")
  assert.ok(pattern.test("时间复杂度："))
  assert.ok(pattern.test("O(n)："))
})
