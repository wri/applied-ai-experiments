import type { Device, Dtype } from '../types';
import type { ModelEntry } from './models';

// Detect whether WebGPU is actually usable. Presence of `navigator.gpu` is
// necessary but NOT sufficient — some browsers expose it but fail to return an
// adapter, so we must await requestAdapter(). Runs in the worker.
export async function detectDevice(): Promise<Device> {
	try {
		// WebGPU types aren't in the default TS lib; access defensively.
		const gpu = (globalThis.navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } })
			?.gpu;
		if (!gpu) return 'wasm';
		const adapter = await gpu.requestAdapter();
		return adapter ? 'webgpu' : 'wasm';
	} catch {
		return 'wasm';
	}
}

// Pick the quantization for a model on a given backend. WebGPU defaults to
// full precision; WASM to 8-bit. Models can override per the registry.
export function pickDtype(model: ModelEntry, device: Device): Dtype {
	return device === 'webgpu' ? model.webgpuDtype : model.wasmDtype;
}
