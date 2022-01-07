import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as nodelambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkOsmosixStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const nodeLambda = new nodelambda.NodejsFunction(this, "SlackReroute", {
      entry: "src/slackReroute.ts",
      handler: "lambdaHandler",
      bundling: {
        minify: false,
        sourceMap: true,
        sourceMapMode: nodelambda.SourceMapMode.INLINE,
        sourcesContent: false,
        target: "es2020",
        define: {
          "process.env.OSMOSIX_SLACK_SIGNING_SECRET": JSON.stringify(
            "82c28fa97d3ed1069d563fe215ac8167"
          ), // TODO: pretty sure this shouldn't be hard-coded here
        },
      },
    });

    const api = new apigateway.LambdaRestApi(this, "LambdaProxyApi", {
      handler: nodeLambda,
      proxy: false,
    });

    const items = api.root.addResource('slack-reroute', ).addMethod("POST");
  }
}
