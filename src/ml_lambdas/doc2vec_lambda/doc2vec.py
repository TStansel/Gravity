import numpy as np
import json
from pydataapi import DataAPI, Result
import boto3
import os

secretArn = os.environ["AURORA_SECRET_ARN"]
resourceArn = os.environ["AURORA_RESOURCE_ARN"]


def lambda_handler(event=None, context=None):
    print("Request Event", event)

    if "Records" not in event:
        print("Event is missing Records")
        return

    if len(event["Records"]) != 1:
        print("Records length wrong")
        return

    if ("body" not in event["Records"][0]):
        print("Event is missing Body")
        return

    slackJson = json.loads(event["Records"][0]["body"])
    print(slackJson)

    if not nlp(slackJson["text"]):
        print("Message is not a question")
        return

    ENDPOINT_NAME = os.environ['ENDPOINT_NAME']
    runtime = boto3.client('runtime.sagemaker')

    payload = json.dumps({"inputs": slackJson["text"]})
    response = runtime.invoke_endpoint(
        EndpointName=ENDPOINT_NAME, ContentType='application/json', Body=payload)
    print(response)
    new_vector = np.array([])  # change

    if slackJson["type"] == "NEWMESSAGEEVENT":
        questionObjects = callRds(slackJson["channelID"])
        similarities = []
        for question in questionObjects:
          similarity = cosine_similarity(new_vector, np.array(json.loads(question["TextVector"])))
          if similarity >= .6:
            similarities.append({"similarity": similarity, "SlackQuestionID": question["SlackQuestionUUID"], "SlackQuestionTs": question["Ts"]})
        slackJson["vectors"] = sorted(similarities, key=lambda d: d['similarity'], reverse=True)
        return json.dumps(slackJson)

    if slackJson["type"] == "MARKEDANSWEREVENT":
      slackJson["vectors"] = json.dumps(list(new_vector))
      return json.dumps(slackJson)

    if slackJson["type"] == "APPADDEDEVENT":
      pass
    
    return


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

    params = [{'name': 'channelID', 'value': {'stringValue': channelID}}]

    response = rdsData.execute_statement(
        resourceArn=resourceArn,
        secretArn=secretArn,
        database='osmosix',
        sql=sqlStatement,
        parameters=params
    )
    oldQuestions = []
    for row in response["records"]:
        qUUID = row[0]["stringValue"]
        vector = row[1]["stringValue"]
        ts = row[2]["stringValue"]
        oldQuestions.append(
            {"SlackQuestionID": qUUID, "Ts": ts, "TextVector": vector})

    return oldQuestions
