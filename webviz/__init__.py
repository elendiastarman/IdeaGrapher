# all the imports
import os
from flask import Flask

import graphstore
from pymongo import MongoClient

app = Flask(__name__)  # create the application instance :)
app.config.from_object(__name__)  # load config from this file , flaskr.py

# Load default config and override config from an environment variable
app.config.update(dict(
    # DATABASE=os.path.join(app.root_path, 'flaskr.db'),
    SECRET_KEY='development key',
    USERNAME='admin',
    PASSWORD='default'
))

os.environ.setdefault('WEBVIZ_SETTINGS', 'settings.py')
app.config.from_envvar('WEBVIZ_SETTINGS')


if app.config.get('MONGO_DATABASE'):
  mongo_args = dict(
    database=app.config.get('MONGO_DATABASE', 'ideagrapher_test'),
    uri=app.config.get('MONGO_URI', 'localhost'),
    port=app.config.get('MONGO_PORT', 27017),
  )
  graphstore.MONGO_DATABASE = mongo_args['database']
  print('MONGO_DATABASE:', graphstore.MONGO_DATABASE)

  if app.config.get('MONGO_USERNAME'):
    mongo_args.update(dict(
      username=app.config.get('MONGO_USERNAME', None),
      password=app.config.get('MONGO_PASSWORD', None),
    ))
    graphstore.MONGO_CLIENT = MongoClient(mongo_args['uri'], mongo_args['port'], username=mongo_args['username'], password=mongo_args['password'])

  else:
    graphstore.MONGO_CLIENT = MongoClient(mongo_args['uri'], mongo_args['port'])


import webviz.views  # noqa
