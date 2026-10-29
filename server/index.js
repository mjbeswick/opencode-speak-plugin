import { spawn } from "node:child_process"

const SAY_PATH = "/usr/bin/say"
const MAX_TEXT_CHARACTERS = 240
const SPEECH_TIMEOUT_MS = 30_000

function normalizeText(value) {
  if (typeof value !== "string") throw new Error("Text must be a string.")
  const text = value.replace(/\s+/gu, " ").trim()
  if (!text) throw new Error("Text must not be empty.")
  if (Array.from(text).length > MAX_TEXT_CHARACTERS) {
    throw new Error(`Text must be ${MAX_TEXT_CHARACTERS} characters or fewer.`)
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    throw new Error("Text contains unsupported control characters.")
  }
  return text
}

function speakLocally(text, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Speech was cancelled."))
      return
    }

    const child = spawn(SAY_PATH, [], {
      shell: false,
      stdio: ["pipe", "ignore", "ignore"],
      env: { PATH: "/usr/bin:/bin" },
      windowsHide: true,
    })
    let settled = false
    let timedOut = false
    let killTimer
    const timeout = setTimeout(() => {
      timedOut = true
      terminate()
    }, SPEECH_TIMEOUT_MS)

    function finish(error) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearTimeout(killTimer)
      signal.removeEventListener("abort", onAbort)
      if (error) reject(error)
      else resolve()
    }

    function terminate() {
      child.kill("SIGTERM")
      killTimer = setTimeout(() => child.kill("SIGKILL"), 1_000)
    }

    function onAbort() {
      terminate()
    }

    signal.addEventListener("abort", onAbort, { once: true })
    child.once("error", () => finish(new Error("Could not start macOS text-to-speech.")))
    child.once("close", (code) => {
      if (timedOut) finish(new Error("macOS text-to-speech exceeded its 30-second limit."))
      else if (signal.aborted) finish(new Error("Speech was cancelled."))
      else if (code === 0) finish()
      else finish(new Error("macOS text-to-speech failed."))
    })
    child.stdin.once("error", () => finish(new Error("Could not send text to macOS text-to-speech.")))
    child.stdin.end(text, "utf8")
  })
}

// The V2 Plugin.define helper returns this definition unchanged; exporting it
// directly keeps this local plugin independent of an SDK runtime dependency.
export default {
  id: "opencode-speak",
  async setup(ctx) {
    const registration = await ctx.tool.transform((editor) => {
      editor.add({
        name: "say_text",
        description:
          "Speak up to 240 characters locally with macOS /usr/bin/say. Use only when the user explicitly requests speech and the native speak tool is unavailable or failing. This asks the user for permission every time. Never use for routine updates or sensitive/private text.",
        input: {
          type: "object",
          properties: {
            text: { type: "string", minLength: 1, maxLength: MAX_TEXT_CHARACTERS },
          },
          required: ["text"],
          additionalProperties: false,
        },
        execute: async ({ text }, context) => {
          const safeText = normalizeText(text)
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "say_text",
            resources: ["local"],
            save: [],
            metadata: {
              title: "Allow local macOS speech?",
              detail: "Speak the supplied text using /usr/bin/say on this Mac (no network or shell).",
            },
          })
          await speakLocally(safeText, context.signal)
          return { content: "Spoken locally with macOS text-to-speech." }
        },
      })
    })
    return () => registration.dispose()
  },
}
