import numpy as np
import json
import boto3
import os
from boto3.dynamodb.conditions import Key


secretArn = os.environ["AURORA_SECRET_ARN"]
resourceArn = os.environ["AURORA_RESOURCE_ARN"]
runtime = boto3.client('runtime.sagemaker')
rdsData = boto3.client('rds-data')
dynamodb = boto3.resource('dynamodb', region_name="us-east-2")
DYNAMO_TABLE_NAME = os.environ['DYNAMO_TABLE_NAME']
table = dynamodb.Table(DYNAMO_TABLE_NAME)


def lambda_handler(event=None, context=None):
    custom_log(event, "DEBUG")

    slackJson = json.loads(event["Records"][0]["body"])

    questions = get_questions_dynamo(
        slackJson["workspaceID"], slackJson["channelID"], table)

    sixtySimilarityMatrix = get_similarity_matrix(questions, .6)
    sevenFiveSimilarityMatrix = get_similarity_matrix(questions, .75)

    numSixtySimilar = get_percent_questions_with_recommendation(
        sixtySimilarityMatrix, questions)
    numSevenFiveSimilar = get_percent_questions_with_recommendation(
        sevenFiveSimilarityMatrix, questions)
    numOfQualified = len(questions)

    writeToRDS(slackJson["statUUID"], str(numOfQualified),
               numSixtySimilar, numSevenFiveSimilar)

    custom_log("Analysis Logged", "DEBUG")
    return


def writeToRDS(slackStatUUID, numOfQualified, numSixtySimilar, numSevenFiveSimilar):
    sqlStatement = """
                  update SlackStats
                  set NumOfQualifiedQuestions = :numOfQualified, PercentQuestionsAbove60 = :numSixtySimilar, PercentQuestionsAbove75 = :numSevenFiveSimilar
                  where SlackStatUUID = :slackStatUUID
                  """

    params = [{'name': 'slackStatUUID', 'value': {'stringValue': slackStatUUID}}, {
        'name': 'numOfQualified', 'value': {'stringValue': numOfQualified}}, {
        'name': 'numSixtySimilar', 'value': {'stringValue': numSixtySimilar}}, {
        'name': 'numSevenFiveSimilar', 'value': {'stringValue': numSevenFiveSimilar}}]

    response = rdsData.execute_statement(
        resourceArn=resourceArn,
        secretArn=secretArn,
        database='osmosix',
        sql=sqlStatement,
        parameters=params
    )

    return response


def cosine_similarity(v1, v2):
    return np.dot(v1, v2)/(np.linalg.norm(v1)*np.linalg.norm(v2))


def process_batch(batch_items, workspaceID, channelID):
    print("processing batch of size: " + str(len(batch_items)))
    questions = []

    for question in batch_items:
        questions.append({"vector": np.frombuffer(bytes(question['vector'])), "workspaceID": workspaceID,
                          "messageTs": question['messageTs']})
    return questions


def get_questions_dynamo(workspaceID, channelID, table):
    questions = []

    response = table.query(
        KeyConditionExpression=Key("workspaceID").eq(workspaceID) & Key(
            'channelID#ts').begins_with(channelID)
    )
    startkey = response.get('LastEvaluatedKey', None)
    questions.extend(process_batch(
        response['Items'], workspaceID, channelID))

    while startkey is not None:
        response = table.query(
            ExclusiveStartKey=startkey,
            KeyConditionExpression=Key("workspaceID").eq(workspaceID) & Key(
                'channelID#ts').begins_with(channelID)
        )
        startkey = response.get('LastEvaluatedKey', None)
        questions.extend(process_batch(
            response['Items'], workspaceID, channelID))

    return questions


def build_question_similarity_matrix(questions, similarity_threshold):
    similarity_matrix = {}
    for i in range(len(questions)-1):
        question = questions[i]
        if question['messageTs'] not in similarity_matrix:
            similarity_matrix[question['messageTs']] = []
        for j in range(i+1, len(questions)):
            comparison_question = questions[j]
            if comparison_question['messageTs'] not in similarity_matrix:
                similarity_matrix[comparison_question['messageTs']] = []
            similar_questions_ts = []
            similarity = cosine_similarity(
                question['vector'], comparison_question['vector'])
            if similarity >= similarity_threshold:
                similarity_matrix[question['messageTs']].append(
                    {"messageTs": comparison_question['messageTs'], "similarity": similarity})
                similarity_matrix[comparison_question['messageTs']].append(
                    {"messageTs": question['messageTs'], "similarity": similarity})

    for question in questions:
        questionTs = question['messageTs']
        similarity_matrix[questionTs].sort(
            key=lambda x: x['similarity'], reverse=True)
    return similarity_matrix


def get_similarity_matrix(questions, similarity_threshold):
    similarity_matrix = build_question_similarity_matrix(
        questions, similarity_threshold)
    return similarity_matrix


def get_percent_questions_with_recommendation(similarity_matrix, questions):
    num_no_recommend = 0
    for question in questions:
        questionTs = question['messageTs']
        if len(similarity_matrix[questionTs]) == 0:
            num_no_recommend += 1
    return "{:.2f}".format(((len(questions) - num_no_recommend)/len(questions)) * 100)

# level can be one of ERROR, WARN, or DEBUG. ERROR and WARN are logged in prod and dev


def custom_log(input, level):
    env = None
    if os.environ['ENVIRONMENT'] is not None:
        env = os.environ['ENVIRONMENT']
    else:
        env = "dev"

    if env == "prod":
        if (level == "ERROR" or level == "WARN"):
            print("level: {level} input: {input}".format(
                level=level, input=json.dumps(input)))
    elif env == "dev":
        if (level == "ERROR" or level == "WARN" or level == "DEBUG"):
            print("level: {level} input: {input}".format(
                level=level, input=json.dumps(input)))
        else:
            print(
                "invalid log level specified, please input one of ERROR, WARN, or DEBUG")
    else:
        print("no env was set, error!")
