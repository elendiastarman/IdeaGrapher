from django.shortcuts import render
from django.http import Http404
from graphstore.models import MongoModel, Node, Link


# Create your views here.
def home_view(request, **kwargs):
  context = {}

  MongoModel.set_database("test")
  MongoModel.connect("localhost", 27017)

  # print("user:", request.user)

  context['nodes'] = Node.find({})
  context['links'] = Link.find({})

  return render(request, 'graphstore/home.html', context)


def favicon(request, **kwargs):
  raise Http404()
