from flask import request, session, render_template, redirect, abort, url_for, jsonify
from graphstore.models import Graph, Link, Node
from bson import ObjectId

from . import app
from .models import Account, Document, Web, Edge, Vertex, Rule, Prop
from .forms import LoginForm, RegisterForm
from .auth import login, logout, get_user

import json
import traceback

MODEL_MAP = {
  'Document': Document,
  'Graph': Graph, 'Link': Link, 'Node': Node,
  'Web': Web, 'Edge': Edge, 'Vertex': Vertex,
  'Rule': Rule, 'Prop': Prop,
}


# Create your views here.
@app.route('/', methods=['GET'])
def home_view(**kwargs):
  context = {}

  account = get_user(session)

  context['docs'] = []
  if account:
    context['docs'] = Document.find({'owner': account.genid}, ignore_not_found=True)

  return render_template('home.html', **context)


@app.route('/newdoc', methods=['GET'])
def new_doc_view(**kwargs):
  account = get_user(session)

  graph = Graph()
  graph.save()

  web = Web(graph=graph)
  web.save()

  doc = Document(owner=account.genid, webs=[web])
  doc.save()

  return redirect(url_for('render_view', docid=doc.id))


@app.route('/render/<docid>', methods=['GET'])
def render_view(docid, **kwargs):
  context = {'docid': docid}
  account = get_user(session)

  doc = Document.get_by_id(docid, ignore_not_found=True)
  context['doc'] = doc
  context['pretty_json'] = json.dumps(json.loads(doc.json()), indent=2)

  if doc.visibility == 'private' and doc.owner != account.genid:
    abort(404)

  return render_template('render.html', **context)


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


def resolve_model(model_name, model_id, id_map):
  if model_id in id_map:
    element = id_map[model_id]
  else:
    inner_model = MODEL_MAP[model_name]
    element = inner_model.get_by_id(model_id, ignore_not_found=True)

  return element


def resolve_typed_value(item, id_map):
  element = None

  if item['$type'] == 'model':
    element = resolve_model(item['$value']['$model'], item['$value']['$id'], id_map)

  elif item['$type'].startswith('list'):
    inner_type = item['$type'].split('/')[1]

    if inner_type == 'model':
      element = [resolve_model(inner_item['$model'], inner_item['$id'], id_map) for inner_item in item['$value']]
    else:
      element = item['$value']

  else:
    element = item['$value']

  return element


def create_model(data, id_map):
  model = MODEL_MAP[data['$model']]
  create_data = dict(_id=data['$id'])

  for item in data['$create']:
    element = resolve_typed_value(item, id_map)

    if item['$action'] == 'overwrite':
      create_data[item['$key']] = element

    elif item['$action'] == 'append':
      create_data[item['$key']].append(element)

  instance = model(**create_data)
  instance.save()
  id_map[data['$id']] = instance
  print(instance.json())
  return instance.json()


def update_model(data, id_map):
  model = MODEL_MAP[data['$model']]
  instance = model.get_by_id(data['$id'], ignore_not_found=True)

  if instance is None:
    return

  for item in data['$update']:
    element = resolve_typed_value(item, id_map)

    if item['$action'] == 'overwrite':
      instance.__setattr__(item['$key'], element)

    elif item['$action'] == 'append':
      instance.__getattribute__(item['$key']).append(element)

  instance.save()


def delete_model(data, id_map):
  model = MODEL_MAP[data['$model']]
  instance = model.get_by_id(data['$id'])
  instance.delete()


@app.route('/updatedata', methods=['PUT'])
def update_data(**kwargs):
  import pprint
  data = json.loads(request.form.to_dict().get('data'))
  return_data = []
  id_map = {}

  print()
  for datum in data:
    pprint.pprint(datum)

    try:
      if '$create' in datum:
        ret = create_model(datum, id_map)
      elif '$update' in datum:
        ret = update_model(datum, id_map)
      elif '$delete' in datum:
        ret = delete_model(datum, id_map)

      return_data.append({'data': ret})

    except Exception as e:
      traceback.print_exc()
      return_data.append({'error': "Model create/update/delete failed!"})

  print()
  return jsonify({'success': 200, 'return_data': return_data})


@app.route('/restockobjectids', methods=['GET'])
def restock_object_ids(**kwargs):
  num = int(request.args.get('count')) or 100
  return jsonify([str(ObjectId()) for _ in range(num)])


@app.route('/logout')
def logout_view(**kwargs):
  logout(session)
  return redirect('/')


def forgot_password_view(**kwargs):
  pass
