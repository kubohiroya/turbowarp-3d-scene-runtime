import { sceneSchemaBundles, sceneSchemaBundles as sceneSchemaBundles$1, validateSceneDocumentInput, validateSceneExtensionInput } from "@kubohiroya/turbowarp-scene-graph/editor-schema";
import { parse } from "yaml";
import { createTurboWarpExtensionPlan } from "@kubohiroya/turbowarp-scene-graph";
var extensionConfig = {
	id: "kubohiroya3dsceneruntime",
	slug: "3d-scene-runtime",
	name: "TurboWarp-3D-Scene-Runtime",
	description: "Applies a 3D/AR scene description by dispatching its call plan to turbowarp-aframe and turbowarp-ar.",
	author: "Hiroya Kubo",
	license: "MPL-2.0",
	unsandboxed: true,
	docsURI: "https://kubohiroya.github.io/turbowarp-3d-scene-runtime/",
	blockIconURI: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZD0iTTI0IDZsMTYgOXYxOGwtMTYgOS0xNi05VjE1eiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNEM5N0ZGIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMjQgMjR2MThNMjQgMjRsMTYtOU0yNCAyNEw4IDE1IiBzdHJva2U9IiM1OUMwNTkiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg=="
};
/** Same branch selection as runtime planFor, with raw source/data retained. */
function decodeSceneSource(source) {
	const trimmed = source.trim();
	if (trimmed.length === 0) return {
		kind: "empty",
		source,
		variantId: "empty"
	};
	const data = parse(trimmed);
	if (typeof data !== "object" || data === null || Array.isArray(data)) throw new TypeError("3D scene description must be a YAML or JSON object.");
	const keys = Object.keys(data);
	const variantId = keys.includes("scene3d") || keys.includes("ar") ? "wrapper" : "bare";
	let format = "yaml";
	try {
		JSON.parse(trimmed);
		format = "json";
	} catch {}
	return {
		kind: "decoded",
		source,
		data,
		format,
		variantId
	};
}
/** Headless adapter: empty source is a no-op; no runtime capability is inspected. */
function validateSceneSource(source, context) {
	let decoded;
	try {
		decoded = decodeSceneSource(source);
	} catch {
		let consumerId;
		try {
			const descriptor = Object.getOwnPropertyDescriptor(context, "consumerId");
			if (descriptor && "value" in descriptor && typeof descriptor.value === "string") consumerId = descriptor.value;
		} catch {}
		return {
			source,
			kind: "decode-error",
			result: {
				kind: "invalid",
				diagnostics: [{
					scope: {
						identity: sceneSchemaBundles.bare.identity,
						...consumerId === void 0 ? {} : { consumerId }
					},
					phase: "decode",
					code: "input-format-invalid",
					dataPath: ""
				}]
			}
		};
	}
	if (decoded.kind === "empty") return {
		...decoded,
		result: {
			kind: "valid",
			diagnostics: []
		}
	};
	const identity = sceneSchemaBundles[decoded.variantId].identity;
	let consumerId;
	try {
		const descriptors = Object.getOwnPropertyDescriptors(context);
		if (typeof descriptors.consumerId?.value !== "string" || typeof descriptors.nowMs?.value !== "number" || !Number.isFinite(descriptors.nowMs.value) || !descriptors.settings || !("value" in descriptors.settings)) throw new TypeError();
		consumerId = descriptors.consumerId.value;
	} catch {
		const result = {
			kind: "execution-error",
			diagnostics: [{
				scope: { identity },
				phase: "execution",
				operation: "semantic",
				code: "owner-context-invalid"
			}]
		};
		return {
			...decoded,
			result
		};
	}
	const scope = {
		identity,
		consumerId
	};
	const ownerResult = (decoded.variantId === "bare" ? validateSceneDocumentInput : validateSceneExtensionInput)(decoded.data, context);
	const result = ownerResult.kind === "valid" ? {
		kind: "valid",
		diagnostics: []
	} : {
		kind: "invalid",
		diagnostics: ownerResult.issues.map((issue) => ({
			scope,
			phase: "semantic",
			code: "owner-input-invalid",
			dataPath: issue.dataPath,
			ruleId: issue.ruleId
		}))
	};
	return {
		...decoded,
		result
	};
}
function checkedSource(value) {
	return value.result.kind === "valid" ? {
		source: value.source,
		result: {
			kind: "valid",
			diagnostics: []
		}
	} : {
		source: value.source,
		result: {
			kind: value.result.kind,
			diagnostics: value.result.diagnostics
		}
	};
}
function createSourceEditorOptions(nowMs = Date.now) {
	const context = () => ({
		consumerId: extensionConfig.id,
		nowMs: nowMs(),
		settings: null
	});
	return [{
		apiVersion: 1,
		extensionId: extensionConfig.id,
		editorId: "scene-source",
		opcodes: ["applyScene"].map((opcode) => `${extensionConfig.id}_${opcode}`),
		bindings: [{
			argument: "SOURCE",
			sourceOnlyVariants: [{
				variantId: "empty",
				format: "yaml"
			}],
			variants: Object.entries(sceneSchemaBundles$1).flatMap(([variantId, schemaBundle]) => ["json", "yaml"].map((format) => ({
				variantId,
				format,
				schemaBundle
			}))),
			decode: (source) => {
				const decoded = decodeSceneSource(source);
				if (decoded.kind === "empty") return {
					source,
					format: "yaml",
					variantId: "empty",
					data: null
				};
				return {
					...decoded,
					data: decoded.data
				};
			},
			validateSource: (source, context) => checkedSource(validateSceneSource(source, context))
		}],
		validationContext: context
	}];
}
/** Optional capability: old GUIs continue executing blocks without editor registration. */
function registerSourceEditors(scratch, nowMs = Date.now) {
	const api = scratch?.gui?.blockEditors;
	if (api?.apiVersion !== 1 || typeof api.registerSourceEditor !== "function") return () => {};
	const removers = [];
	try {
		for (const options of createSourceEditorOptions(nowMs)) removers.push(api.registerSourceEditor(options));
	} catch {
		for (const remove of removers.reverse()) remove();
		return () => {};
	}
	let active = true;
	return () => {
		if (active) {
			active = false;
			for (const remove of removers.reverse()) remove();
		}
	};
}
var block_definitions_default = {
	extensionName: "TurboWarp-3D-Scene-Runtime",
	blocks: [
		{
			"opcode": "applyScene",
			"blockType": "COMMAND",
			"text": "apply 3D scene [SOURCE]",
			"description": "Validates a YAML or JSON scene description and builds it by dispatching its call plan to turbowarp-aframe and turbowarp-ar.",
			"arguments": { "SOURCE": {
				"type": "STRING",
				"defaultValue": "formatVersion: 1"
			} }
		},
		{
			"opcode": "sceneStatus",
			"blockType": "REPORTER",
			"text": "3D scene status",
			"description": "Returns idle, applying, ready, or error.",
			"arguments": {}
		},
		{
			"opcode": "sceneError",
			"blockType": "REPORTER",
			"text": "3D scene error",
			"description": "Returns the message from the last failed apply, or an empty string.",
			"arguments": {}
		},
		{
			"opcode": "isSceneReady",
			"blockType": "BOOLEAN",
			"text": "3D scene is ready?",
			"description": "Reports whether the last apply finished without an error.",
			"arguments": {}
		},
		{
			"opcode": "whenSceneApplied",
			"blockType": "HAT",
			"text": "when 3D scene applied",
			"description": "Fires once each time a scene finishes being applied.",
			"arguments": {}
		}
	]
};
var AFRAME_CAPABILITY_KEY = "turbowarpAFrameCapability";
var AR_CAPABILITY_KEY = "turbowarpARCapability";
var AFRAME_PORT_METHODS = [
	"createScene",
	"createNode",
	"addClass",
	"setData",
	"setAttribute"
];
var AR_PORT_METHODS = [
	"createARScene",
	"stopARScene",
	"defineARTarget",
	"attachSelectorToARTarget"
];
var blockDefinitions = block_definitions_default.blocks;
var TurboWarp3DSceneRuntimeExtension = class {
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.removeSourceEditors();
		(this.scratch.vm?.runtime)?.off?.("RUNTIME_DISPOSED", this.handleSourceEditorDispose);
	}
	constructor(scratch) {
		this.scratch = scratch;
		this.status = "idle";
		this.lastError = "";
		this.appliedEvents = 0;
		this.applyGeneration = 0;
		this.disposed = false;
		this.handleSourceEditorDispose = () => this.dispose();
		this.removeSourceEditors = registerSourceEditors(this.scratch);
		(this.scratch.vm?.runtime)?.on?.("RUNTIME_DISPOSED", this.handleSourceEditorDispose);
	}
	getInfo() {
		return {
			id: extensionConfig.id,
			name: this.scratch.translate(block_definitions_default.extensionName),
			docsURI: extensionConfig.docsURI,
			blockIconURI: extensionConfig.blockIconURI,
			blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
		};
	}
	async applyScene(args) {
		const generation = ++this.applyGeneration;
		this.status = "applying";
		this.lastError = "";
		try {
			const calls = this.planFor(this.scratch.Cast.toString(args.SOURCE));
			await this.dispatch(calls);
			if (generation !== this.applyGeneration) return;
			this.status = "ready";
			this.appliedEvents += 1;
		} catch (error) {
			if (generation !== this.applyGeneration) return;
			this.status = "error";
			this.lastError = error instanceof Error ? error.message : String(error);
		}
	}
	sceneStatus() {
		return this.status;
	}
	sceneError() {
		return this.lastError;
	}
	isSceneReady() {
		return this.status === "ready";
	}
	whenSceneApplied() {
		if (this.appliedEvents <= 0) return false;
		this.appliedEvents -= 1;
		return true;
	}
	snapshot() {
		return {
			status: this.status,
			error: this.lastError,
			pendingAppliedEvents: this.appliedEvents
		};
	}
	/**
	* Reads the description and turns it into calls.
	*
	* A bare scene document is accepted as well as the `{scene3d, ar}` fragment, because a project
	* that only builds 3D should not have to nest its document under a key.
	*/
	planFor(source) {
		const decoded = decodeSceneSource(source);
		if (decoded.kind === "empty") return [];
		const fragment = decoded.variantId === "wrapper" ? decoded.data : { scene3d: decoded.data };
		return createTurboWarpExtensionPlan(fragment);
	}
	async dispatch(calls) {
		if (calls.length === 0) return;
		const aframe = this.needsAFrame(calls) ? this.requireAFramePort() : null;
		const ar = this.needsAR(calls) ? this.requireARPort() : null;
		for (const call of calls) if (call.extension === "turbowarp-aframe") await this.dispatchAFrame(aframe, call);
		else await this.dispatchAR(ar, call);
	}
	async dispatchAFrame(port, call) {
		switch (call.opcode) {
			case "createScene":
				await port.createScene(call.args.LAYER, call.args.MODE);
				return;
			case "createNode":
				port.createNode(call.args.TYPE, call.args.ID, call.args.PARENT);
				return;
			case "addClass":
				port.addClass(call.args.CLASS, call.args.SELECTOR);
				return;
			case "setData":
				port.setData(call.args.SELECTOR, call.args.KEY, call.args.VALUE);
				return;
			case "setAttribute":
				port.setAttribute(call.args.SELECTOR, call.args.NAME, call.args.VALUE);
				return;
		}
	}
	async dispatchAR(port, call) {
		switch (call.opcode) {
			case "createARScene":
				await port.stopARScene();
				await port.createARScene(call.args.CAMERA_ID, call.args.LAYER);
				return;
			case "defineARTarget":
				port.defineARTarget(call.args.TARGET_ID);
				return;
			case "attachSelectorToARTarget":
				port.attachSelectorToARTarget(call.args.SELECTOR, call.args.TARGET_ID);
				return;
		}
	}
	needsAFrame(calls) {
		return calls.some((call) => call.extension === "turbowarp-aframe");
	}
	needsAR(calls) {
		return calls.some((call) => call.extension === "turbowarp-ar");
	}
	requireAFramePort() {
		const port = this.capability(AFRAME_CAPABILITY_KEY, AFRAME_PORT_METHODS);
		if (port === null) throw new Error("turbowarp-aframe 0.7.0 or newer must be loaded before a 3D scene can be applied.");
		return port;
	}
	requireARPort() {
		const port = this.capability(AR_CAPABILITY_KEY, AR_PORT_METHODS);
		if (port === null) throw new Error("turbowarp-ar 0.4.0 or newer must be loaded before a scene with an ar fragment can be applied.");
		return port;
	}
	capability(key, methods) {
		const candidate = this.scratch.vm?.runtime?.[key];
		if (typeof candidate !== "object" || candidate === null) return null;
		const port = candidate;
		for (const method of methods) if (typeof port[method] !== "function") return null;
		return candidate;
	}
	toScratchBlock(block) {
		const text = this.scratch.translate(block.text);
		const displayText = /^\d/u.test(text) ? ` ${text}` : text;
		return {
			opcode: block.opcode,
			blockType: this.scratch.BlockType[block.blockType],
			text: displayText,
			...block.blockType === "HAT" ? { isEdgeActivated: false } : {},
			arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]) => [name, {
				type: this.scratch.ArgumentType[argument.type],
				defaultValue: argument.defaultValue
			}]))
		};
	}
};
/** Static contract: importing this entry never creates or registers an extension. */
var bundleModuleMetadata = Object.freeze({
	formatVersion: 1,
	id: extensionConfig.id,
	unsandboxed: extensionConfig.unsandboxed ? "required" : "not-needed"
});
/** The caller supplies the member host and owns registration and lifetime. */
function createExtension(scratch) {
	return new TurboWarp3DSceneRuntimeExtension(scratch);
}
export { bundleModuleMetadata, createExtension };
