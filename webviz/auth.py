# Copied wholesale from django.contrib.auth and stripped down
from django.middleware.csrf import rotate_token
from django.utils.crypto import constant_time_compare
from django.utils.translation import LANGUAGE_SESSION_KEY

from bson import ObjectId
from .models import Account, ObjectNotFound

SESSION_KEY = '_auth_user_id'
HASH_SESSION_KEY = '_auth_user_hash'
REDIRECT_FIELD_NAME = 'next'


def login(request, user, backend=None):
  """
  Persist a user id and a backend in the request. This way a user doesn't
  have to reauthenticate on every request. Note that data set during
  the anonymous session is retained when the user logs in.
  """
  user = user or getattr(request, 'user', None)

  session_auth_hash = user.get_session_auth_hash()
  user_id = request.session.get(SESSION_KEY, None)

  if user_id:
    if user_id != user.id or (session_auth_hash and not constant_time_compare(request.session.get(HASH_SESSION_KEY, ''), session_auth_hash)):
      # To avoid reusing another user's session, create a new, empty
      # session if the existing session corresponds to a different
      # authenticated user.
      request.session.flush()

  else:
    request.session.cycle_key()

  request.session[SESSION_KEY] = user.id
  request.session[HASH_SESSION_KEY] = session_auth_hash

  if hasattr(request, 'user'):
    request.user = user

  rotate_token(request)


def logout(request):
  """
  Remove the authenticated user's ID from the request and flush their session
  data.
  """
  # Dispatch the signal before the user is logged out so the receivers have a
  # chance to find out *who* logged out.
  user = getattr(request, 'user', None)

  if hasattr(user, 'is_authenticated') and not user.is_authenticated:
    user = None

  # remember language choice saved to session
  language = request.session.get(LANGUAGE_SESSION_KEY)

  request.session.flush()

  if language is not None:
    request.session[LANGUAGE_SESSION_KEY] = language

  if hasattr(request, 'user'):
    request.user = None


def get_user(request):
  """
  Return the user model instance associated with the given request session.
  If no user is retrieved, return None.
  """
  user = None
  user_id = request.session.get(SESSION_KEY, None)

  if user_id:
    try:
      user = Account.find_one({'_id': ObjectId(user_id)})

    except ObjectNotFound:
      return None

    # Verify the session
    session_hash = request.session.get(HASH_SESSION_KEY)
    session_hash_verified = session_hash and constant_time_compare(session_hash, user.get_session_auth_hash())

    if not session_hash_verified:
      request.session.flush()
      user = None

  return user


def update_session_auth_hash(request, user):
  """
  Updating a user's password logs out all sessions for the user.

  Take the current request and the updated user object from which the new
  session hash will be derived and update the session hash appropriately to
  prevent a password change from logging out the session from which the
  password was changed.
  """
  request.session.cycle_key()
  if hasattr(user, 'get_session_auth_hash') and request.user == user:

    request.session[HASH_SESSION_KEY] = user.get_session_auth_hash()
