import {
  aws_ecs,
  aws_ecs_patterns,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
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
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { BuildConfig } from "./build-config";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkOsmosixStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    stackProps: StackProps,
    buildConfig: BuildConfig
  ) {
    super(scope, id, stackProps);

    const isProd: boolean = buildConfig.Environment === "prod";

    function name(name: string): string {
      return id + "-" + name;
    }

    const vpc = new ec2.Vpc(this, "dbVpc", {
      natGateways: 1,
    });

    const auroraCluster = new rds.ServerlessCluster(
      this,
      name("OsmosixCdkCluster"),
      {
        engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
        vpc,
        scaling: {
          autoPause: Duration.hours(20),
          minCapacity: rds.AuroraCapacityUnit.ACU_8,
          maxCapacity: rds.AuroraCapacityUnit.ACU_32,
        },
        defaultDatabaseName: "osmosix",
        enableDataApi: true, // Optional - will be automatically set if you call grantDataApiAccess()
      }
    );

    const dynamoQuestionTable = new dynamodb.Table(
      this,
      name("questionTable"),
      {
        partitionKey: {
          name: "workspaceID",
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "channelID#ts",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      }
    );

    const dynamoMessageTable = new dynamodb.Table(this, name("messageTable"), {
      partitionKey: {
        name: "workspaceID",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "channelID#ts",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const slackSigningSecret = secretsmanager.Secret.fromSecretAttributes(
      this,
      name("osmosixSlackSigningSecret"),
      {
        secretCompleteArn: buildConfig.Parameters.SlackSigningSecretArn,
      }
    );

    const slackClientSecret = secretsmanager.Secret.fromSecretAttributes(
      this,
      name("devClientSecret"),
      {
        secretCompleteArn: buildConfig.Parameters.OsmosixClientSecretArn,
      }
    );

    const dbSecret = secretsmanager.Secret.fromSecretAttributes(
      this,
      name("DbSecret"),
      {
        secretCompleteArn: buildConfig.Parameters.AuroraServerlessSecretArn,
      }
    );

    const oauthLambda = new nodelambda.NodejsFunction(
      this,
      name("oauthLambda"),
      {
        entry: "../src/oauth.ts",
        handler: "lambdaHandler",
        timeout: Duration.seconds(30),
        environment: {
          OSMOSIX_CLIENT_ID: slackClientSecret
            .secretValueFromJson("OSMOSIX_CLIENT_ID")
            .toString(),
          OSMOSIX_CLIENT_SECRET: slackClientSecret
            .secretValueFromJson("OSMOSIX_CLIENT_SECRET")
            .toString(),
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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
    dbSecret.grantRead(oauthLambda);

    const reverseProxySqs = new sqs.Queue(this, name("ReverseProxyQueue"), {
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      receiveMessageWaitTime: Duration.seconds(20), // This makes SQS long polling, check to make sure does not slow things down
      visibilityTimeout: Duration.seconds(1200),
    });

    const analysisSqs = new sqs.Queue(this, name("analysisSqs"), {
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      receiveMessageWaitTime: Duration.seconds(20), // This makes SQS long polling, check to make sure does not slow things down
      visibilityTimeout: Duration.seconds(600),
      deliveryDelay: Duration.seconds(900),
    });

    const slackRerouteLambda = new nodelambda.NodejsFunction(
      this,
      name("SlackReroute"),
      {
        entry: "../src/slackReroute.ts",
        handler: "lambdaHandler",
        environment: {
          SLACK_SIGNING_SECRET: slackSigningSecret
            .secretValueFromJson("OSMOSIX_SLACK_SIGNING_SECRET")
            .toString(),

          REVERSE_PROXY_SQS_URL: reverseProxySqs.queueUrl,
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const api = new apigateway.LambdaRestApi(this, name("LambdaProxyApi"), {
      handler: slackRerouteLambda,
      proxy: false,
    });

    const slackRerouteEndpoint = api.root
      .addResource("slack-reroute")
      .addMethod("POST");
    const oauthEndpoint = api.root
      .addResource("oauth")
      .addMethod("GET", new apigateway.LambdaIntegration(oauthLambda));

    // CRUD Operations for Front End Questions
    const createQuestionLambda = new nodelambda.NodejsFunction(
      this,
      name("CreateQuestion"),
      {
        entry: "../src/question_crud/createQuestion.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const createQuestionEndpoint = api.root
      .addResource("create-question")
      .addMethod(
        "POST",
        new apigateway.LambdaIntegration(createQuestionLambda)
      );

    const getOneQuestionLambda = new nodelambda.NodejsFunction(
      this,
      name("GetOneQuestion"),
      {
        entry: "../src/question_crud/getOneQuestion.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const getOneQuestionEndpoint = api.root
      .addResource("get-one-question")
      .addMethod("GET", new apigateway.LambdaIntegration(getOneQuestionLambda));

    const getAllQuestionsLambda = new nodelambda.NodejsFunction(
      this,
      name("GetAllQuestions"),
      {
        entry: "../src/question_crud/getAllQuestions.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const getAllQuestionsEndpoint = api.root
      .addResource("get-all-questions")
      .addMethod(
        "GET",
        new apigateway.LambdaIntegration(getAllQuestionsLambda)
      );

    const updateQuestionLambda = new nodelambda.NodejsFunction(
      this,
      name("UpdateQuestion"),
      {
        entry: "../src/question_crud/updateQuestion.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const updateQuestionEndpoint = api.root
      .addResource("update-question")
      .addMethod("PUT", new apigateway.LambdaIntegration(updateQuestionLambda));

    const deleteQuestionLambda = new nodelambda.NodejsFunction(
      this,
      name("DeleteQuestion"),
      {
        entry: "../src/question_crud/deleteQuestion.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const deleteQuestionEndpoint = api.root
      .addResource("delete-question")
      .addMethod(
        "DELETE",
        new apigateway.LambdaIntegration(deleteQuestionLambda)
      );

    // CRUD Operations for Deck

    const createDeckLambda = new nodelambda.NodejsFunction(
      this,
      name("CreateDeck"),
      {
        entry: "../src/deck_crud/createDeck.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const createDeckEndpoint = api.root
      .addResource("create-deck")
      .addMethod("POST", new apigateway.LambdaIntegration(createDeckLambda));

    const getOneDeckLambda = new nodelambda.NodejsFunction(
      this,
      name("GetOneDeckn"),
      {
        entry: "../src/deck_crud/getOneDeck.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const getOneDeckEndpoint = api.root
      .addResource("get-one-deck")
      .addMethod("GET", new apigateway.LambdaIntegration(getOneDeckLambda));

    const getAllDecksLambda = new nodelambda.NodejsFunction(
      this,
      name("GetAllDecks"),
      {
        entry: "../src/deck_crud/getAllDecks.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const getAllDecksEndpoint = api.root
      .addResource("get-all-deck")
      .addMethod("GET", new apigateway.LambdaIntegration(getAllDecksLambda));

    const updateDeckLambda = new nodelambda.NodejsFunction(
      this,
      name("UpdateDeck"),
      {
        entry: "../src/deck_crud/updateDeck.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const updateDeckEndpoint = api.root
      .addResource("update-deck")
      .addMethod("PUT", new apigateway.LambdaIntegration(updateDeckLambda));

    const deleteDeckLambda = new nodelambda.NodejsFunction(
      this,
      name("DeleteDeck"),
      {
        entry: "../src/deck_crud/deleteDeck.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const deleteDeckEndpoint = api.root
      .addResource("delete-deck")
      .addMethod("DELETE", new apigateway.LambdaIntegration(deleteDeckLambda));

    // Create, Read, and Delete Operations for Export (Update is not needed)

    const createExportLambda = new nodelambda.NodejsFunction(
      this,
      name("CreateExport"),
      {
        entry: "../src/export_crud/createExport.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const createExportEndpoint = api.root
      .addResource("create-export")
      .addMethod("POST", new apigateway.LambdaIntegration(createExportLambda));

    const getAllExportsLambda = new nodelambda.NodejsFunction(
      this,
      name("GetAllExports"),
      {
        entry: "../src/export_crud/getAllExports.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const getAllExportsEndpoint = api.root
      .addResource("get-all-exports")
      .addMethod("GET", new apigateway.LambdaIntegration(getAllExportsLambda));

    const deleteExportLambda = new nodelambda.NodejsFunction(
      this,
      name("DeleteExport"),
      {
        entry: "../src/export_crud/deleteExport.ts",
        handler: "lambdaHandler",
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
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

    const deleteExportEndpoint = api.root
      .addResource("delete-export")
      .addMethod(
        "DELETE",
        new apigateway.LambdaIntegration(deleteExportLambda)
      );

    const processEventsMlSqs = new sqs.Queue(this, name("processEventsMlSqs"), {
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      receiveMessageWaitTime: Duration.seconds(20), // This makes SQS long polling, check to make sure does not slow things down
      visibilityTimeout: Duration.seconds(600),
    });

    const slackEventWork = new nodelambda.NodejsFunction(
      this,
      name("SlackEventWork"),
      {
        entry: "../src/slackEventWork.ts",
        handler: "lambdaHandler",
        environment: {
          PROCESS_EVENTS_ML_SQS_URL: processEventsMlSqs.queueUrl,
          ANALYSIS_SQS_URL: analysisSqs.queueUrl,
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          DYNAMO_TABLE_NAME: dynamoMessageTable.tableName,
          ENVIRONMENT: buildConfig.Environment,
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
    dynamoMessageTable.grantReadWriteData(slackEventWork);
    slackEventWork.addEventSource(slackEventSqsSource);
    processEventsMlSqs.grantSendMessages(slackEventWork);
    analysisSqs.grantSendMessages(slackEventWork);

    const mlOutputSqs = new sqs.Queue(this, name("mlOutputSqs"), {
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      receiveMessageWaitTime: Duration.seconds(20), // This makes SQS long polling, check to make sure does not slow things down
      visibilityTimeout: Duration.seconds(1200),
    });

    const myRole = new iam.Role(this, name("My Role"), {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    const pythonMlLambda = new lambda.DockerImageFunction(
      this,
      name("pythonMlLambda"),
      {
        code: lambda.DockerImageCode.fromImageAsset(
          "../src/ml_lambdas/doc2vec_lambda"
        ),
        environment: {
          ML_OUTPUT_SQS_URL: mlOutputSqs.queueUrl,
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENDPOINT_NAME:
            "huggingface-pytorch-inference-2022-01-17-20-16-16-413",
          DYNAMO_TABLE_NAME: dynamoQuestionTable.tableName,
          ENVIRONMENT: buildConfig.Environment,
        },
        timeout: Duration.seconds(60),
        role: myRole,
      }
    );
    dynamoQuestionTable.grantWriteData(pythonMlLambda);
    dynamoQuestionTable.grantReadData(pythonMlLambda);

    myRole.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        "slackMLSageMaker",
        "arn:aws:iam::579534454884:policy/slackMLSageMaker"
      )
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
      name("mlOutputLambda"),
      {
        timeout: Duration.seconds(30),
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
          ENVIRONMENT: buildConfig.Environment,
          DYNAMO_TABLE_NAME: dynamoMessageTable.tableName,
        },
      }
    );
    dynamoMessageTable.grantWriteData(mlOutputLambda);
    dbSecret.grantRead(mlOutputLambda);
    const mlOutputSqsSource = new lambdaEventSources.SqsEventSource(
      mlOutputSqs,
      {
        batchSize: 1,
      }
    );
    mlOutputLambda.addEventSource(mlOutputSqsSource);

    const slackChannelAnalysisLambda = new lambda.DockerImageFunction(
      this,
      name("slackChannelAnalysisLambda"),
      {
        code: lambda.DockerImageCode.fromImageAsset(
          "../src/analysis/analysis_lambda"
        ),
        environment: {
          AURORA_RESOURCE_ARN: auroraCluster.clusterArn,
          AURORA_SECRET_ARN: dbSecret.secretFullArn?.toString() as string,
          ENVIRONMENT: buildConfig.Environment,
          DYNAMO_TABLE_NAME: dynamoQuestionTable.tableName,
        },
        timeout: Duration.seconds(60),
      }
    );

    const analysisSqsSource = new lambdaEventSources.SqsEventSource(
      analysisSqs,
      {
        batchSize: 1,
      }
    );
    slackChannelAnalysisLambda.addEventSource(analysisSqsSource);
    dynamoQuestionTable.grantReadWriteData(slackChannelAnalysisLambda);

    auroraCluster.grantDataApiAccess(slackChannelAnalysisLambda);
    auroraCluster.grantDataApiAccess(slackEventWork);
    auroraCluster.grantDataApiAccess(mlOutputLambda);
    auroraCluster.grantDataApiAccess(pythonMlLambda);
    auroraCluster.grantDataApiAccess(oauthLambda);
  }
}
