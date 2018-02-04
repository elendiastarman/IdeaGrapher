from django.shortcuts import render
from django.http import Http404
from graphstore.models import MongoModel, Graph  # , Node, Link


# Create your views here.
def home_view(request, **kwargs):
  context = {}

  MongoModel.set_database("test")
  MongoModel.connect("localhost", 27017)

  # print("user:", request.user)

  graph = Graph.find_one({'slug': 'plant-pollinator1'})
  context['nodes'] = graph.nodes
  context['links'] = graph.links

  return render(request, 'graphstore/home.html', context)


def favicon(request, **kwargs):
  raise Http404()
