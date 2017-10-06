import json

DATABASE = "graphstore"


# ## Base classes
class MongoModel(object):
  fields = {}

  def __init__(self, sparse=False):
    self.sparse = sparse

    for field_name in dir(self):
      attr = self.__getattribute__(field_name)
      if isinstance(attr, MongoField):
        self.fields[field_name].append(attr)

  def save(self):
    errors = self.validate()

    if errors:
      raise ValueError("Data error(s): {}".format(errors))

    # TODO: actually save to database here

  def validate(self):
    errors = {}

    for field_name, field in self.fields.items():
      try:
        field.validate()
      except ValueError as e:
        errors[field_name] = e.args[0]

    return errors

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


class MongoField(object):
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
  pass


# ## Node-related models
class Node(MongoModel):
  shortname = StringField(max_length=30)
  blurb = StringField(max_length=200, default="")
  explanation = StringField(default="")
