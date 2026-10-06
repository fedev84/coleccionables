export type Id = string

export const newId = (): Id => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()
