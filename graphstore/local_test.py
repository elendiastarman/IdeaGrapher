from graphstore.models import *
MongoModel.set_database("test")
MongoModel.connect("localhost", 27017, "test", "test")

n1_id = ""
n2_id = ""

try:
  n1 = Node.get_by_id(n1_id)
except:
  n1 = Node(shortname="node1")
  n1.save()

try:
  n2 = Node.get_by_id(n2_id)
except:
  n2 = Node(shortname="node2")
  n2.save()

assert n1.shortname != n2.shortname

l1_id = ""

try:
  l1 = Link.get_by_id(l1_id)
except:
  l1 = Link(kind="connected", sources=[n1], sinks=[n2])
  l1.save()
