import numpy as np
import json
from pydataapi import DataAPI, Result
import boto3

secretArn =  'arn:aws:secretsmanager:us-east-2:579534454884:secret:rds-db-credentials/cluster-4QWLO4T4HOH5I2B5367KESUM5Y/admin-lplDgu'
resourceArn = 'arn:aws:rds:us-east-2:579534454884:cluster:osmosix-db-cluster'

def lambda_handler(event=None, context=None):
  print("Request Event: ",event)

  new_question = event["payload"]["new_question"]
  old_questions = callRds(event["payload"]["channelID"])
  
  similarities = np.array(list(map(lambda old_question: cosine_similarity(new_question, json.loads(old_question["TextVector"])["vector"]), old_questions)))
  top_10_idx = similarities.argsort()[-10:][::-1]

  return json.dumps(list(map(lambda idx: {"QuestionID": old_questions[idx]["QuestionID"], "similarity": similarities[idx]}, top_10_idx)))


def cosine_similarity(v1, v2):
  return np.dot(v1, v2)/(np.linalg.norm(v1)*np.linalg.norm(v2))
  

def callRds(channelID):
  rdsData = boto3.client('rds-data')

  sqlStatement = """
                  select QuestionID, TextVector from Question 
                  inner join SlackChannel on Question.SlackChannelID=SlackChannel.SlackChannelID 
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
    oldQuestions.append({"QuestionID":qUUID, "TextVector":vector})
  
  return oldQuestions
