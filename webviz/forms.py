from wtforms import Form, StringField, PasswordField, validators
from wtforms.csrf.session import SessionCSRF
from flask import session
from . import app


class BaseForm(Form):
    class Meta:
        csrf = True
        csrf_class = SessionCSRF
        csrf_secret = app.config['CSRF_SECRET_KEY']

        @property
        def csrf_context(self):
            return session


class LoginForm(BaseForm):
  username = StringField('Username', [validators.Length(min=4, max=50)])
  password = PasswordField('Password', [validators.Length(min=8, max=64), validators.DataRequired()])


class RegisterForm(LoginForm):
  email = StringField('Email', [validators.Length(min=6)])
  confirm = PasswordField('Repeat password', [validators.EqualTo('password', message='Passwords must match')])
