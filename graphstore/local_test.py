from graphstore.models import *
MongoModel.set_database("test")
MongoModel.connect("localhost", 27017)

n1_shortname = "testnode1"
n2_shortname = "testnode2"

try:
  n1 = Node.find_one(n1_shortname)
except:
  n1 = Node(shortname="testnode1")
  n1.save()

try:
  n2 = Node.find_one(n2_shortname)
except:
  n2 = Node(shortname="testnode2")
  n2.save()

assert n1.shortname != n2.shortname

l1_shortname = "testlink1"

try:
  l1 = Link.find_one(l1_shortname)
except:
  import ipdb; ipdb.set_trace()
  l1 = Link(kind="connected", sources=[n1], sinks=[n2])
  l1.save()
