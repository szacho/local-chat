<script lang="ts">
	import { page } from "$app/stores";
	import { base } from "$app/paths";
	import { PUBLIC_APP_COLOR } from "$env/static/public";
	import type { BackendModel, ConfigurableParameter } from "$lib/server/models";
	import { useSettingsStore } from "$lib/stores/settings";
	import CarbonArrowUpRight from "~icons/carbon/arrow-up-right";

	const settings = useSettingsStore();
	const configurableParameters: Array<ConfigurableParameter> = $page.data.configurableParameters;

	$: model = $page.data.models.find((el: BackendModel) => el.id === $page.params.model);

	$: if ($settings.customPrompts[$page.params.model] === undefined) {
		$settings.customPrompts = {
			...$settings.customPrompts,
			[$page.params.model]: model?.preprompt || "",
		};
	}

	$: hasCustomPreprompt = $settings.customPrompts[$page.params.model] !== model?.preprompt;

	$: isActive = $settings.activeModel === $page.params.model;
	$: isAvailable =
		!isActive && (model?.id === $settings.loadedModel || model?.endpoints[0].type !== "llamacpp");

	$: if ($settings.customParameters[$page.params.model] === undefined) {
		$settings.customParameters = {
			...$settings.customParameters,
			[$page.params.model]: { ...model?.parameters } || {},
		};
	}

	$: hasCustomParameters = !Object.keys($settings.customParameters[$page.params.model]).every(
		(key: string) => {
			if (key.includes("stop")) {
				return true;
			}

			return $settings.customParameters[$page.params.model][key] === model?.parameters[key];
		}
	);
</script>

<div class="flex flex-col items-start pl-2 pr-2">
	<div class="mb-5 flex flex-col gap-1.5">
		<h2 class="text-lg font-semibold md:text-xl">
			{$page.params.model}
		</h2>

		{#if model.description}
			<p class=" text-gray-600">
				{model.description}
			</p>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-2 md:gap-4">
		<a
			href={model.modelUrl || "https://huggingface.co/" + model.name}
			target="_blank"
			rel="noreferrer"
			class="flex items-center truncate underline underline-offset-2"
		>
			<CarbonArrowUpRight class="mr-1.5 shrink-0 text-xs " />
			Model page
		</a>

		{#if model.datasetName || model.datasetUrl}
			<a
				href={model.datasetUrl || "https://huggingface.co/datasets/" + model.datasetName}
				target="_blank"
				rel="noreferrer"
				class="flex items-center truncate underline underline-offset-2"
			>
				<CarbonArrowUpRight class="mr-1.5 shrink-0 text-xs " />
				Dataset page
			</a>
		{/if}

		{#if model.websiteUrl}
			<a
				href={model.websiteUrl}
				target="_blank"
				class="flex items-center truncate underline underline-offset-2"
				rel="noreferrer"
			>
				<CarbonArrowUpRight class="mr-1.5 shrink-0 text-xs " />
				Model website
			</a>
		{/if}
	</div>

	<button
		class="{!isAvailable
			? 'bg-gray-100'
			: 'bg-black text-white'} my-8 flex items-center rounded-full px-3 py-1"
		disabled={!isAvailable}
		name="Activate model"
		on:click|stopPropagation={() => {
			$settings.activeModel = $page.params.model;
		}}
	>
		{isActive ? "Active model" : "Activate"}
	</button>

	<div class="flex w-full flex-col gap-2">
		<div class="flex w-full flex-row content-between">
			<h3 class="mb-1.5 text-lg font-semibold text-gray-800">System Prompt</h3>
			{#if hasCustomPreprompt}
				<button
					class="ml-auto underline decoration-gray-300 hover:decoration-gray-700"
					on:click|stopPropagation={() =>
						($settings.customPrompts[$page.params.model] = model.preprompt)}
				>
					Reset
				</button>
			{/if}
		</div>
		<textarea
			rows="8"
			class="mb-3 w-full resize-none rounded-md border-2 bg-gray-100 p-2 accent-{PUBLIC_APP_COLOR}-500"
			bind:value={$settings.customPrompts[$page.params.model]}
		/>

		<div class="flex w-full flex-row content-between">
			<h3 class="mb-1.5 text-lg font-semibold text-gray-800">Parameters</h3>
			{#if hasCustomParameters}
				<button
					class="ml-auto underline decoration-gray-300 hover:decoration-gray-700"
					on:click|stopPropagation={() =>
						($settings.customParameters[$page.params.model] = { ...model.parameters })}
				>
					Reset
				</button>
			{/if}
		</div>

		<div class="flex w-full flex-row content-between">
			<div class="flex w-full justify-between">
				<div class="flex w-full flex-wrap">
					{#each Object.values(configurableParameters) as param}
						{#if param.endpoints.includes(model.endpoints[0].type)}
							<div class="mb-2 w-1/2">
								<label for={param.id} class="block text-sm font-medium text-gray-700"
									>{param.label}</label
								>
								<div class="flex items-center justify-between">
									<input
										id={param.id}
										type="range"
										min={param.min}
										max={param.max}
										step={param.step}
										bind:value={$settings.customParameters[$page.params.model][param.id]}
										class="w-5/6 accent-{PUBLIC_APP_COLOR}-500"
									/>
									<input
										type="number"
										min={param.min}
										max={param.max}
										step={param.step}
										bind:value={$settings.customParameters[$page.params.model][param.id]}
										class="mx-2 w-1/6 accent-{PUBLIC_APP_COLOR}-500 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									/>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
