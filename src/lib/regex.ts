/** Case-insensitive "contains" matcher for user-typed search text. */
export const contains = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
