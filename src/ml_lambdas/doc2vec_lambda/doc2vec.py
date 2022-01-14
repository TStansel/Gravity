import gensim
import json

model = gensim.models.doc2vec.Doc2Vec.load(
    'so_top_100k_vec_50_win_5_min_2_ep_80.pkl')


def lambda_handler(event=None, context=None):
    print("Request Event", event)
    return json.dumps({"vector": model.infer_vector(string_to_tokens(event["text"])).tolist()})


def string_to_tokens(string):
    return gensim.utils.simple_preprocess(string)
