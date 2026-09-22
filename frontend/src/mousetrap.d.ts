// The installed Mousetrap package has no bundled declarations.
// Describe the static methods used by KeyboardShortcut.
declare module "mousetrap" {
  interface Mousetrap {
    bind(
      keys: string | string[],
      callback: (event: KeyboardEvent, combo: string) => void | boolean,
      action?: "keypress" | "keydown" | "keyup",
    ): Mousetrap;
    unbind(
      keys: string | string[],
      action?: "keypress" | "keydown" | "keyup",
    ): Mousetrap;
  }

  const mousetrap: Mousetrap;
  export default mousetrap;
}
