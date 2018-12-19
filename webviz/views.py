from flask import request, session, render_template, redirect, abort, url_for, jsonify
from graphstore.models import Graph, Link, Node

from . import app
from .models import Account, Web, Edge, Vertex, Rule, Prop, Camera
from .forms import LoginForm, RegisterForm
from .auth import login, logout, get_user

import json
import traceback

MODEL_MAP = {
  'graph': Graph, 'link': Link, 'node': Node,
  'web': Web, 'edge': Edge, 'vertex': Vertex,
  'rule': Rule, 'prop': Prop, 'camera': Camera,
}


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
  context['pretty_json'] = json.dumps(json.loads(web.json()), indent=2)
  print(context['pretty_json'])

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


def resolve_typed_value(item, temp_id_map):
  element = None

  if item['$type'] == 'model':
    model_id = item['$value']['$id']

    if model_id in temp_id_map:
      element = temp_id_map[model_id]
    else:
      inner_model = MODEL_MAP[item['$value']['$model']]
      element = inner_model.get_by_id(item['$value']['$id'])

  else:
    element = item['$value']

  return element


def create_model(data, temp_id_map):
  model = MODEL_MAP[data['$model']]
  create_data = dict()

  for item in data['$create']:
    element = resolve_typed_value(item, temp_id_map)

    if item['$action'] == 'overwrite':
      create_data[item['$key']] = element

    elif item['$action'] == 'append':
      create_data[item['$key']].append(element)

  instance = model(**create_data)
  instance.save()
  temp_id_map[data['$id']] = instance
  print(instance.json())
  return instance.json()


def update_model(data, temp_id_map):
  model = MODEL_MAP[data['$model']]
  instance = model.get_by_id(data['$id'])

  for item in data['$update']:
    element = resolve_typed_value(item, temp_id_map)

    if item['$action'] == 'overwrite':
      instance.__setattr__(item['$key'], element)

    elif item['$action'] == 'append':
      instance.__getattribute__(item['$key']).append(element)

  instance.save()


def delete_model(data, temp_id_map):
  model = MODEL_MAP[data['$model']]
  instance = model.get_by_id(data['$id'])
  print(instance.json())

  # for item in data['$update']:
  #   if item['$action'] == 'overwrite':
  #     instance.__setattr__(item['$key'], item['$value'])

  # import ipdb; ipdb.set_trace()
  # instance.save()


@app.route('/updatedata', methods=['PUT'])
def update_data(**kwargs):
  import pprint
  data = json.loads(request.form.to_dict().get('data'))
  return_data = []
  temp_id_map = {}

  print()
  for datum in data:
    pprint.pprint(datum)

    try:
      if '$create' in datum:
        ret = create_model(datum, temp_id_map)
      elif '$update' in datum:
        ret = update_model(datum, temp_id_map)
      elif '$delete' in datum:
        ret = delete_model(datum, temp_id_map)

      return_data.append(ret)

    except Exception as e:
      traceback.print_exc()
      return_data.append({'error': "Model create/update/delete failed!"})

  print()
  return jsonify({'success': 200, 'return_data': return_data})


@app.route('/logout')
def logout_view(**kwargs):
  logout(session)
  return redirect('/')


def forgot_password_view(**kwargs):
  pass
