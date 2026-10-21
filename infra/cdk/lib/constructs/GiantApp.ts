import type {StageSynthesisOptions} from "aws-cdk-lib";
import type {CloudAssembly} from "aws-cdk-lib/cx-api";
import {GuAppWithExposedRiffRaff} from "./GuAppWithExposedRiffRaff";

export class GiantApp extends GuAppWithExposedRiffRaff {

  override synth(options?: StageSynthesisOptions): CloudAssembly {
    const cloudAssembly: CloudAssembly = super.synth(options);

    const riffRaffConfigs = Array.from(this.riffRaff.configuration.values());

    if(riffRaffConfigs.length !== 1) {
      console.warn(riffRaffConfigs);
      throw new Error("Expected only one riff-raff.yaml configuration, but found multiple");
    }

    const riffRaffYaml = riffRaffConfigs[0];

    const mainCfnDeploymentEntry =
      Array.from(riffRaffYaml.deployments.entries()).find(([,_]) =>
        _.type === "cloud-formation"
      );

    if(!mainCfnDeploymentEntry) {
      throw new Error("No main CloudFormation deployment found");
    }

    const [mainCfnDeploymentKey, mainCfnDeployment] = mainCfnDeploymentEntry;

    mainCfnDeployment.app = "pfi";

    const stacks = mainCfnDeployment.stacks;

    if(stacks.size > 1){
      throw new Error("Expected only one stack in main CloudFormation deployment");
    }

    const stack = Array.from(stacks)[0];

    const regions = mainCfnDeployment.regions;

    // TODO consider parsing the top-level riff-raff.yaml rather than re-creating in unfamiliar shape

    riffRaffYaml.deployments.set("pfi-ami-update", {
      type: "ami-cloudformation-parameter",
      app: "pfi",
      stacks,
      regions,
      contentDirectory: "",
      parameters: {
        amiEncrypted: true,
        amiTags: {
          Recipe: "investigations-giant-app-arm",
          AmigoStage: "PROD",
        },
      },
      dependencies: [mainCfnDeploymentKey],
    });

    riffRaffYaml.deployments.set("pfi-neo4j-ami-update", {
      type: "ami-cloudformation-parameter",
      app: "neo4j",
      stacks,
      regions,
      contentDirectory: "",
      parameters: {
        amiEncrypted: true,
        amiTags: {
          Recipe: "investigations-neo4j-2026-jammy-java25",
          AmigoStage: "PROD",
        },
      },
      dependencies: [mainCfnDeploymentKey],
    });

    riffRaffYaml.deployments.set("pfi-elasticsearch-ami-update", {
      type: "ami-cloudformation-parameter",
      app: "elasticsearch",
      stacks,
      regions,
      contentDirectory: "",
      parameters: {
        amiEncrypted: true,
        amiTags: {
          Recipe: "investigations-elasticsearch-8-arm64",
          AmigoStage: "PROD",
        },
      },
      dependencies: [mainCfnDeploymentKey],
    });

    riffRaffYaml.deployments.set("pfi", {
      type: "autoscaling",
      app: "pfi",
      stacks,
      regions,
      contentDirectory: "pfi",
      parameters: {
        bucketSsmKey: `/${stack}/artifact.bucket`,
        bucketSsmLookup: true,
      },
      dependencies: [mainCfnDeploymentKey, "pfi-ami-update"],
    });

    riffRaffYaml.deployments.set("pfi-worker", {
      type: "autoscaling",
      app: "pfi",
      stacks,
      regions,
      contentDirectory: "pfi",
      parameters: {
        bucketSsmKey: `/${stack}/artifact.bucket`,
        bucketSsmLookup: true,
      },
      actions: ["deploy"],
      dependencies: [mainCfnDeploymentKey, "pfi"],
    });

    riffRaffYaml.deployments.set("pfi-spot-worker", {
      type: "autoscaling",
      app: "pfi",
      stacks,
      regions,
      contentDirectory: "pfi",
      parameters: {
        bucketSsmKey: `/${stack}/artifact.bucket`,
        bucketSsmLookup: true,
      },
      actions: ["deploy"],
      dependencies: [mainCfnDeploymentKey, "pfi"],
    });

    riffRaffYaml.deployments.set("pfi-cli", {
      type: "aws-s3",
      app: "pfi-cli",
      stacks,
      regions,
      contentDirectory: "pfi-cli",
      parameters: {
        bucket: `${stack}-dist`,
        cacheControl: "private",
        publicReadAcl: false,
      },
      dependencies: [mainCfnDeploymentKey],
    });

    riffRaffYaml.deployments.set("pfi-public-downloads", {
      type: "aws-s3",
      app: "pfi-public-downloads",
      stacks,
      regions,
      contentDirectory: "pfi-public-downloads",
      parameters: {
        bucket: "investigations-public-dist",
        cacheControl: "private",
        publicReadAcl: false,
      },
      dependencies: [mainCfnDeploymentKey],
    });

    this.riffRaff.synth(); // even though GuAppWithExposedRiffRaff already does this, we need to re-synth to add these deployments

    return cloudAssembly;
  }
}
