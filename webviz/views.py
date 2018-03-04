from django.shortcuts import render
from django.contrib.auth import login, logout
from django.http import Http404, HttpResponseRedirect
from graphstore.models import MongoModel, Graph  # , Node, Link

from .models import Account
from .forms import LoginForm


# Create your views here.
def home_view(request, **kwargs):
  context = {}

  MongoModel.connect_to_database("test", "localhost", 27017)

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
    form = LoginForm(request.POST)

    if form.is_valid():
      username = form.cleaned_data['username']
      password = form.cleaned_data['password']
      user = Account.authenticate(username, password)

      if user is not None:
        login(request, user)
        return HttpResponseRedirect('/')

      else:
        pass  # return 'invalid login' error message

  else:
    form = LoginForm()

  return render(request, 'login.html', {'form': form})


def login_ajax(request, **kwargs):
  pass


def logout_view(request, **kwargs):
  logout(request)
  # redirect


def forgot_password_view(request, **kwargs):
  pass
