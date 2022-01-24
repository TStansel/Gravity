#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkOsmosixStack } from '../lib/cdk_osmosix-stack';
import { BuildConfig } from '../lib/build-config';
import { Tags } from 'aws-cdk-lib';

const app = new cdk.App();

function ensureString(object: { [name: string]: any }, propName: string): string {
  if (!object[propName] || object[propName].trim().length === 0) {
    throw new Error(propName + " does not exist or is empty");
  }

  return object[propName];
}

function getConfig(): BuildConfig {
  let env = app.node.tryGetContext('config');
  if (!env) {
    throw new Error("Context variable missing on CDK command. Pass in as -c config=XXX");
  }

  let unparsedEnv = app.node.tryGetContext(env);

  let buildConfig: BuildConfig = {
    AWSAccountID: ensureString(unparsedEnv, "AWSAccountID"),
    AWSProfileName: ensureString(unparsedEnv, "AWSProfileName"),
    AWSProfileRegion: ensureString(unparsedEnv, "AWSProfileRegion"),

    App: ensureString(unparsedEnv, "App"),
    Version: ensureString(unparsedEnv, "Version"),
    Environment: ensureString(unparsedEnv, "Environment"),
    Build: ensureString(unparsedEnv, "Build"),

    Parameters: {
      SlackSigningSecretArn: ensureString(unparsedEnv['BuildParameters'], 'SlackSigningSecretArn'),
      OsmosixClientSecretArn: ensureString(unparsedEnv['BuildParameters'], "OsmosixClientSecretArn"),
      AuroraServerlessSecretArn: ensureString(unparsedEnv['BuildParameters'], "AuroraServerlessSecretArn")
    }
  }

  return buildConfig
}

function Main() {
  let buildConfig = getConfig();

  Tags.of(app).add("App", buildConfig.App);
  Tags.of(app).add("Environment", buildConfig.Environment);

  let osmosixStackName = buildConfig.Environment + "-osmosix";
  const osmosixStack = new CdkOsmosixStack(app, osmosixStackName, {
    env: {
      region: buildConfig.AWSProfileRegion,
      account: buildConfig.AWSAccountID
    }
  }, buildConfig);
}

Main();
// new CdkOsmosixStack(app, 'CdkOsmosixStack', {
//   /* If you don't specify 'env', this stack will be environment-agnostic.
//    * Account/Region-dependent features and context lookups will not work,
//    * but a single synthesized template can be deployed anywhere. */

//   /* Uncomment the next line to specialize this stack for the AWS Account
//    * and Region that are implied by the current CLI configuration. */
//   // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

//   /* Uncomment the next line if you know exactly what Account and Region you
//    * want to deploy the stack to. */
//   // env: { account: '123456789012', region: 'us-east-1' },

//   /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
// });