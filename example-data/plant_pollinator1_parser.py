from graphstore.models import MongoModel, Graph, Node, Link, ObjectNotFound
import csv
# from bson import ObjectId

MongoModel.set_database("test")
MongoModel.connect("localhost", 27017)

try:
    graph = Graph.find_one({'slug': 'plant-pollinator1'})
    print("Graph found!", graph)
except ObjectNotFound:
    graph = Graph(slug='plant-pollinator1')
    graph.save()
    print("Graph created:", graph)

filepath = "example-data/arroyo_I plant-pollinator.csv"
reader = csv.reader(open(filepath))

row1 = next(reader)
row2 = next(reader)
next(reader)

plantN = len(row1) - 3
plantNodes = []

for i in range(plantN):
    name = row1[i + 3] + '\n' + row2[i + 3]

    try:
        node = Node.find_one({'shortname': name})
        print("Found node!", name, node)
    except ObjectNotFound:
        node = Node(shortname=name, blurb='plant')
        node.save()
        print("Node created:", name, node)

    plantNodes.append(node)
    if node not in graph.nodes:
        graph.nodes.append(node)

for row in reader:
    name = row[0] + '\n' + row[1]

    try:
        node = Node.find_one({'shortname': name})
        print("Found node!", name, node)
    except ObjectNotFound:
        node = Node(shortname=name, blurb='pollinator')
        node.save()
        print("Node created:", name, node)

    if node not in graph.nodes:
        graph.nodes.append(node)

    for i, k in enumerate(row[3:]):
        if k == '1':  # there is a relationship
            try:
                link = Link.find_one({'sources': [plantNodes[i - 3].id], 'sinks': [node.id]})
                print("Found link!", link)
            except ObjectNotFound:
                link = Link(kind="directed", sources=[plantNodes[i - 3]], sinks=[node], closeness=50)
                link.save()
                print("Link created:", link)

            if link not in graph.links:
                graph.links.append(link)

graph.save()
