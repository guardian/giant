import {RiffRaffYamlFile} from "@guardian/cdk/lib/riff-raff-yaml-file";
import type { StageSynthesisOptions} from "aws-cdk-lib";
import {App} from "aws-cdk-lib";
import type {CloudAssembly} from "aws-cdk-lib/cx-api";

export class GuAppWithExposedRiffRaff extends App {
  // ideally GuRoot would give you a handle on its riff-raff object

  public riffRaff: RiffRaffYamlFile;

  override synth(options?: StageSynthesisOptions): CloudAssembly {
    const cloudAssembly: CloudAssembly = super.synth(options);
    this.riffRaff = new RiffRaffYamlFile(this);
    this.riffRaff.synth();
    return cloudAssembly;
  }

}
