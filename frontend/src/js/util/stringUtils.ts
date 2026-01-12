export function getLastPart(input: string, separator: string) {
  return input.split(separator).slice(-1)[0];
}

export function removeLastUnmatchedQuote(input: string) {
  const quoteCount = [...input.matchAll(/"/g)].length;
  if (quoteCount % 2 !== 0) {
    return input.replace(/(.*)(")(.*)$/, "$1$3");
  }
  return input;
}
