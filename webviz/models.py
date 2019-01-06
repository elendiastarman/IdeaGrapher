from graphstore.models import MongoModel, MongoIndex, ObjectNotFound, Graph, Node, Link, ModelField, StringField, BinaryField, ListField, EnumField, DictField, NestedField, FloatField
import bcrypt
import random
import string


# Create your models here.
class Account(MongoModel):
  DEFAULT_EXCLUDE = ['password']

  username = StringField(max_length=50)
  password = BinaryField()
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

    if kwargs.get('deserializing', False) is False:
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

  def get_session_auth_hash(self):
    return self.session_auth_hash

  def set_session_auth_hash(self, new_session_auth_hash):
    self.session_auth_hash = new_session_auth_hash


class Document(MongoModel):
  name = StringField(default='')
  owner = StringField()  # Account.genid
  visibility = EnumField(['private', 'shared', 'public'], default='private')

  webs = ListField(ModelField('Web'))
  rules = ListField(ModelField('Rule'))
  data = DictField()

  visibility_index = MongoIndex(['visibility'])
  owner_index = MongoIndex(['owner'])


class Vertex(MongoModel):
  node = ModelField(Node)
  screen = NestedField(dict(
    x=FloatField(default=0),
    y=FloatField(default=0),
    xv=FloatField(default=0),
    yv=FloatField(default=0),
    size=FloatField(default=100),
    color=StringField(default='gray'),
  ))
  labels = ListField(ModelField('Prop'))
  subwebs = ListField(ModelField('Web'))
  data = DictField()


class Edge(MongoModel):
  link = ModelField(Link)
  kind = EnumField(['connected', 'related', 'directed'], default='connected')
  start_vertices = ListField(ModelField(Vertex))
  end_vertices = ListField(ModelField(Vertex))
  data = DictField()


class Web(MongoModel):
  name = StringField(default='')
  graph = ModelField(Graph)
  vertices = ListField(ModelField(Vertex))
  edges = ListField(ModelField(Edge))
  screen = NestedField(dict(
    x=FloatField(default=0),
    y=FloatField(default=0),
    scale=FloatField(default=1),
  ))
  data = DictField()


class Rule(MongoModel):
  type = EnumField(['constraint', 'transformation'])
  data = DictField()


class Prop(MongoModel):
  type = EnumField(['text', 'image', '3d-model'], default='text')
  value = StringField()
  value_binary = BinaryField()
  data = DictField()
