import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as nodelambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as lambda from "aws-cdk-lib/aws-lambda";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkOsmosixStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "dbVpc");

    const auroraCluster = new rds.ServerlessCluster(this, "OsmosixCdkCluster", {
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

    const slackRerouteLambda = new nodelambda.NodejsFunction(
      this,
      "SlackReroute",
      {
        entry: "../src/slackReroute.ts",
        handler: "lambdaHandler",
        environment: {
          SLACK_SIGNING_SECRET: secret
            .secretValueFromJson("OSMOSIX_DEV_SIGNING_SECRET")
            .toString(),
          REVERSE_PROXY_SQS_URL: reverseProxySqs.queueUrl,
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: auroraCluster.secret?.secretArn as string
        },
        bundling: {
          minify: false,
          sourceMap: true,
          sourceMapMode: nodelambda.SourceMapMode.INLINE,
          sourcesContent: false,
          target: "es2020",
          tsconfig: "../tsconfig.json",
        },
      }
    );
    reverseProxySqs.grantSendMessages(slackRerouteLambda);

    const api = new apigateway.LambdaRestApi(this, "LambdaProxyApi", {
      handler: slackRerouteLambda,
      proxy: false,
    });

    const items = api.root.addResource("slack-reroute").addMethod("POST");

    const processEventsMlSqs = new sqs.Queue(this, "processEventsMlSqs", {
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      receiveMessageWaitTime: Duration.seconds(20), // This makes SQS long polling, check to make sure does not slow things down
    });

    const slackEventWork = new nodelambda.NodejsFunction(
      this,
      "SlackEventWork",
      {
        entry: "../src/slackEventWork.ts",
        handler: "lambdaHandler",
        environment: {
          PROCESS_EVENTS_ML_SQS_URL: processEventsMlSqs.queueUrl,
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: auroraCluster.secret?.secretArn as string
        },
        bundling: {
          minify: false,
          sourceMap: true,
          sourceMapMode: nodelambda.SourceMapMode.INLINE,
          sourcesContent: false,
          target: "es2020",
          tsconfig: "../tsconfig.json",
        },
      }
    );
    const slackEventSqsSource = new lambdaEventSources.SqsEventSource(
      reverseProxySqs,
      {
        batchSize: 1,
      }
    );

    slackEventWork.addEventSource(slackEventSqsSource);
    processEventsMlSqs.grantSendMessages(slackEventWork);

    const mlOutputSqs = new sqs.Queue(this, "mlOutputSqs", {
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      receiveMessageWaitTime: Duration.seconds(20), // This makes SQS long polling, check to make sure does not slow things down
    });

    const pythonMlLambda = new lambda.DockerImageFunction(
      this,
      "pythonMlLambda",
      {
        code: lambda.DockerImageCode.fromImageAsset(
          "../src/ml_lambdas/doc2vec_lambda"
        ),
        environment: {
          ML_OUTPUT_SQS_URL: mlOutputSqs.queueUrl,
        },
      }
    );
    const processEventsMlSqsSource = new lambdaEventSources.SqsEventSource(
      processEventsMlSqs,
      {
        batchSize: 1,
      }
    );
    pythonMlLambda.addEventSource(processEventsMlSqsSource);
    mlOutputSqs.grantSendMessages(pythonMlLambda);

    const mlOutputLambda = new nodelambda.NodejsFunction(
      this,
      "mlOutputLambda",
      {
        entry: "../src/mlOutputLambda.ts",
        handler: "lambdaHandler",
        bundling: {
          minify: false,
          sourceMap: true,
          sourceMapMode: nodelambda.SourceMapMode.INLINE,
          sourcesContent: false,
          target: "es2020",
          tsconfig: "../tsconfig.json",
        },
      }
    );
    const mlOutputSqsSource = new lambdaEventSources.SqsEventSource(
      mlOutputSqs,
      {
        batchSize: 1,
      }
    );
    mlOutputLambda.addEventSource(mlOutputSqsSource);

    auroraCluster.grantDataApiAccess(slackEventWork);
  }
}
