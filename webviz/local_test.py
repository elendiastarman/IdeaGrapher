from graphstore.models import MongoModel, Node, ObjectNotFound
from webviz.models import Vertex
# from bson import ObjectId
MongoModel.connect_to_database("test", "localhost", 27017)

try:
  n = Node.find_one({})
except ObjectNotFound:
  n = Node()
  n.save()

try:
  v = Vertex.find_one({'node': n.id})
  assert v.node.id == n.id
except ObjectNotFound:
  v = Vertex(node=n.id)
  v.save()

print(v.json())
