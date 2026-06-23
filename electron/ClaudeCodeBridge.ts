import { execFile, spawn } from "child_process"
import { promisify } from "util"
import type { ChildProcess } from "child_process"

const execFileAsync = promisify(execFile)

export interface ClaudeCodeStatus {
  installed: boolean
  authenticated: boolean
  email?: string
  subscriptionType?: string
  error?: string
}

const SYSTEM_PROMPT =
  "You are a coding interview assistant. Respond with exactly what is requested. Do not use any file system tools or reference the environment. Only output text based on the provided content."

export class ClaudeCodeBridge {
  private static activeProcess: ChildProcess | null = null

  static async getStatus(): Promise<ClaudeCodeStatus> {
    try {
      await execFileAsync("claude", ["--version"])
    } catch {
      return { installed: false, authenticated: false, error: "Claude Code CLI not found in PATH" }
    }

    try {
      const { stdout } = await execFileAsync("claude", ["auth", "status"])
      const status = JSON.parse(stdout.trim())
      return {
        installed: true,
        authenticated: status.loggedIn === true,
        email: status.email,
        subscriptionType: status.subscriptionType,
        error: status.loggedIn ? undefined : "Not authenticated — run `claude auth login`"
      }
    } catch {
      return { installed: true, authenticated: false, error: "Could not determine authentication status" }
    }
  }

  static async sendMessage(
    prompt: string,
    model: string,
    imageDataList?: string[]
  ): Promise<string> {
    const content: object[] = [{ type: "text", text: prompt }]

    if (imageDataList && imageDataList.length > 0) {
      for (const data of imageDataList) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/png", data }
        })
      }
    }

    const inputLine = JSON.stringify({
      type: "user",
      message: { role: "user", content }
    })

    return new Promise((resolve, reject) => {
      const proc = spawn("claude", [
        "--print",
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--verbose",
        "--model", model,
        "--no-session-persistence",
        "--system-prompt", SYSTEM_PROMPT
      ])

      ClaudeCodeBridge.activeProcess = proc

      const timeoutHandle = setTimeout(() => {
        proc.kill()
        reject(new Error("Claude Code request timed out after 60 seconds"))
      }, 60000)

      let stdout = ""
      let stderr = ""

      proc.stdout.on("data", (d: Buffer) => { stdout += d.toString() })
      proc.stderr.on("data", (d: Buffer) => { stderr += d.toString() })

      proc.on("close", (code: number | null) => {
        clearTimeout(timeoutHandle)
        ClaudeCodeBridge.activeProcess = null

        if (code !== 0 && code !== null) {
          const errMsg = stderr.trim().slice(0, 500)
          reject(new Error(`Claude Code failed (exit ${code}): ${errMsg}`))
          return
        }

        for (const line of stdout.split("\n")) {
          try {
            const d = JSON.parse(line)
            if (d.type === "result" && d.subtype === "success") {
              resolve(d.result as string)
              return
            }
          } catch { /* skip non-JSON lines */ }
        }

        reject(new Error("No result found in Claude Code output"))
      })

      proc.stdin.write(inputLine + "\n")
      proc.stdin.end()
    })
  }

  static cancelActive(): void {
    if (ClaudeCodeBridge.activeProcess) {
      ClaudeCodeBridge.activeProcess.kill()
      ClaudeCodeBridge.activeProcess = null
    }
  }
}
