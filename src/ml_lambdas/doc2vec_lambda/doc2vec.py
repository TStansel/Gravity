import numpy as np
import json
import boto3
import os
from boto3.dynamodb.conditions import Key


secretArn = os.environ["AURORA_SECRET_ARN"]
resourceArn = os.environ["AURORA_RESOURCE_ARN"]
runtime = boto3.client('runtime.sagemaker')
sqs = boto3.client('sqs')
rdsData = boto3.client('rds-data')
dynamodb = boto3.resource('dynamodb', region_name="us-east-2")
DYNAMO_TABLE_NAME = os.environ['DYNAMO_TABLE_NAME']



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
    print("slackJson:")
    print(slackJson)
    if slackJson["type"] == "MARKEDANSWEREVENT":
        if not nlp(slackJson['parentMsgText']):
            print("Parent of marked message is not a question!")
            return
    else:
        if not nlp(slackJson["text"]):
            print("Message is not a question")
            return

    ENDPOINT_NAME = os.environ['ENDPOINT_NAME']

    vectorizer_text_field = "parentMsgText" if slackJson["type"] == "MARKEDANSWEREVENT" else "text"
    payload = json.dumps({"inputs": slackJson[vectorizer_text_field]})
    response = runtime.invoke_endpoint(
        EndpointName=ENDPOINT_NAME, ContentType='application/json', Body=payload)["Body"].read()
    new_vector = np.array(json.loads(response)[0], dtype=np.float64)

    if slackJson["type"] == "NEWMESSAGEEVENT":
        print("NEWMESSAGEEVENT")
        # questionObjects = callRds(slackJson["channelID"])
        # print(len(questionObjects))
        # print(questionObjects)
        # similarities = []
        # for question in questionObjects:
        #     similarity = cosine_similarity(new_vector, np.array(
        #         (question["TextVector"]), dtype=np.float64))
        #     if similarity >= .6:
        #         similarities.append(
        #             {"similarity": similarity, "SlackQuestionID": question["SlackQuestionID"], "SlackQuestionTs": question["Ts"]})
        similar_questions = get_similar_questions_dynamo(
            new_vector, slackJson['workspaceID'], slackJson['channelID'], dynamodb)
        slackJson["vectors"] = sorted(
            similar_questions, key=lambda d: d['similarity'], reverse=True)
        return write_to_sqs(slackJson, sqs)

    if slackJson["type"] == "MARKEDANSWEREVENT":
        print("MARKEDANSWEREVENT")
        print(write_to_dynamo(slackJson, new_vector, dynamodb))
        return write_to_sqs(slackJson, sqs)

    if slackJson["type"] == "APPADDEDMESSAGEPROCESSING":
        print("APPADDEDMESSAGEPROCESSING")
        print(write_to_dynamo(slackJson, new_vector, dynamodb))
        return write_to_sqs(slackJson, sqs)

    print("incoming event did not match any event types")
    return


def write_to_sqs(slackJson, sqs):
    response = sqs.send_message(
        QueueUrl=os.environ['ML_OUTPUT_SQS_URL'],
        MessageBody=(
            json.dumps(slackJson)
        )
    )
    print(response['MessageId'])
    return True


def write_to_dynamo(slackJson, vector, dynamo_client):
    channelID = slackJson['channelID']
    workspaceID = slackJson['workspaceID']
    messageTs = slackJson['messageID']
    response = dynamo_client.put_item(TableName=DYNAMO_TABLE_NAME, Item={"workspaceID": {'S': workspaceID}, "channelID#ts": {
        'S': "{channelID}#{ts}".format(channelID=channelID, ts=messageTs)}, "vector": {'B': vector.tobytes()}, "messageTs": {'S': messageTs}})
    return response


def get_similar_questions_dynamo(new_message_vector, workspaceID, channelID, dynamo_client):
    table = dynamo_client.Table(DYNAMO_TABLE_NAME)

    similar_questions = []

    response = table.query(
        KeyConditionExpression=Key("workspaceID").eq(workspaceID) & Key(
            'channelID#ts').begins_with(channelID)
    )
    startkey = response.get('LastEvaluatedKey', None)
    similar_questions.extend(process_batch(
        response['Items'], workspaceID, channelID, new_message_vector))

    while startkey is not None:
        response = table.query(
            ExclusiveStartKey=startkey,
            KeyConditionExpression=Key("workspaceID").eq(workspaceID) & Key(
                'channelID#ts').begins_with(channelID)
        )
        startkey = response.get('LastEvaluatedKey', None)
        similar_questions.extend(process_batch(
            response['Items'], workspaceID, channelID, new_message_vector))


def process_batch(batch_items, workspaceID, channelID, new_message_vector):
    print("processing batch of size: " + str(len(batch_items)))
    similar_questions = []
    for question in batch_items:
        similarity = cosine_similarity(
            new_message_vector, np.frombuffer(question['vector']))
        if similarity >= .6:
            similar_questions.append({"similarity": similarity, "workspaceID": workspaceID,
                                      "channelID": channelID, "messageTs": question['messageTs']})
    return similar_questions


def nlp(string):
    return "?" in string


def cosine_similarity(v1, v2):
    return np.dot(v1, v2)/(np.linalg.norm(v1)*np.linalg.norm(v2))


# def callRds(channelID):
#     sqlStatement = """
#                   select SlackQuestionUUID, TextVector, Ts from SlackQuestion 
#                   inner join SlackChannel on SlackQuestion.SlackChannelUUID=SlackChannel.SlackChannelUUID 
#                   where SlackChannel.ChannelID = :channelID
#                   limit 60
#                  """

#     params = [{'name': 'channelID', 'value': {'stringValue': channelID}}]

#     response = rdsData.execute_statement(
#         resourceArn=resourceArn,
#         secretArn=secretArn,
#         database='osmosix',
#         sql=sqlStatement,
#         parameters=params
#     )
#     oldQuestions = []
#     for row in response["records"]:
#         qUUID = row[0]["stringValue"]
#         vector = row[1]["stringValue"]
#         ts = row[2]["stringValue"]
#         oldQuestions.append(
#             {"SlackQuestionID": qUUID, "Ts": ts, "TextVector": json.loads(vector)})

#     return oldQuestions
