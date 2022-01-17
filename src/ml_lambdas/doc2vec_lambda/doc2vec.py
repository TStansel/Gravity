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
        print("MEssage is not a question")
        return

    if slackJson["type"] == "NEWMESSAGEEVENT":
        pass

    ENDPOINT_NAME = os.environ['ENDPOINT_NAME']
    runtime = boto3.client('runtime.sagemaker')

    payload = {"inputs": slackJson["text"]}
    response = runtime.invoke_endpoint(EndpointName=ENDPOINT_NAME, ContentType='application/json', Body=payload)
    print(response)

    # json.dumps({"vector": model.infer_vector(string_to_tokens(event["text"])).tolist()})
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
