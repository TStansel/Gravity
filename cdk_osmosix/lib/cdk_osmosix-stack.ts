import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as nodelambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources"
import * as lambda from "aws-cdk-lib/aws-lambda"
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkOsmosixStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'dbVpc');

    const auroraCluster = new rds.ServerlessCluster(this, 'OsmosixCdkCluster', {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
      vpc,
      defaultDatabaseName: "osmosix",
      enableDataApi: true, // Optional - will be automatically set if you call grantDataApiAccess()
    });

    const secret = secretsmanager.Secret.fromSecretAttributes(
      this,
      "osmosixSlackSigningSecret",
      {
        secretCompleteArn:
          "arn:aws:secretsmanager:us-east-2:579534454884:secret:OSMOSIX_DEV_SIGNING_SECRET-5rg0ga",
      }
    );

    const reverseProxySqs = new sqs.Queue(this, "ReverseProxyQueue", {
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      receiveMessageWaitTime: Duration.seconds(20), // This makes SQS long polling, check to make sure does not slow things down
    });

    const nodeLambda = new nodelambda.NodejsFunction(this, "SlackReroute", {
      entry: "../src/slackReroute.ts",
      handler: "lambdaHandler",
      environment: {
        SLACK_SIGNING_SECRET: secret
          .secretValueFromJson("OSMOSIX_DEV_SIGNING_SECRET")
          .toString(),
        REVERSE_PROXY_SQS_URL: reverseProxySqs.queueUrl
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

    reverseProxySqs.grantSendMessages(nodeLambda);

    const api = new apigateway.LambdaRestApi(this, "LambdaProxyApi", {
      handler: nodeLambda,
      proxy: false,
    });

    const slackEventWork = new nodelambda.NodejsFunction(this, "SlackEventWork", {
      entry: "../src/slackEventWork.ts",
      handler: "lambdaHandler",
      bundling: {
        minify: false,
        sourceMap: true,
        sourceMapMode: nodelambda.SourceMapMode.INLINE,
        sourcesContent: false,
        target: "es2020",
        tsconfig: "../tsconfig.json",
      },
    });

    const slackEventSqsSource = new lambdaEventSources.SqsEventSource(reverseProxySqs, {
      batchSize: 1,
    });

    slackEventWork.addEventSource(slackEventSqsSource);

    const addedToChannelSqs = new sqs.Queue(this, "AddedToChannel", {
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      receiveMessageWaitTime: Duration.seconds(20), // This makes SQS long polling, check to make sure does not slow things down
      
    });

    const readAddedToChannelSqs = new nodelambda.NodejsFunction(this, "ReadAddedToChannelSqs", {
      entry: "../src/readAddedToChannelSqs.ts",
      handler: "lambdaHandler",
      bundling: {
        minify: false,
        sourceMap: true,
        sourceMapMode: nodelambda.SourceMapMode.INLINE,
        sourcesContent: false,
        target: "es2020",
        tsconfig: "../tsconfig.json",
      },
    });

    const nlpLambda = new nodelambda.NodejsFunction(this, "nlpLambda", {
      entry: "../src/nlpLambda.ts",
      handler: "lambdaHandler",
      bundling: {
        minify: false,
        sourceMap: true,
        sourceMapMode: nodelambda.SourceMapMode.INLINE,
        sourcesContent: false,
        target: "es2020",
        tsconfig: "../tsconfig.json",
      },
    });
    
    const doc2vecLambda = new lambda.DockerImageFunction(this, "doc2vecLambda", {
      code: lambda.DockerImageCode.fromImageAsset("../src/ml_lambdas/doc2vec_lambda")
    });
    
    const items = api.root.addResource("slack-reroute").addMethod("POST");
  }
}
