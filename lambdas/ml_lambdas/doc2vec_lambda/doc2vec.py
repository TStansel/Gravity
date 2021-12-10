import gensim
import json

model = gensim.models.doc2vec.Doc2Vec.load('so_top_100k_vec_50_win_5_min_2_ep_80.pkl')

def lambda_handler(event=None, context=None):
  questions = event["payload"]["questions"]
  results = list(map(lambda question_text: {"vector": model.infer_vector(string_to_tokens(question_text)).tolist()}, questions))
  return json.dumps(results)

def string_to_tokens(string):
    return gensim.utils.simple_preprocess(string)

