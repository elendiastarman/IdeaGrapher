from flask import request, session, render_template, redirect, abort
from . import app
from graphstore.models import Graph  # , Node, Link

from .models import Account
from .forms import LoginForm
from .auth import login, logout


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


@app.route('/login', methods=['GET', 'POST'])
def login_view(**kwargs):
  if request.method == 'POST':
    form = LoginForm(request.form)
    print("Form:", form)

    if form.validate():
      username = form.username.data
      password = form.password.data
      print("username: {}, password: {}".format(username, password))

      user = Account.authenticate(username, password)
      print("user:", user)
      print("accounts:", [a.json() for a in Account.find({})])

      if user is not None:
        login(session, user)
        return redirect('/')

      else:
        # TODO: return 'invalid login' error message
        form = LoginForm(initial={'username': username})
        form.errors['password'] = "Invalid password"

    else:
      print("Errors:", form.errors)

  else:
    form = LoginForm()

  return render_template('login.html', **{'form': form})


def login_ajax(**kwargs):
  pass


@app.route('/logout')
def logout_view(**kwargs):
  logout(session)

  # redirect
  return redirect('/')


def forgot_password_view(**kwargs):
  pass
