from flask import request, session, render_template, redirect, abort
from . import app
from graphstore.models import MongoModel, Graph  # , Node, Link

from .models import Account
from .forms import LoginForm
from .auth import login, logout

MongoModel.connect_to_database("test", "localhost", 27017)


# Create your views here.
@app.route('/')
def home_view(**kwargs):
  context = {}

  # print("user:", request.user)
  print("session.items:", session.items())

  graph = Graph.find_one({'slug': 'plant-pollinator1'})
  context['nodes'] = graph.nodes
  context['links'] = graph.links

  return render_template('home.html', **context)


@app.route('/favicon')
def favicon(**kwargs):
  abort(404)


@app.route('/register')
def register_view(**kwargs):
  pass


@app.route('/login')
def login_view(**kwargs):
  if request.method == 'POST':
    form = LoginForm(request.POST)

    if form.is_valid():
      username = form.cleaned_data['username']
      password = form.cleaned_data['password']
      print("username: {}, password: {}".format(username, password))

      user = Account.authenticate(username, password)
      print("user:", user)
      print("accounts:", [a.json() for a in Account.find({})])

      if user is not None:
        login(request, user)
        return redirect('home')

      else:
        # TODO: return 'invalid login' error message
        form = LoginForm(initial={'username': username})

  else:
    form = LoginForm()

  return render_template(request, 'webviz/login.html', {'form': form})


def login_ajax(**kwargs):
  pass


@app.route('/logout')
def logout_view(**kwargs):
  logout(request)

  # redirect
  return redirect('home')


def forgot_password_view(**kwargs):
  pass
