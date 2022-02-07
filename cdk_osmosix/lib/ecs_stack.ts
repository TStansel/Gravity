import { Construct } from "constructs";
import { aws_ecs, aws_ecs_patterns, Duration, Stack, StackProps } from "aws-cdk-lib";

export class EcsStack extends Stack {
  constructor(scope: Construct, id: string, stackProps: StackProps) {
    super(scope, id, stackProps);

  }
}