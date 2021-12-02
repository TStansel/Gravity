import numpy as np
import json

def lambda_handler(event=None, context=None):
  print("Request Event: ",event)
  new_question = event["payload"]["new_question"]
  old_questions = event["payload"]["old_questions"]
  
  similarities = np.array(list(map(lambda old_question: cosine_similarity(new_question, json.loads(old_question["TextVector"])["vector"]), old_questions)))
  top_10_idx = similarities.argsort()[-10:][::-1]

  return json.dumps(list(map(lambda idx: {"QuestionID": old_questions[idx]["QuestionID"], "similarity": similarities[idx]}, top_10_idx)))


def cosine_similarity(v1, v2):
  return np.dot(v1, v2)/(np.linalg.norm(v1)*np.linalg.norm(v2))