// @vitest-environment jsdom
import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import SelectionPopover from "./SelectionPopover";

let container: HTMLDivElement;
let target: HTMLDivElement;
const onSelect = vi.fn();
const onDeselect = vi.fn();

function render(showPopover = true) {
  act(() => {
    ReactDOM.render(
      <SelectionPopover
        target="data-selection-target"
        showPopover={showPopover}
        onSelect={onSelect}
        onDeselect={onDeselect}
      >
        <span>Actions</span>
      </SelectionPopover>,
      container,
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  target = document.createElement("div");
  target.setAttribute("data-selection-target", "");
  target.style.marginTop = "5px";
  target.style.marginLeft = "10px";
  target.textContent = "Select this text";
  document.body.append(target, container);
});

afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
  target.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.getSelection()?.removeAllRanges();
});

test("positions the popover above selected text and removes the mouseup listener", () => {
  const range = document.createRange();
  range.selectNodeContents(target);
  Object.defineProperty(range, "getBoundingClientRect", {
    value: () => new DOMRect(50, 60, 100, 20),
  });
  window.getSelection()?.addRange(range);
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue(
    new DOMRect(10, 20, 300, 200),
  );
  render();
  const popover = container.querySelector("div");
  if (!popover) throw new Error("Missing popover");
  vi.spyOn(popover, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 40, 10),
  );

  act(() => {
    target.dispatchEvent(new MouseEvent("mouseup"));
  });
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onDeselect).not.toHaveBeenCalled();
  expect(popover.style.top).toBe("35px");
  expect(popover.style.left).toBe("80px");

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  target.dispatchEvent(new MouseEvent("mouseup"));
  expect(onSelect).toHaveBeenCalledOnce();
});

test("deselects when there is no selection and forwards outside-click events", () => {
  vi.spyOn(window, "getSelection").mockReturnValue(null);
  render();
  act(() => {
    target.dispatchEvent(new MouseEvent("mouseup"));
  });
  expect(onSelect).not.toHaveBeenCalled();
  expect(onDeselect).toHaveBeenCalledWith();

  const event = new MouseEvent("mousedown", { bubbles: true });
  act(() => {
    document.body.dispatchEvent(event);
  });
  expect(onDeselect).toHaveBeenLastCalledWith(event);
  render(false);
});

test("clears the selection when hidden and tolerates a removed target on unmount", () => {
  const range = document.createRange();
  range.selectNodeContents(target);
  const selection = window.getSelection();
  selection?.addRange(range);
  render();
  expect(selection?.rangeCount).toBe(1);
  render(false);
  expect(selection?.rangeCount).toBe(0);
  expect(container.querySelector("div")?.style.display).toBe("none");
  target.remove();
});
