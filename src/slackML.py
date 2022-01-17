import numpy as np
import json
from pydataapi import DataAPI, Result
import boto3
import gensim
import aws_cdk.aws_sqs as sqs
import os

secretArn =  os.environ["AURORA_SECRET_ARN"]
resourceArn = os.environ["AURORA_RESOURCE_ARN"]

def handler(event, lambda_context):
    print(event)
    return 'Success'


def string_to_tokens(string):
    return gensim.utils.simple_preprocess(string)

def nlp(string):
    return "?" in string

def cosine_similarity(v1, v2):
  return np.dot(v1, v2)/(np.linalg.norm(v1)*np.linalg.norm(v2))

def callRds(channelID):
  rdsData = boto3.client('rds-data')

  sqlStatement = """
                  select SlackQuestionUUID, TextVector, Ts from SlackQuestion 
                  inner join SlackChannel on SlackQuestion.SlackChannelUUID=SlackChannel.SlackChannelUUID 
                  where SlackChannel.ChannelID = :channelID
                 """
  
  params = [{'name': 'channelID', 'value':{'stringValue':channelID}}]

  response = rdsData.execute_statement(
    resourceArn = resourceArn,
    secretArn = secretArn,
    database = 'osmosix',
    sql = sqlStatement,
    parameters = params
  )
  oldQuestions = []
  for row in response["records"]:
    qUUID = row[0]["stringValue"]
    vector = row[1]["stringValue"]
    ts = row[2]["stringValue"]
    oldQuestions.append({"SlackQuestionID":qUUID, "Ts":ts, "TextVector":vector})
  
  return oldQuestions