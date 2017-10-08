import bson
import json
from pymongo import MongoClient


# ## Base classes
class MongoModel:
  fields = {}
  DATABASE = None
  CLIENT = None
  _id = None

  def __init__(self, _database=None, _collection=None):
    self.DATABASE = _database or self.__class__.DATABASE
    if not self.DATABASE:
      raise ValueError("Either MongoModel.DATABASE or _database must not be None.")

    self.COLLECTION = _collection or str(self.__class__).split('.')[-1][:-2].lower()

    for field_name in dir(self):
      attr = self.__getattribute__(field_name)
      if isinstance(attr, MongoField):
        self.fields[field_name].append(attr)

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
    return json.dumps({field_name: field.serialize() for field_name, field in self.fields.items()})

  def deserialize(self, data):
    if not isinstance(data, dict):
      raise ValueError("Data must be a dict, not a {}".format(type(data)))

    errors = {}

    for key, value in data.items():
      if key not in self.fields:
        errors[key] = "{} is not a field on this model.".format(key)
        continue

      try:
        self.fields[key].deserialize(value)
      except ValueError as e:
        errors[key] = e.args[0]

    if errors:
      raise ValueError("Errors during deserialization: {}".format(errors))


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

  def clean(self, new_value):
    return new_value

  def serialize(self):
    return str(self.value)

  def deserialize(self, data):
    self.set(data)


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
    return json.dumps([element.serialize() for element in self.value])

  def deserialize(self):
    pass


class ModelField(MongoField):
  def __init__(self, **kwargs):
    super().__init__(**kwargs)

  def validate(self):
    super().validate()

    if not isinstance(self.value, bson.ObjectId):
      raise ValueError("Value must be {}, not {}.".format(bson.ObjectId, type(self.value)))


# ## Node-related models
class Node(MongoModel):
  shortname = StringField(max_length=30)
  blurb = StringField(max_length=200, default="")
  explanation = StringField(default="")


class Graph(MongoModel):
  nodes = ListField(ModelField)
