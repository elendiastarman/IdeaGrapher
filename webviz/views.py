from flask import request, session, render_template, redirect, abort, url_for, jsonify
from graphstore.models import Graph

from . import app
from .models import Account, Web
from .forms import LoginForm, RegisterForm
from .auth import login, logout, get_user

import json
import traceback

MODEL_MAP = {'web': Web}


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

  web = Web.get_by_id(webid)
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


@app.route('/register', methods=['GET', 'POST'])
def register_view(**kwargs):
  context = dict()

  if request.method == 'POST':
    form = RegisterForm(request.form)
    print("Form:", form)

    if form.validate():
      username = form.username.data
      email = form.email.data
      form_errors = []

      try:
        account = Account(username=username, password=form.password.data, email=email)
        account.save()

      except Exception:
        form = RegisterForm(initial={'username': username, 'email': email})
        form_errors.append("Failed to create account.")
        context['form_errors'] = form_errors

      if not form_errors:
        user = Account.authenticate(username, form.password.data)
        print("user:", user)

        if user is not None:
          login(session, user)
          return redirect('/')

    else:
      print("Errors:", form.errors)

  else:
    form = RegisterForm()

  context['form'] = form
  return render_template('register.html', **context)


@app.route('/login', methods=['GET', 'POST'])
def login_view(**kwargs):
  context = dict()

  if request.method == 'POST':
    form = LoginForm(request.form)
    print("Form:", form)

    if form.validate():
      username = form.username.data
      password = form.password.data

      user = Account.authenticate(username, password)
      print("user:", user)
      print("accounts:", [a.json() for a in Account.find({})])

      if user is None:
        # TODO: return 'invalid login' error message
        form = LoginForm(initial={'username': username})
        form.errors['password'] = "Invalid password"

      else:
        login(session, user)
        return redirect('/')

    else:
      print("Errors:", form.errors)

  else:
    form = LoginForm()

  context['form'] = form
  return render_template('login.html', **context)


def update_model(data):
  model = MODEL_MAP[data['$model']]
  instance = model.get_by_id(data['$id'])
  print(instance.json())

  for item in data['$update']:
    if item['$action'] == 'overwrite':
      instance.__setattr__(item['$key'], item['$value'])

  # import ipdb; ipdb.set_trace()
  instance.save()


@app.route('/updatedata', methods=['PUT'])
def update_data(**kwargs):
  import pprint
  data = json.loads(request.form.to_dict().get('data'))

  for datum in data:
    pprint.pprint(datum)

    try:
      update_model(datum)
    except Exception as e:
      traceback.print_exc()
      return abort(400, {'error': "Model update failed!"})

  return jsonify({'success': 200})


@app.route('/logout')
def logout_view(**kwargs):
  logout(session)
  return redirect('/')


def forgot_password_view(**kwargs):
  pass
