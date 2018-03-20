from bson import ObjectId
from pymongo import MongoClient, ASCENDING
import json

from . import MONGO_CLIENT, MONGO_DATABASE


# ## Base classes
class MongoModelMeta(type):
  def __init__(cls, name, bases, dct):
    if not hasattr(cls, 'model_refs'):
      # base class; create reference dictionary
      cls.model_name_map = {}
      cls.model_refs = {}

    else:
      cls.model_name_map[name] = cls
      cls.model_refs[cls] = {}

      # Set each class' COLLECTION variable
      cls.COLLECTION = cls.default_collection_name()

      # initialize model class' fields variable and stuff it with the defined fields
      cls.fields = {}
      cls.indexes = {}
      for attr_name in dir(cls):
        attr = getattr(cls, attr_name)
        if isinstance(attr, MongoField):
          cls.fields[attr_name] = attr

        if isinstance(attr, MongoIndex):
          cls.indexes[attr_name] = attr

      index_info = cls.collection().index_information()
      for index_name, index in cls.indexes.items():
        if index_name not in index_info:
          index.kwargs['name'] = index_name

          for i, key in enumerate(index.keys):
            if isinstance(key, str):
              index.keys[i] = (key, ASCENDING)

          print("Creating index {} with keys {} and kwargs {}...".format(index_name, index.keys, index.kwargs))
          cls.collection().create_index(index.keys, **index.kwargs)
          print("...done.")

      if name in cls.dependencies:
        field_instances = cls.dependencies[name]

        for field_instance in field_instances:
          field_instance.update_config('model_class', cls)


class MongoModel(object, metaclass=MongoModelMeta):
  fields = {}
  indexes = {}
  dependencies = {}
  CLIENT = MONGO_CLIENT
  DATABASE = MONGO_DATABASE
  COLLECTION = None
  STRICT = True
  _id = None

  def __init__(self, _database=None, _collection=None, **kwargs):
    self.fields = {}
    for name, field in self.__class__.fields.items():
      self.fields[name] = field.copy()

    self.DATABASE = _database or self.__class__.DATABASE
    if not self.DATABASE:
      raise ValueError("Either MongoModel.DATABASE or _database must not be None. Use MongoModel.connect_to_database.")

    if _collection:
      self.COLLECTION = _collection

    for key, value in kwargs.items():
      self.__setattr__(key, value)

  @classmethod
  def connect_to_database(cls, database, uri, port, username=None, password=None, auth_source="admin", auth_mechanism="SCRAM-SHA-1"):
    cls.DATABASE = database

    if username and password:
      cls.CLIENT = MongoClient(uri, port, username=username, password=password, authSource=auth_source, authMechanism=auth_mechanism)
    else:
      cls.CLIENT = MongoClient(uri, port)

  @property
  def id(self):
    return str(self._id) if self._id else None

  @classmethod
  def collection(cls):
    return cls.CLIENT[cls.DATABASE][cls.COLLECTION]

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

  @classmethod
  def get_or_make_ref(cls, model_class, id, data=None, obj=None):
    key = str(id)

    if model_class is None:
      raise ValueError("model_class is None and it should not be.")
    elif model_class not in cls.model_refs:
      raise ValueError("model_class {} is somehow unknown.".format(model_class))

    if key in cls.model_refs[model_class]:
      return cls.model_refs[model_class][key]
    else:
      if obj is None:
        if data is None:
          obj = model_class.get_by_id(id)
        else:
          obj = model_class.deserialize(data)

      return cls.model_refs[model_class].setdefault(key, obj)

  @classmethod
  def add_model_dependency(cls, name, field_instance):
    # check model refs first
    if name in cls.model_name_map:
      field_instance.update_config('model_class', cls.model_name_map[name])

    if name not in cls.dependencies:
      cls.dependencies[name] = []

    cls.dependencies[name].append(field_instance)

  def save(self):
    if not self.CLIENT:
      raise ValueError("Must be connected to Mongo.")

    errors = self.validate()

    if errors:
      raise ValueError("Data error(s): {}".format(errors))

    if not self._id:
      result = self.CLIENT[self.DATABASE][self.COLLECTION].insert_one(self.serialize())
      self._id = result.inserted_id
      self.get_or_make_ref(self.__class__, self._id, obj=self)
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

  def serialize(self, exclude=[]):
    return {field_name: field.serialize() for field_name, field in self.fields.items() if not isinstance(field, RawField) and field_name not in exclude}

  def serialize_with_id(self, exclude=[]):
    data = self.serialize(exclude=exclude)
    data['id'] = self.id
    return data

  def json(self, exclude=[]):
    return json.dumps(self.serialize_with_id(exclude=exclude))

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
        if cls.STRICT:
          errors[key] = "{} is not a field on this model.".format(key)
          continue
        else:
          cls.fields[key] = RawField()

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
    if not MONGO_CLIENT:
      raise ValueError("Must be connected to Mongo.")

    docs = MONGO_CLIENT[MONGO_DATABASE][cls.COLLECTION].find(query)

    return [cls.get_or_make_ref(cls, id=doc['_id'], data=doc) for doc in docs]

  @classmethod
  def find_one(cls, query):
    if not MONGO_CLIENT:
      raise ValueError("Must be connected to Mongo.")

    doc = MONGO_CLIENT[MONGO_DATABASE][cls.COLLECTION].find_one(query)
    if doc is None:
      raise ObjectNotFound("No {} was found with query {}.".format(cls, query))

    return cls.get_or_make_ref(cls, id=doc['_id'], data=doc)

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
    if self.config is None:
      self.config = {}

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


