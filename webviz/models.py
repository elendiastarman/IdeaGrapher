from graphstore.models import MongoModel, Graph, Node, Link, ModelField, StringField, ListField, FloatField, DictField


# Create your models here.
class Account(MongoModel):
  username = StringField(max_length=50)
  password = StringField()
  email = StringField()
  webs = ListField(ModelField('Web'))


class Vertex(MongoModel):
  node = ModelField(Node)
  coords = ListField(FloatField)


class Edge(MongoModel):
  link = ModelField(Link)
  start_vertices = ListField(ModelField(Vertex))
  end_vertices = ListField(ModelField(Vertex))
  data = DictField()


class Web(MongoModel):
  graph = ModelField(Graph)
  vertices = ListField(ModelField(Vertex))
  edges = ListField(ModelField(Edge))
  rules = ListField(ModelField('Rule'))


class Rule(MongoModel):
  pass
