from graphstore.models import MongoModel, ObjectNotFound, Graph, Node, Link, ModelField, StringField, BytesField, ListField, FloatField, DictField
import bcrypt


# Create your models here.
class Account(MongoModel):
  username = StringField(max_length=50)
  password = BytesField()
  email = StringField()
  webs = ListField(ModelField('Web'))

  def __init__(self, **kwargs):
    if isinstance(kwargs['password'], str):
      kwargs['password'] = bcrypt.hashpw(bytes(kwargs['password'], encoding='utf-8'), bcrypt.gensalt())  # hash it pronto!

    super().__init__(**kwargs)

  @classmethod
  def authenticate(cls, username, password):
    if isinstance(password, str):
      password = bytes(password, encoding='utf-8')

    try:
      account = cls.find_one({'username': username})

      if bcrypt.hashpw(password, account.password) == account.password:
        return account
      else:
        return None

    except ObjectNotFound:
      return None

  def json(self):
    return super().json(exclude=['password'])


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
