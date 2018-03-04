from django.shortcuts import render
from django.contrib.auth import login, logout
from django.http import Http404
from graphstore.models import MongoModel, Graph, Account  # , Node, Link


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


def register_view(request, **kwargs):
  pass


def login_view(request, **kwargs):
  if request.method == 'POST':
    username = request.POST['username']
    password = request.POST['password']
    user = Account.authenticate(username, password)

    if user is not None:
      login(request, user)
      # redirect to success
    else:
      pass  # return 'invalid login' error message


def logout_view(request, **kwargs):
  logout(request)
  # redirect


def forgot_password_view(request, **kwargs):
  pass
