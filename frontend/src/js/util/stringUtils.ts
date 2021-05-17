export function getLastPart(input: string, separator: string) {
    return input.split(separator).slice(-1)[0];
}
