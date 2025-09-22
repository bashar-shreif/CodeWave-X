export const agentConfig = {
  useLLM: process.env.AGENT_USE_LLM === "1",
  maxRepairLoops: 2,
  stepTimeoutMs: 10_000,
  sectionCharCap: 600,
  bannedPhrases: [/probably/i, /guess/i],
} as const;