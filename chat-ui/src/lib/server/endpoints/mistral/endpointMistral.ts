import { z } from "zod";
import { openAIChatToTextGenerationStream } from "../openai/openAIChatToTextGenerationStream";
import { MISTRAL_API_KEY } from "$env/static/private";
import type { Endpoint } from "../endpoints";

export const endpointMistralParametersSchema = z.object({
    weight: z.number().int().positive().default(1),
    model: z.any(),
    type: z.literal("mistral"),
    apiKey: z.string().default(MISTRAL_API_KEY ?? "sk-"),
    completion: z.literal("chat_completions").default("chat_completions"),
});

export async function endpointMistral(
    input: z.input<typeof endpointMistralParametersSchema>
): Promise<Endpoint> {
    const { apiKey, completion, model } = endpointMistralParametersSchema.parse(input);
    let MistralClient;
    try {
        MistralClient = (await import("@mistralai/mistralai")).default;
    } catch (e) {
        throw new Error("Failed to import MistralAI", { cause: e });
    }

    const mistralai = new MistralClient(apiKey ?? "sk-");

    if (completion === "chat_completions") {
        return async ({ conversation }) => {
            let messages = conversation.messages;
            const parameters = { ...model.parameters, ...conversation.parameters };

            const messagesMistralAI = messages.map((message) => ({
                role: message.from,
                content: message.content,
            }));

            return openAIChatToTextGenerationStream(
                await mistralai.chatStream({
                    model: model.id ?? model.name,
                    messages: conversation.preprompt
                        ? [{ role: "system", content: conversation.preprompt }, ...messagesMistralAI]
                        : messagesMistralAI,
                    stream: true,
                    maxTokens: parameters?.max_new_tokens,
                    temperature: parameters?.temperature,
                    topP: parameters?.top_p,
                    safeMode: false,
                })
            );
        };
    }
    else {
        throw new Error("Invalid completion type");
    }
}
