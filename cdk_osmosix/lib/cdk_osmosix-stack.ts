import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as nodelambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
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

    const devClientSecret = secretsmanager.Secret.fromSecretAttributes(
      this,
      "devClientSecret",
      {
        secretCompleteArn:
          "arn:aws:secretsmanager:us-east-2:579534454884:secret:OSMOSIX_DEV_CLIENT-Fm23o2",
      }
    );

    const oauthLambda = new nodelambda.NodejsFunction(this, "oauthLambda", {
      entry: "../src/oauth.ts",
      handler: "lambdaHandler",
      environment: {
        OSMOSIX_DEV_CLIENT_ID: devClientSecret
          .secretValueFromJson("OSMOSIX_DEV_CLIENT_ID")
          .toString(),
        OSMOSIX_DEV_CLIENT_SECRET: devClientSecret
          .secretValueFromJson("OSMOSIX_DEV_CLIENT_SECRET")
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

    const dbSecret = secretsmanager.Secret.fromSecretAttributes(
      this,
      "DbSecret",
      {
        secretCompleteArn:
          "arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-DQL4LFXEKFCFKUZQSVOBH2N2PQ/admin-HRqeZ2",
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
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
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
    dbSecret.grantRead(slackRerouteLambda);

    const api = new apigateway.LambdaRestApi(this, "LambdaProxyApi", {
      handler: slackRerouteLambda,
      proxy: false,
    });

    const items = api.root.addResource("slack-reroute").addMethod("POST");
    const items1 = api.root
      .addResource("oauth")
      .addMethod("GET", new apigateway.LambdaIntegration(oauthLambda));

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
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
        },
        bundling: {
          minify: false,
          sourceMap: true,
          sourceMapMode: nodelambda.SourceMapMode.INLINE,
          sourcesContent: false,
          target: "es2020",
          tsconfig: "../tsconfig.json",
        },
        timeout: Duration.seconds(600),
      }
    );
    dbSecret.grantRead(slackEventWork);
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
    dbSecret.grantRead(pythonMlLambda);
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
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
        },
      }
    );
    dbSecret.grantRead(mlOutputLambda);
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