class RawField(MongoField):
  def validate(self):
    pass

  def serialize(self):
    return self.value


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


class FloatField(MongoField):
  def __init__(self, **kwargs):
    kwargs.setdefault('min_value', None)
    kwargs.setdefault('max_value', None)
    kwargs.setdefault('step', None)
    super().__init__(**kwargs)

  def validate(self):
    super().validate()

    if not isinstance(self.value, float):
      if isinstance(self.value, int):
        self.value = float(self.value)
      else:
        raise ValueError("Value {} must be {}, not {}.".format(self.value, float, type(self.value)))

    if self.min_value and self.value < self.min_value:
      raise ValueError("Minimum value is {}; actual value is {}.".format(self.min_value, self.value))

    if self.max_value and self.value > self.max_value:
      raise ValueError("Maximum value is {}; actual value is {}.".format(self.max_value, self.value))

    # TODO: should I really always "round" the value?
    # TODO: handles negative values wrong
    if self.step:
      self.value = self.value - ((self.value + self.step / 2) % self.step) + self.step / 2


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


class BytesField(MongoField):
  def __init__(self, **kwargs):
    kwargs.setdefault('max_length', 0)
    super().__init__(**kwargs)

  def serialize(self):
    return self.value

  def validate(self):
    super().validate()

    if not isinstance(self.value, bytes):
      raise ValueError("Value must be {}, not {}.".format(bytes, type(self.value)))

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
      return [self.field_class.model_class.get_or_make_ref(self.field_class.model_class, item) for item in data]
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


class DictField(MongoField):
  def validate(self):
    super().validate()

    if not isinstance(self.value, dict):
      raise ValueError("Value {} is a {} but must be a {}.".format(self.value, type(self.value), type(dict)))


class ModelField(MongoField):
  def __init__(self, model_class, **kwargs):
    if isinstance(model_class, str):
      MongoModel.add_model_dependency(model_class, self)
    else:
      kwargs.setdefault('model_class', model_class)

    super().__init__(**kwargs)


# ## index stuff
class MongoIndex(object):
  def __init__(self, keys, **kwargs):
    self.keys = keys
    self.kwargs = kwargs


# ## Custom error classes
class ObjectNotFound(ValueError):
  pass


# ## Node-related models
class Node(MongoModel):
  subgraphs = ListField(ModelField('Graph'))
  data = DictField()


class Link(MongoModel):
  sources = ListField(ModelField(Node))
  sinks = ListField(ModelField(Node))
  data = DictField()


class Graph(MongoModel):
  links = ListField(ModelField(Link))
  nodes = ListField(ModelField(Node))
  data = DictField()
