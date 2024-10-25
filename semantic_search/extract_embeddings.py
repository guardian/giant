from sentence_transformers import SentenceTransformer
sentences = ["Our vision To be the premier international defence, aerospace and security company."]

query = ["What's the vision?"]
model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')
embeddings = model.encode(query)
# write embeddings to file
list_embeddings = embeddings.tolist()
print(len(list_embeddings[0]))
import json
print(json.dumps(list_embeddings))
# with open('embeddings.txt', 'w') as f:
#     for emb in embeddings:
#         f.write(' '.join([str(x) for x in emb]) + '\n')


