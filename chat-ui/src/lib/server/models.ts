import {
	HF_TOKEN,
	HF_API_ROOT,
	MODELS,
	OLD_MODELS,
	HF_ACCESS_TOKEN,
	CONFIGURABLE_PARAMETERS,
} from "$env/static/private";
import type { ChatTemplateInput } from "$lib/types/Template";
import { compileTemplate } from "$lib/utils/template";
import { z } from "zod";
import endpoints, { endpointSchema, type Endpoint } from "./endpoints/endpoints";
import endpointTgi from "./endpoints/tgi/endpointTgi";
import { sum } from "$lib/utils/sum";
import { ta } from "date-fns/locale";

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

const modelConfig = z.object({
	/** Used as an identifier in DB */
	id: z.string().optional(),
	/** Used to link to the model page, and for inference */
	name: z.string().min(1),
	displayName: z.string().min(1).optional(),
	shortName: z.string().min(1).optional(),
	description: z.string().min(1).optional(),
	websiteUrl: z.string().url().optional(),
	modelUrl: z.string().url().optional(),
	datasetName: z.string().min(1).optional(),
	datasetUrl: z.string().url().optional(),
	userMessageToken: z.string().default(""),
	userMessageEndToken: z.string().default(""),
	assistantMessageToken: z.string().default(""),
	assistantMessageEndToken: z.string().default(""),
	messageEndToken: z.string().default(""),
	preprompt: z.string().default(""),
	prepromptUrl: z.string().url().optional(),
	chatPromptTemplate: z
		.string()
		.default(
			"{{preprompt}}" +
			"{{#each messages}}" +
			"{{#ifUser}}{{@root.userMessageToken}}{{content}}{{@root.userMessageEndToken}}{{/ifUser}}" +
			"{{#ifAssistant}}{{@root.assistantMessageToken}}{{content}}{{@root.assistantMessageEndToken}}{{/ifAssistant}}" +
			"{{/each}}" +
			"{{assistantMessageToken}}"
		),
	promptExamples: z
		.array(
			z.object({
				title: z.string().min(1),
				prompt: z.string().min(1),
			})
		)
		.optional()
		.default([{ "title": "Vegan recipe", "prompt": "Write a recipe for a vegan dinner with black beans as one of ingredients" }, { "title": "Tea infuser cleaning", "prompt": "What is the best way to clean tea infuser heavily stained by tea?" }, { "title": "Coding task", "prompt": "Code a function to check if parentheses, brackets and curly braces are balanced in given string in Python" }]),
	endpoints: z.array(endpointSchema).optional(),
	parameters: z
		.object({
			temperature: z.number().min(0).max(1),
			truncate: z.number().int().positive().optional(),
			max_new_tokens: z.number().int().positive(),
			stop: z.array(z.string()).optional(),
			top_p: z.number().positive().optional(),
			top_k: z.number().positive().optional(),
			min_p: z.number().positive().optional(),
			repetition_penalty: z.number().min(-2).max(2).optional(),
			penalize_newline: z.boolean().optional(),
		})
		.passthrough()
		.optional(),
	multimodal: z.boolean().default(false),
	unlisted: z.boolean().default(false),
});

const modelsRaw = z.array(modelConfig).parse(JSON.parse(MODELS));

const processModel = async (m: z.infer<typeof modelConfig>) => ({
	...m,
	userMessageEndToken: m?.userMessageEndToken || m?.messageEndToken,
	assistantMessageEndToken: m?.assistantMessageEndToken || m?.messageEndToken,
	chatPromptRender: compileTemplate<ChatTemplateInput>(m.chatPromptTemplate, m),
	id: m.id || m.name,
	displayName: m.displayName || m.name,
	preprompt: m.prepromptUrl ? await fetch(m.prepromptUrl).then((r) => r.text()) : m.preprompt,
	parameters: { ...m.parameters, stop_sequences: m.parameters?.stop },
});

const addEndpoint = (m: Awaited<ReturnType<typeof processModel>>) => ({
	...m,
	getEndpoint: async (): Promise<Endpoint> => {
		if (!m.endpoints) {
			return endpointTgi({
				type: "tgi",
				url: `${HF_API_ROOT}/${m.name}`,
				accessToken: HF_TOKEN ?? HF_ACCESS_TOKEN,
				weight: 1,
				model: m,
			});
		}
		const totalWeight = sum(m.endpoints.map((e) => e.weight));

		let random = Math.random() * totalWeight;

		for (const endpoint of m.endpoints) {
			if (random < endpoint.weight) {
				const args = { ...endpoint, model: m };

				switch (args.type) {
					case "tgi":
						return endpoints.tgi(args);
					case "aws":
						return await endpoints.aws(args);
					case "openai":
						return await endpoints.openai(args);
					case "llamacpp":
						return endpoints.llamacpp(args);
					case "ollama":
						return endpoints.ollama(args);
					case "mistral":
						return endpoints.mistral(args);
					default:
						// for legacy reason
						return endpoints.tgi(args);
				}
			}
			random -= endpoint.weight;
		}

		throw new Error(`Failed to select endpoint`);
	},
});

export const models = await Promise.all(modelsRaw.map((e) => processModel(e).then(addEndpoint)));

export const defaultModel = models[0];

const confParameterSchema = z.object({
	id: z.string(),
	label: z.string(),
	min: z.number(),
	max: z.number(),
	step: z.number(),
	endpoints: z.array(z.string()),
});
export const configurableParameters = z.array(confParameterSchema).parse(JSON.parse(CONFIGURABLE_PARAMETERS));

// Models that have been deprecated
export const oldModels = OLD_MODELS
	? z
		.array(
			z.object({
				id: z.string().optional(),
				name: z.string().min(1),
				displayName: z.string().min(1).optional(),
			})
		)
		.parse(JSON.parse(OLD_MODELS))
		.map((m) => ({ ...m, id: m.id || m.name, displayName: m.displayName || m.name }))
	: [];

export const validateModel = (_models: BackendModel[]) => {
	// Zod enum function requires 2 parameters
	return z.enum([_models[0].id, ..._models.slice(1).map((m) => m.id)]);
};

// use local model for summarization but with different parameters
let taskModel = modelsRaw.find((m) => m.shortName === process.env.MODEL) ?? modelsRaw[0];
taskModel.parameters = {
	...taskModel?.parameters,
	temperature: 0.1,
	top_p: 0.95,
	max_new_tokens: 32,
	truncate: 1024,
	repetition_penalty: 1.2,
	stop: [...taskModel?.parameters?.stop ?? [], "\n"]
};
export const smallModel = await processModel(taskModel).then(addEndpoint);


export type BackendModel = Optional<
	typeof defaultModel,
	"preprompt" | "parameters" | "multimodal" | "unlisted"
>;

export type ConfigurableParameter = z.infer<typeof confParameterSchema>;