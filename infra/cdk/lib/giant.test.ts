import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Giant } from "./giant";

describe("The Giant stack", () => {
  it("matches the snapshot", () => {
    const app = new App();
    const stack = new Giant(app, "Giant", { stack: "pfi-playground", stage: "TEST" });
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
