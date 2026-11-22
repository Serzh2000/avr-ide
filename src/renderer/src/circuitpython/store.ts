import { create } from 'zustand'

interface CircuitPythonState {
  open: boolean
  dirty: boolean
  busy: boolean
}

export const useCircuitPython = create<CircuitPythonState>(() => ({ open: false, dirty: false, busy: false }))

export function openCircuitPython(): void {
  useCircuitPython.setState({ open: true })
}

export async function confirmCircuitPythonDiscard(): Promise<boolean> {
  const { dirty, busy } = useCircuitPython.getState()
  if (busy) return false
  if (!dirty) return true
  useCircuitPython.setState({ busy: true })
  try {
    const result = await window.api.circuitpython.discard()
    return result.ok && result.data
  } finally {
    useCircuitPython.setState({ busy: false })
  }
}
