/**
 * Shared reporting utilities for test scripts.
 * Handles colored terminal output and JSON result export.
 */

import chalk from "chalk"
import * as fs from "fs"
import * as path from "path"

export interface TestResult {
  name: string
  passed: boolean
  details?: string
  duration?: number
  data?: any
}

/**
 * Measure execution time of an async function.
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now()
  const result = await fn()
  return { result, durationMs: Date.now() - start }
}

/**
 * Print a summary table of test results.
 */
export function printSummary(scriptName: string, results: TestResult[]) {
  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed

  console.log(chalk.bold.cyan("\n========================================"))
  console.log(chalk.bold.cyan(`  ${scriptName} — Summary`))
  console.log(chalk.bold.cyan("========================================\n"))

  for (const r of results) {
    const icon = r.passed ? chalk.green("PASS") : chalk.red("FAIL")
    const time = r.duration ? chalk.gray(` (${r.duration}ms)`) : ""
    console.log(`  ${icon}  ${r.name}${time}`)
    if (r.details && !r.passed) {
      console.log(chalk.yellow(`        ${r.details}`))
    }
  }

  console.log("")
  console.log(`  Total: ${results.length}`)
  console.log(chalk.green(`  Passed: ${passed}`))
  if (failed > 0) {
    console.log(chalk.red(`  Failed: ${failed}`))
  }
  console.log(
    `  Success rate: ${((passed / results.length) * 100).toFixed(1)}%\n`
  )

  if (failed > 0) {
    console.log(chalk.bold.red("Some tests failed. Review the output above.\n"))
  } else {
    console.log(chalk.bold.green("All tests passed!\n"))
  }
}

/**
 * Save results to a JSON file in the results/ directory.
 */
export function saveResults(prefix: string, data: any) {
  const resultsDir = path.join(__dirname, "..", "results")
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/:/g, "-")
  const filename = path.join(resultsDir, `${prefix}-${timestamp}.json`)

  fs.writeFileSync(filename, JSON.stringify(data, null, 2))
  console.log(chalk.gray(`Results saved to: ${filename}\n`))
}

/**
 * Deep compare two objects and return differences.
 */
export function deepCompare(obj1: any, obj2: any, path: string = "root"): any[] {
  const differences: any[] = []

  if (typeof obj1 !== typeof obj2) {
    differences.push({ path, type: "type_mismatch", old: typeof obj1, new: typeof obj2 })
    return differences
  }

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) {
      differences.push({
        path,
        type: "array_length",
        old: obj1.length,
        new: obj2.length,
      })
    }
    const minLen = Math.min(obj1.length, obj2.length)
    for (let i = 0; i < minLen; i++) {
      differences.push(...deepCompare(obj1[i], obj2[i], `${path}[${i}]`))
    }
  } else if (typeof obj1 === "object" && obj1 !== null && obj2 !== null) {
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])
    for (const key of allKeys) {
      if (!(key in obj1)) {
        differences.push({ path: `${path}.${key}`, type: "missing_in_old", new: obj2[key] })
      } else if (!(key in obj2)) {
        differences.push({ path: `${path}.${key}`, type: "missing_in_new", old: obj1[key] })
      } else {
        differences.push(...deepCompare(obj1[key], obj2[key], `${path}.${key}`))
      }
    }
  } else if (obj1 !== obj2) {
    differences.push({ path, type: "value_mismatch", old: obj1, new: obj2 })
  }

  return differences
}
