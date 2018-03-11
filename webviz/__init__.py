# all the imports
import os
from flask import Flask  # , request, session, g, redirect, url_for, abort, render_template, flash  # noqa
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

import webviz.views  # noqa
