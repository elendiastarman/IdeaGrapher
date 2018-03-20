from graphstore.models import MongoModel, MongoIndex, ObjectNotFound, Graph, Node, Link, ModelField, StringField, BytesField, ListField, EnumField, DictField
import bcrypt
import random
import string


# Create your models here.
class Account(MongoModel):
  username = StringField(max_length=50)
  password = BytesField()
  email = StringField()
  webs = ListField(ModelField('Web'))
  session_auth_hash = StringField(default='')
  genid = StringField()

  username_index = MongoIndex(['username'], unique=True)
  email_index = MongoIndex(['email'], unique=True)
  genid_index = MongoIndex(['genid'], unique=True)

  def __init__(self, **kwargs):
    if isinstance(kwargs['password'], str):
      kwargs['password'] = bcrypt.hashpw(bytes(kwargs['password'], encoding='utf-8'), bcrypt.gensalt())  # hash it pronto!

    super().__init__(**kwargs)

    if self._id is None:
      self.genid = ''.join([random.choice(string.ascii_letters) for i in range(20)])

  def save(self):
    if self.session_auth_hash is None:
      self.session_auth_hash = ''.join([random.choice(string.ascii_letters) for i in range(20)])

    super().save()

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

  def json(self, exclude=[]):
    return super().json(exclude=exclude + ['password'])

  def get_session_auth_hash(self):
    return self.session_auth_hash

  def set_session_auth_hash(self, new_session_auth_hash):
    self.session_auth_hash = new_session_auth_hash


class Vertex(MongoModel):
  node = ModelField(Node)
  labels = ListField(StringField)
  subwebs = ListField(ModelField('Web'))
  data = DictField()


class Edge(MongoModel):
  link = ModelField(Link)
  kind = EnumField(['connected', 'related', 'directed'], default='connected')
  start_vertices = ListField(ModelField(Vertex))
  end_vertices = ListField(ModelField(Vertex))
  data = DictField()


class Web(MongoModel):
  graph = ModelField(Graph)
  name = StringField(default='')  # '' means it's untitled
  owner = StringField()  # Account.genid
  visibility = EnumField(['private', 'shared', 'public'], default='private')
  vertices = ListField(ModelField(Vertex))
  edges = ListField(ModelField(Edge))
  rules = ListField(ModelField('Rule'))
  data = DictField()

  visibility_index = MongoIndex(['visibility'])
  owner_index = MongoIndex(['owner'])


class Rule(MongoModel):
  pass
