import numpy as np
import json
from pydataapi import DataAPI, Result
import boto3
import os

secretArn =  os.environ["AURORA_SECRET_ARN"]
resourceArn = os.environ["AURORA_RESOURCE_ARN"]

#model = gensim.models.doc2vec.Doc2Vec.load(
    #'so_top_100k_vec_50_win_5_min_2_ep_80.pkl')


def lambda_handler(event=None, context=None):
    print("Request Event", event)
    if "body" not in event:
        print("Event it missing Body")
        return
    slackJson = json.loads(event.body)
    print(slackJson)

    if not nlp(slackJson["text"]):
        print("MEssage is not a question")
        return

    if slackJson["type"] == "NEWMESSAGEEVENT":
        pass

    return#json.dumps({"vector": model.infer_vector(string_to_tokens(event["text"])).tolist()})

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
