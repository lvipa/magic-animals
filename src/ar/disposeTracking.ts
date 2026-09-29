// Dispose only tensors owned by this controller, not TensorFlow's shared backend.
export function disposeTrackingTensors(root: unknown) {
  const visited = new WeakSet<object>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (typeof EventTarget !== 'undefined' && value instanceof EventTarget) return;
    const tensor = value as { shape?: unknown; dtype?: unknown; dispose?: () => void };
    if (
      Array.isArray(tensor.shape) &&
      typeof tensor.dtype === 'string' &&
      typeof tensor.dispose === 'function'
    ) {
      try {
        tensor.dispose();
      } catch {
        /* already released */
      }
      return;
    }
    Object.values(value).forEach(visit);
  };
  visit(root);
}
