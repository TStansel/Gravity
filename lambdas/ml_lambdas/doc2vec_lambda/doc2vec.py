import gensim

model = gensim.models.doc2vec.Doc2Vec.load('model/so_top_100k_vec_50_win_5_min_2_ep_80.pkl')

def lambda_handler(event=None, context=None):
  return model.infer_vector(string_to_tokens(event["raw_text"]))

def string_to_tokens(string):
    return gensim.utils.simple_preprocess(string)

