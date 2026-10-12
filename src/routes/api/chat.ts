import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { findEncounter, encounterToBrief } from "@/data/encounters";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id";

const BASE_PROMPT = `You are the Raid: Shadow Legends Tactical Coach — a decisive, mid/late-game second-screen coach.
Style: direct, step-by-step, numbered actions. Use concrete numbers (True Speed, ACC, RES, HP, DEF, EHP, turn meter %).
Always cover, when relevant: what wipes teams here, kill priority, mandatory mechanics, stat checkpoints, turn order,
Auto AI skill presets (Opener / Priority 1 / Disabled per champion), gear "build 1st" order (debuffers/speed-setters before nukers),
and safe gear stripping (pull from vaulted/benched champions; never strip the player's locked Core team unless asked).
When the player lacks a champion, propose substitutes by role and state stat compensations.
For "why did I wipe" questions, diagnose the likely cause first, then give the fix.
If you are unsure about a precise community number, say it is an approximate benchmark. Keep answers scannable with markdown headings and lists.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("AI coach is not configured.", { status: 500 });

        const body = (await request.json()) as {
          messages: UIMessage[];
          stageId?: string;
          roster?: string;
        };
        const enc = body.stageId ? findEncounter(body.stageId) : undefined;
        const instructions = [
          BASE_PROMPT,
          enc ? `\n## Encounter currently open on screen\n${encounterToBrief(enc)}` : "",
          body.roster?.trim()
            ? `\n## Player's roster & gear notes (use for substitutions and gear plans)\n${body.roster.slice(0, 6000)}`
            : "",
        ].join("\n");

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions,
          messages: await convertToModelMessages(body.messages),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return withLovableAiGatewayRunIdHeader(
          result.toUIMessageStreamResponse({
            sendReasoning: true,
            onError: (e) => {
              const msg = e instanceof Error ? e.message : String(e);
              if (msg.includes("402")) return "AI credits are exhausted. Add credits in workspace settings.";
              if (msg.includes("429")) return "Coach is rate limited — wait a moment and try again.";
              return "The coach hit an error. Please try again.";
            },
          }),
          runIdFetch,
        );
      },
    },
  },
});
