// EUI publishes declarations under /src, but the JavaScript lives under /es.
declare module "@elastic/eui/es" {
  export * from "@elastic/eui";
}

declare module "@elastic/eui/es/components/icon/icon" {
  export { appendIconComponentCache } from "@elastic/eui/src/components/icon/icon";
}

declare module "@elastic/eui/es/components/icon/assets/*" {
  // Generated icons share the same SVG props and optional title/titleId.
  export { icon } from "@elastic/eui/src/components/icon/assets/refresh";
}
