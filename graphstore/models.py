from bson import ObjectId
from pymongo import MongoClient
import json

deferred_funcs = []  # for e.g. resolving circular dependencies


# ## Base classes
class MongoModel:
  fields = {}
  CLIENT = None
  DATABASE = None
  COLLECTION = None
  _id = None

  def __init__(self, _database=None, _collection=None, **kwargs):
    self.fields = {}
    for name, field in self.__class__.fields.items():
      self.fields[name] = field.copy()

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
      model_refs.get_or_make_ref(self.__class__, self._id, obj=self)
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

  def serialize_with_id(self):
    data = self.serialize()
    data['id'] = self.id
    return data

  def json(self):
    return json.dumps(self.serialize_with_id())

  @classmethod
  def deserialize(cls, data):
    if not isinstance(data, dict):
      raise ValueError("Data ({}) for model {} must be a dict, not a {}".format(data, cls, type(data)))

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

    obj = cls(**deserialized_data)
    obj._id = data['_id']

    return obj

  @classmethod
  def find(cls, query={}):
    if not cls.CLIENT:
      raise ValueError("Must be connected to Mongo.")

    docs = cls.CLIENT[cls.DATABASE][cls.COLLECTION].find(query)

    return [model_refs.get_or_make_ref(cls, id=doc['_id'], data=doc) for doc in docs]

  @classmethod
  def find_one(cls, query):
    if not cls.CLIENT:
      raise ValueError("Must be connected to Mongo.")

    doc = cls.CLIENT[cls.DATABASE][cls.COLLECTION].find_one(query)
    if doc is None:
      raise ObjectNotFound("No {} was found with query {}.".format(cls, query))

    return model_refs.get_or_make_ref(cls, id=doc['_id'], data=doc)

  @classmethod
  def get_by_id(cls, object_id):
    if isinstance(object_id, str):
      object_id = ObjectId(object_id)

    return cls.find_one({'_id': object_id})


class MongoField:
  config = None

  def __init__(self, **kwargs):
    kwargs.setdefault('default', None)
    kwargs.setdefault('nullable', False)
    self.config = kwargs

    for key, value in kwargs.items():
      setattr(self, key, value)

    self.value = self.config['default']

  def copy(self):
    return self.__class__(**self.config.copy())

  def update_config(self, key, new_value):
    self.config[key] = new_value
    setattr(self, key, new_value)

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

  def deserialize(self, data):
    return data
    # ret = cls(default=cls.clean(data))
    # ret.validate()
    # return ret


# ## Specialized fields
class IntegerField(MongoField):
  def __init__(self, **kwargs):
    kwargs.setdefault('min_value', None)
    kwargs.setdefault('max_value', None)
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
  def __init__(self, **kwargs):
    kwargs.setdefault('max_length', 0)
    super().__init__(**kwargs)

  def validate(self):
    super().validate()

    if not isinstance(self.value, str):
      raise ValueError("Value must be {}, not {}.".format(str, type(self.value)))

    if self.max_length and len(self.value) > self.max_length:
      raise ValueError("Maximum length is {}; actual length is {}.".format(self.max_length, len(self.value)))


class ListField(MongoField):
  def __init__(self, field_class, **kwargs):
    kwargs.setdefault('max_length', 0)
    kwargs.setdefault('field_class', field_class)
    kwargs.setdefault('default', [])
    super().__init__(**kwargs)

  def validate(self):
    super().validate()

    if self.max_length and len(self.value) > self.max_length:
      raise ValueError("Maximum length is {}; actual length is {}.".format(self.max_length, len(self.value)))

    errors = []

    for idx, val in enumerate(self.value):
      if not isinstance(val, self.field_class.model_class if isinstance(self.field_class, ModelField) else self.field_class):
        errors.append((idx, type(val), val))

    if errors:
      raise ValueError("Not all elements were {}; bad elements: {}".format(self.field_class, errors))

  def serialize(self):
    if isinstance(self.field_class, ModelField):
      return [item.id for item in self.value]
    else:
      return [str(item) for item in self.value]

  def deserialize(self, data):
    if isinstance(self.field_class, ModelField):
      return [model_refs.get_or_make_ref(self.field_class.model_class, item) for item in data]
    else:
      return [self.field_class(item) for item in data]


class EnumField(MongoField):
  def __init__(self, allowed, **kwargs):
    kwargs.setdefault('allowed', allowed)
    super().__init__(**kwargs)

  def validate(self):
    super().validate()

    if self.value not in self.allowed:
      raise ValueError("Value is {} but it must be one of {}.".format(self.value, self.allowed))


class ModelField(MongoField):
  def __init__(self, model_class, **kwargs):
    if isinstance(model_class, str):
      deferred_funcs.append(lambda: lambda instance, model_cls: instance.update_config('model_class', locals()[model_cls])(self, model_class))
    else:
      kwargs.setdefault('model_class', model_class)

    super().__init__(**kwargs)


# ## Custom error classes
class ObjectNotFound(ValueError):
  pass


# ## Node-related models
class Node(MongoModel):
  shortname = StringField(max_length=30)
  blurb = StringField(max_length=200, default="")
  explanation = StringField(default="")
  subgraph = ListField(ModelField('Graph'))


class Link(MongoModel):
  kind = EnumField(["connected", "related", "directed"])
  sources = ListField(ModelField(Node))
  sinks = ListField(ModelField(Node))


class Graph(MongoModel):
  slug = StringField(max_length=30)
  blurb = StringField(max_length=200, default="")
  explanation = StringField(default="")
  links = ListField(ModelField(Link))
  nodes = ListField(ModelField(Node))


# ## Hacky stuff

class ModelRefs:
  def __init__(self):
    self.models = {}

  def add_model(self, model_class):
    self.models[model_class] = {}

  def get_or_make_ref(self, model_class, id, data=None, obj=None):
    # key = model_class.__name__ if isinstance(model_class, type) and issubclass(model_class, MongoModel) else model_class
    # if '_id' in data:
    #   key = data['_id']
    # else:
    #   raise ValueError("Attempted to get/make reference for {} instance with no '_id' in this data: {}".format(model_class, data))
    key = str(id)

    if model_class is None:
      raise ValueError("model_class is None and it should not be.")
    elif model_class not in self.models:
      raise ValueError("model_class {} is somehow unknown. (Was it added with add_model?)".format(model_class))

    if key in self.models[model_class]:
      return self.models[model_class][key]
    else:
      if obj is None:
        if data is None:
          obj = model_class.get_by_id(id)
        else:
          obj = model_class.deserialize(data)

      return self.models[model_class].setdefault(key, obj)

model_refs = ModelRefs()

frozen_locals = locals().copy()
for key, item in frozen_locals.items():
  if isinstance(item, type) and issubclass(item, MongoModel):
    # Set each class' COLLECTION variable
    item.COLLECTION = item.default_collection_name()

    model_refs.add_model(item)

    # initialize model class' fields variable and stuff it with the defined fields
    item.fields = {}
    for field_name in dir(item):
      attr = getattr(item, field_name)
      if isinstance(attr, MongoField):
        item.fields[field_name] = attr

# execute deferred functions
for func in deferred_funcs:
  func()
