// A conservative MIND policy for long, multi-part analysis. Short conversations stay FAST.
export function reasoningProfile(prompt: string): 'FAST' | 'DEEP' {
  const words = prompt.trim().split(/\s+/).length;
  const parts = (prompt.match(/[?;\n]/g) ?? []).length;
  return words >= 140 && parts >= 3 || words >= 300 ? 'DEEP' : 'FAST';
}
