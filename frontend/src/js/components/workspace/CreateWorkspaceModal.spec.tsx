import React from "react";
import ReactDOM from "react-dom";
import { act, Simulate } from "react-dom/test-utils";
import { Provider } from "react-redux";
import { createStore } from "redux";
import CreateWorkspaceModal from "./CreateWorkspaceModal";
import { createWorkspace } from "../../actions/workspaces/createWorkspace";

vi.mock("../../actions/workspaces/createWorkspace", () => ({
  createWorkspace: vi.fn(() => ({ type: "CREATE_WORKSPACE" })),
}));

describe("workspace colour selection", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  });

  it("submits the colour chosen through the dropdown", () => {
    const onComplete = vi.fn();
    act(() => {
      ReactDOM.render(
        <Provider store={createStore((state = {}) => state)}>
          <CreateWorkspaceModal onComplete={onComplete} />
        </Provider>,
        container,
      );
    });

    act(() => {
      const name =
        container.querySelector<HTMLInputElement>('input[name="name"]')!;
      name.value = "Blue workspace";
      Simulate.change(name);
      Simulate.mouseDown(container.querySelector(".giant-select__control")!, {
        button: 0,
      });
    });
    const blueOption = Array.from(
      container.querySelectorAll(".giant-select__option"),
    ).find((option) => option.textContent === "Blue")!;
    expect(blueOption).toBeDefined();
    act(() => Simulate.click(blueOption));
    expect(
      container.querySelector(
        ".giant-select__single-value .workspace__tag--blue",
      ),
    ).not.toBeNull();
    act(() => Simulate.submit(container.querySelector("form")!));

    expect(createWorkspace).toHaveBeenCalledWith(
      "Blue workspace",
      false,
      "blue",
    );
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
