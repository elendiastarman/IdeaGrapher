from bson import ObjectId
from pymongo import MongoClient

deferred_funcs = []  # for e.g. resolving circular dependencies


# ## Base classes
class MongoModel:
  fields = {}
  CLIENT = None
  DATABASE = None
  COLLECTION = None
  _id = None

  def __init__(self, _database=None, _collection=None, **kwargs):
    self.DATABASE = _database or self.__class__.DATABASE
    if not self.DATABASE:
      raise ValueError("Either MongoModel.DATABASE or _database must not be None. Use MongoModel.set_database.")

    if _collection:
      self.COLLECTION = _collection

    for key, value in kwargs.items():
      self.__setattr__(key, value)

  @classmethod
  def connect(cls, uri, port, username=None, password=None, auth_source="admin", auth_mechanism="SCRAM-SHA-1"):
    if username and password:
      cls.CLIENT = MongoClient(uri, port, username=username, password=password, authSource=auth_source, authMechanism=auth_mechanism)
    else:
      cls.CLIENT = MongoClient(uri, port)

  @classmethod
  def set_database(cls, new_database):
    cls.DATABASE = new_database

  @property
  def id(self):
    return str(self._id) if self._id else None

  def __getattribute__(self, name):
    if name != "fields" and name in self.fields:
      return self.fields[name].value
    else:
      return super().__getattribute__(name)

  def __setattr__(self, name, new_value):
    if name != "fields" and name in self.fields:
      self.fields[name].value = new_value
    else:
      super().__setattr__(name, new_value)

  @classmethod
  def default_collection_name(cls):
    return str(cls).split('.')[-1][:-2].lower()  # the class name lowercased

  def save(self):
    if not self.CLIENT:
      raise ValueError("Must be connected to Mongo.")

    errors = self.validate()

    if errors:
      raise ValueError("Data error(s): {}".format(errors))

    # TODO: actually save to database here
    if not self._id:
      result = self.CLIENT[self.DATABASE][self.COLLECTION].insert_one(self.serialize())
      self._id = result.inserted_id
    else:
      changed = self.changed()
      if changed:
        result = self.CLIENT[self.DATABASE][self.COLLECTION].update_one({'_id': self._id}, {'$set': changed})

  def validate(self):
    errors = {}

    for field_name, field in self.fields.items():
      try:
        field.validate()
      except ValueError as e:
        errors[field_name] = e.args[0]

    return errors

  def changed(self):
    return self.serialize()

    # TODO: Identify only what changed
    # if self.dirty:
    #   pass

  def serialize(self):
    return {field_name: field.serialize() for field_name, field in self.fields.items()}

  @classmethod
  def deserialize(cls, data):
    if not isinstance(data, dict):
      raise ValueError("Data must be a dict, not a {}".format(type(data)))

    errors = {}
    deserialized_data = {}

    for key, value in data.items():
      # skip fields that start with an underscore, like _id
      if key[0] == '_':
        continue
      elif key not in cls.fields:
        errors[key] = "{} is not a field on this model.".format(key)
        continue

      try:
        deserialized_data[key] = cls.fields[key].deserialize(value)
      except ValueError as e:
        errors[key] = e.args[0]

    if errors:
      raise ValueError("Errors during deserialization: {}".format(errors))

    return cls(deserialized_data)

  @classmethod
  def find_one(cls, object_id):
    if not cls.CLIENT:
      raise ValueError("Must be connected to Mongo.")

    if isinstance(object_id, str):
      object_id = ObjectId(object_id)

    print("Collection:", cls.CLIENT[cls.DATABASE][cls.COLLECTION])
    doc = cls.CLIENT[cls.DATABASE][cls.COLLECTION].find_one({'_id': object_id})
    print("doc:", doc)
    return cls.deserialize(doc)


class MongoField:
  def __init__(self, default=None, nullable=False):
    self.value = default
    self.nullable = nullable

  def set(self, new_value):
    self.value = self.clean(new_value)
    self.validate()

  def validate(self):
    if not self.nullable and self.value is None:
      raise ValueError("This instance of {} cannot be None.".format(type(self)))

  @classmethod
  def clean(cls, new_value):
    return new_value

  def serialize(self):
    return str(self.value)

  @classmethod
  def deserialize(cls, data):
    return data
    # ret = cls(default=cls.clean(data))
    # ret.validate()
    # return ret


