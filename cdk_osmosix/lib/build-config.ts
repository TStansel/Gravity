export interface BuildConfig {
  readonly AWSAccountID: string;
  readonly AWSProfileName: string;
  readonly AWSProfileRegion: string;

  readonly App: string;
  readonly Environment: string;
  readonly Version: string;
  readonly Build: string;
  
  readonly Parameters: BuildParameters;
}

export interface BuildParameters {
  readonly SlackSigningSecretArn: string;
  readonly OsmosixClientSecretArn: string;
  readonly AuroraServerlessSecretArn: string;
}