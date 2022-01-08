import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as nodelambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkOsmosixStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const nodeLambda = new nodelambda.NodejsFunction(this, "SlackReroute", {
      entry: "../src/slackReroute.ts",
      handler: "lambdaHandler",
      bundling: {
        minify: false,
        sourceMap: true,
        sourceMapMode: nodelambda.SourceMapMode.INLINE,
        sourcesContent: false,
        target: "es2020",
        tsconfig: "../tsconfig.json"
      },
    });

    const secret = secretsmanager.Secret.fromSecretAttributes(this, "osmosixSlackSigningSecret", {
      secretCompleteArn: "arn:aws:secretsmanager:us-east-2:579534454884:secret:OSMOSIX_SLACK_SIGNING_SECRET-g0YuJ8"
    });

    if(nodeLambda.role) {
      secret.grantRead(nodeLambda.role);
    }
    

    const api = new apigateway.LambdaRestApi(this, "LambdaProxyApi", {
      handler: nodeLambda,
      proxy: false,
    });

    const items = api.root.addResource("slack-reroute").addMethod("POST");
  }
}
