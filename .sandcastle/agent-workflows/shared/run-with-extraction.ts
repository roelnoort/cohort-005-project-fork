import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  run,
  type OutputObjectDefinition,
  type RunOptions,
  type RunResult,
} from "@ai-hero/sandcastle";

export type RunWithExtractionOptions<T> = Omit<RunOptions, "output"> & {
  readonly output: OutputObjectDefinition<T>;
  readonly extractionPrompt: string;
  /**
   * Extra attempts after the first if extraction or validation fails. Forwarded
   * to `Output`'s built-in `maxRetries`, which resumes the extraction session
   * and feeds back the error so the agent can re-emit a corrected tag.
   * Default: `2` (three attempts total). Ignored when the agent can't resume.
   */
  readonly maxRetries?: number;
};

// Ends the first pass. Without it the pass ends only when the agent process
// exits, and a process the agent started (a dev server, a browser, a
// subagent) can keep it from exiting: explore run 44311307370 wrote its whole
// plan, then sat silent until the 10-minute idle timeout failed the batch.
// Once Sandcastle sees the signal, `completionTimeoutSeconds` (default 60)
// force-completes the pass if the process still hangs on. Sandcastle matches
// it only in the agent's own text, never in tool calls, so a subagent brief
// that quotes it does not end the pass.
const PRODUCE_DONE_SIGNAL = "<promise>PRODUCE DONE</promise>";

const PRODUCE_DONE_INSTRUCTIONS = [
  "When the task above is done, stop every process you started, then end your final message with this exact line:",
  "",
  PRODUCE_DONE_SIGNAL,
  "",
  "Write it only in that last message, never earlier, and never in a brief for a subagent.",
].join("\n");

const singlePassInstructions = (extractionPrompt: string) =>
  [
    "When the task above is done, end with this final message. These rules bind that message only.",
    "",
    extractionPrompt,
  ].join("\n");

// Two passes over one session. The first run does the work with the whole
// toolset. The second resumes that session and asks only for the structured
// output, so the answer is extracted from everything the first run read.
export async function runWithExtraction<T>(
  options: RunWithExtractionOptions<T>
): Promise<RunResult & { output: T }> {
  const {
    output,
    extractionPrompt,
    maxRetries = 2,
    ...produceOptions
  } = options;

  // Agents that can't resume a session (a custom provider with no session
  // storage; every built-in agent can) get no second pass and no retries, so
  // they emit the structured output at the end of the work itself.
  if (!produceOptions.agent.sessionStorage) {
    return run({
      ...produceOptions,
      ...appendToPrompt(
        produceOptions,
        singlePassInstructions(extractionPrompt)
      ),
      output: { ...output, maxRetries: 0 },
    });
  }

  const produce = await run({
    ...produceOptions,
    ...appendToPrompt(produceOptions, PRODUCE_DONE_INSTRUCTIONS),
    completionSignal: PRODUCE_DONE_SIGNAL,
  });
  const sessionId = produce.iterations.at(-1)?.sessionId;
  if (!sessionId) {
    throw new Error(
      "Cannot extract structured output because the produce run had no session id."
    );
  }

  const extracted = await extract<T>(produceOptions, sessionId, {
    prompt: extractionPrompt,
    output: { ...output, maxRetries },
  });

  return { ...produce, output: extracted };
}

// The second pass. It does not get PRODUCE_DONE_SIGNAL: it keeps the caller's
// completion signal (Sandcastle's default when there is none), because the
// extraction prompt ends with the output tag, not with the done line.
async function extract<T>(
  produceOptions: Omit<RunOptions, "output">,
  sessionId: string,
  extraction: { prompt: string; output: OutputObjectDefinition<T> }
): Promise<T> {
  const { promptArgs: _promptArgs, ...extractionOptions } = produceOptions;
  const result = await run({
    ...extractionOptions,
    name: produceOptions.name ? `${produceOptions.name} (extract)` : undefined,
    promptFile: undefined,
    prompt: extraction.prompt,
    resumeSession: sessionId,
    output: extraction.output,
  });
  return result.output;
}

// A prompt file is copied with the instructions appended, so `promptArgs`
// substitution still applies to it.
const appendToPrompt = (
  options: Pick<RunOptions, "prompt" | "promptFile">,
  instructions: string
): Pick<RunOptions, "prompt" | "promptFile"> => {
  const suffix = `\n\n${instructions}`;

  if (options.promptFile === undefined) {
    return { prompt: `${options.prompt ?? ""}${suffix}` };
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "run-with-extraction-"));
  const promptFile = path.join(dir, path.basename(options.promptFile));
  fs.writeFileSync(
    promptFile,
    `${fs.readFileSync(options.promptFile, "utf8")}${suffix}`
  );
  return { promptFile };
};
