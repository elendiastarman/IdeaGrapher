from flask import request, session, render_template, redirect, abort, url_for
from graphstore.models import Graph
from bson import ObjectId

from . import app
from .models import Account, Web
from .forms import LoginForm
from .auth import login, logout, get_user


# Create your views here.
@app.route('/', methods=['GET'])
def home_view(**kwargs):
  context = {}

  account = get_user(session)

  context['webs'] = []
  if account:
    context['webs'] = Web.find({'owner': account.genid})

  return render_template('home.html', **context)


@app.route('/newweb', methods=['GET'])
def new_web_view(**kwargs):
  print("session:", session)
  account = get_user(session)

  graph = Graph()
  graph.save()

  web = Web(owner=account.genid, graph=graph)
  web.save()

  new_web_id = web.id

  return redirect(url_for('render_view', webid=new_web_id))


@app.route('/render/<webid>', methods=['GET'])
def render_view(webid, **kwargs):
  context = {'webid': webid}

  web = Web.find_one({'_id': ObjectId(webid)})
  context['web'] = web

  return render_template('render.html', **context)


def deprecated_view(**kwargs):
  context = {}

  # print("user:", request.user)
  print("session.items:", session.items())

  graph = Graph.find_one({'slug': 'plant-pollinator1'})
  context['nodes'] = graph.nodes
  context['links'] = graph.links

  return render_template('home.html', **context)


@app.route('/', methods=['POST'])
def test(**kwargs):
  pass


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