# ## Specialized fields
class IntegerField(MongoField):
  def __init__(self, min_value=None, max_value=None, **kwargs):
    super().__init__(**kwargs)

  def validate(self):
    super().validate()

    if not isinstance(self.value, int):
      raise ValueError("Value must be {}, not {}.".format(int, type(self.value)))

    if self.min_value and self.value < self.min_value:
      raise ValueError("Minimum value is {}; actual value is {}.".format(self.min_value, self.value))

    if self.max_value and self.value > self.max_value:
      raise ValueError("Maximum value is {}; actual value is {}.".format(self.max_value, self.value))


class StringField(MongoField):
  def __init__(self, max_length=0, **kwargs):
    super().__init__(**kwargs)
    self.max_length = max_length

  def validate(self):
    super().validate()

    if not isinstance(self.value, str):
      raise ValueError("Value must be {}, not {}.".format(str, type(self.value)))

    if self.max_length and len(self.value) > self.max_length:
      raise ValueError("Maximum length is {}; actual length is {}.".format(self.max_length, len(self.value)))


class ListField(MongoField):
  def __init__(self, field_class, max_length=0, **kwargs):
    super().__init__(**kwargs)
    self.max_length = max_length
    self.field_class = field_class
    self.value = []

  def validate(self):
    super().validate()

    if self.max_length and len(self.value) > self.max_length:
      raise ValueError("Maximum length is {}; actual length is {}.".format(self.max_length, len(self.value)))

    errors = []

    for idx, val in enumerate(self.value):
      if not isinstance(val, self.field_class):
        errors.append((idx, type(val), val))

    if errors:
      raise ValueError("Not all elements were {}; bad elements: {}".format(self.field_class, errors))

  def serialize(self):
    return [element.serialize() for element in self.value]

  # @classmethod
  # def deserialize(cls):
  #   pass


class EnumField(MongoField):
  def __init__(self, allowed, **kwargs):
    super().__init__(**kwargs)
    self.allowed = allowed

  def validate(self):
    super().validate()

    if self.value not in self.allowed:
      raise ValueError("Value is {} but it must be one of {}.".format(self.value, self.allowed))


class ModelField(MongoField):
  def __init__(self, model_class, **kwargs):
    super().__init__(**kwargs)

    if isinstance(model_class, str):
      deferred_funcs.append(lambda: lambda instance, model_cls: setattr(instance, 'model_class', locals()[model_cls])(self, model_class))
    else:
      self.model_class = model_class

  def validate(self):
    super().validate()

    if not isinstance(self.value, self.model_class):
      raise ValueError("Value must be {}, not {}.".format(self.model_class, type(self.value)))


# ## Node-related models
class Node(MongoModel):
  shortname = StringField(max_length=30)
  blurb = StringField(max_length=200, default="")
  explanation = StringField(default="")
  subgraph = ListField(ModelField('Graph'))


class Link(MongoModel):
  kind = EnumField(["connected", "related", "directed"])
  sources = ListField(MongoField(Node))
  sinks = ListField(MongoField(Node))


class Graph(MongoModel):
  slug = StringField(max_length=30)
  blurb = StringField(max_length=200, default="")
  explanation = StringField(default="")
  links = ListField(ModelField(Link))
  nodes = ListField(ModelField(Node))


# ## Hacky stuff

frozen_locals = locals().copy()
for key, item in frozen_locals.items():
  if isinstance(item, type) and issubclass(item, MongoModel):
    # Set each class' COLLECTION variable
    item.COLLECTION = item.default_collection_name()

    # initialize model class' fields variable and stuff it with the defined fields
    item.fields = {}
    for field_name in dir(item):
      attr = getattr(item, field_name)
      if isinstance(attr, MongoField):
        item.fields[field_name] = attr

# execute deferred functions
for func in deferred_funcs:
  func()
