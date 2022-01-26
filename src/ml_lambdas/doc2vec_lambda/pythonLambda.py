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
table = dynamodb.Table(DYNAMO_TABLE_NAME)


def lambda_handler(event=None, context=None):
    custom_log(event, "DEBUG")

    if "Records" not in event:
        custom_log("Event is missing Records", "ERROR")
        return

    if len(event["Records"]) != 1:
        custom_log("Records length wrong", "ERROR")
        return

    if ("body" not in event["Records"][0]):
        custom_log("Event is missing Body", "ERROR")
        return

    slackJson = json.loads(event["Records"][0]["body"])

    custom_log(slackJson, "DEBUG")
    if slackJson["type"] == "MARKEDANSWEREVENT":
        if not nlp(slackJson['parentMsgText']):
            custom_log("Parent of marked message is not a question!", "DEBUG")
            return
    else:
        if not nlp(slackJson["text"]):
            custom_log("Message is not a question", "DEBUG")
            return

    ENDPOINT_NAME = os.environ['ENDPOINT_NAME']

    vectorizer_text_field = "parentMsgText" if slackJson["type"] == "MARKEDANSWEREVENT" else "text"
    payload = json.dumps({"inputs": slackJson[vectorizer_text_field]})
    response = runtime.invoke_endpoint(
        EndpointName=ENDPOINT_NAME, ContentType='application/json', Body=payload)["Body"].read()
    new_vector = np.array(json.loads(response)[0], dtype=np.float64)

    if slackJson["type"] == "NEWMESSAGEEVENT":
        custom_log("NEWMESSAGEEVENT", "WARN")
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
            new_vector, slackJson['workspaceID'], slackJson['channelID'], table)
        return_questions = find_similar_questions(similar_questions)
        slackJson['vectors'] = return_questions
        return write_to_sqs(slackJson, sqs)

    if slackJson["type"] == "MARKEDANSWEREVENT":
        custom_log("MARKEDANSWEREVENT", "WARN")
        dynamo_result = write_to_dynamo(slackJson, new_vector, table)
        custom_log(dynamo_result, "DEBUG")
        return write_to_sqs(slackJson, sqs)

    if slackJson["type"] == "APPADDEDMESSAGEPROCESSING":
        custom_log("APPADDEDMESSAGEPROCESSING", "WARN")
        dynamo_result = write_to_dynamo(slackJson, new_vector, table)
        custom_log(dynamo_result, "DEBUG")
        return write_to_sqs(slackJson, sqs)

    custom_log("incoming event did not match any event types", "ERROR")
    return


def write_to_sqs(slackJson, sqs):
    response = sqs.send_message(
        QueueUrl=os.environ['ML_OUTPUT_SQS_URL'],
        MessageBody=(
            json.dumps(slackJson)
        )
    )
    custom_log(response['MessageId'], "DEBUG")
    return True


def write_to_dynamo(slackJson, vector, table):
    channelID = slackJson['channelID']
    workspaceID = slackJson['workspaceID']
    messageTs = slackJson['messageID']
    response = table.put_item(TableName=DYNAMO_TABLE_NAME, Item={"workspaceID": workspaceID, "channelID#ts": "{channelID}#{ts}".format(
        channelID=channelID, ts=messageTs), "vector": vector.tobytes(), "messageTs": messageTs})
    return response


def get_similar_questions_dynamo(new_message_vector, workspaceID, channelID, table):
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

    return similar_questions


def process_batch(batch_items, workspaceID, channelID, new_message_vector):
    custom_log("processing batch of size: " + str(len(batch_items)), "DEBUG")
    similar_questions = []

    if len(batch_items) == 0:
        return similar_questions

    for question in batch_items:
        similarity = cosine_similarity(
            new_message_vector, np.frombuffer(bytes(question['vector'])))
        if similarity >= .6:
            similar_questions.append({"similarity": similarity, "workspaceID": workspaceID,
                                      "messageTs": question['messageTs']})
    return similar_questions


def find_similar_questions(similar_questions):
  questions_dict = {}
  if len(similar_questions) == 0:
    return questions_dict
  most_similar_question = max(similar_questions, key=lambda x: x['similarity'])
  most_recent_question = max(similar_questions, key=lambda x: float(x["messageTs"]))
  if most_similar_question['messageTs'] != most_recent_question['messageTs']:
    # most similar question is not also most recent question, add to dict
    questions_dict['mostRecent'] = most_recent_question
    custom_log("most similar ts != most recent ts!", "DEBUG")
  questions_dict['mostSimilar'] = most_similar_question
  return questions_dict
  



def nlp(string):
    return "?" in string


def cosine_similarity(v1, v2):
    return np.dot(v1, v2)/(np.linalg.norm(v1)*np.linalg.norm(v2))

# level can be one of ERROR, WARN, or DEBUG. ERROR and WARN are logged in prod and dev
def custom_log(input, level):
  env = None
  if os.environ['ENVIRONMENT'] is not None:
    env = os.environ['ENVIRONMENT']
  else:
    env = "dev"

  if env == "prod":
    if (level == "ERROR" or level == "WARN"):
      print("level: {level} input: {input}".format(level=level, input=json.dumps(input)))
  elif env == "dev":
    if (level == "ERROR" or level == "WARN" or level == "DEBUG"):
      print("level: {level} input: {input}".format(level=level, input=json.dumps(input)))
    else:
      print("invalid log level specified, please input one of ERROR, WARN, or DEBUG")
  else:
    print("no env was set, error!")
  

