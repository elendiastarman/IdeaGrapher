from graphstore.models import MongoModel, Node, Link, ObjectNotFound
from bson import ObjectId
MongoModel.set_database("test")
MongoModel.connect("localhost", 27017)

n1_shortname = "testnode1"
n2_shortname = "testnode2"

try:
  n1 = Node.find_one({'shortname': n1_shortname})
except ObjectNotFound:
  n1 = Node(shortname="testnode1")
  n1.save()

try:
  n2 = Node.find_one({'shortname': n2_shortname})
except ObjectNotFound:
  n2 = Node(shortname="testnode2")
  n2.save()

assert n1.shortname != n2.shortname

try:
  l1 = Link.find_one({'sources': [n1.id], 'sinks': [n2.id]})
  assert l1.sources[0] == n1
  assert l1.sinks[0] == n2
except ObjectNotFound:
  l1 = Link(kind="connected", sources=[n1], sinks=[n2])
  l1.save()

  try:
    l2 = Link.find_one({'_id': ObjectId(l1.id)})
    assert l2.sources[0] == n1
    assert l2.sinks[0] == n2
  except AssertionError:
    # import ipdb; ipdb.set_trace()
    pass
