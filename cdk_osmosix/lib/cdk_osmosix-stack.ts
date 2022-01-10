import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as nodelambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkOsmosixStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const secret = secretsmanager.Secret.fromSecretAttributes(
      this,
      "osmosixSlackSigningSecret",
      {
        secretCompleteArn:
          "arn:aws:secretsmanager:us-east-2:579534454884:secret:OSMOSIX_DEV_SIGNING_SECRET-5rg0ga",
      }
    );

    const nodeLambda = new nodelambda.NodejsFunction(this, "SlackReroute", {
      entry: "../src/slackReroute.ts",
      handler: "lambdaHandler",
      environment: {
        SLACK_SIGNING_SECRET: secret
          .secretValueFromJson("OSMOSIX_DEV_SIGNING_SECRET")
          .toString(),
      },
      bundling: {
        minify: false,
        sourceMap: true,
        sourceMapMode: nodelambda.SourceMapMode.INLINE,
        sourcesContent: false,
        target: "es2020",
        tsconfig: "../tsconfig.json",
      },
    });

    const api = new apigateway.LambdaRestApi(this, "LambdaProxyApi", {
      handler: nodeLambda,
      proxy: false,
    });

    const items = api.root.addResource("slack-reroute").addMethod("POST");
  }
}
