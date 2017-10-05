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
        errors[field_name] = e

  def serialize(self):
    pass

  @classmethod
  def deserialize(cls, data):
    pass


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

  @classmethod
  def deserialize(cls, data):
    return cls(data)


# ## Specialized fields
class IntegerField(MongoField):
  pass


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


# ## Node-related models
class Node(MongoModel):
  shortname = StringField(max_length=30)
  blurb = StringField(max_length=200, default="")
  explanation = StringField(default="")
