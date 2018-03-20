from bson import ObjectId
from .models import Account, ObjectNotFound

SESSION_KEY = '_auth_user_id'
HASH_SESSION_KEY = '_auth_user_hash'
LANGUAGE_SESSION_KEY = '_language'
REDIRECT_FIELD_NAME = 'next'


# from django.utils.crypto import constant_time_compare
# TODO: find replacement/actual implementation
def constant_time_compare(a, b):
  return a == b


def login(session, user, backend=None):
  """
  Persist a user id and a backend in the request. This way a user doesn't
  have to reauthenticate on every request. Note that data set during
  the anonymous session is retained when the user logs in.
  """
  # if user is None:
  #   user = session.get('user', None)

  session_auth_hash = user.get_session_auth_hash()
  user_id = session.get(SESSION_KEY, None)

  if user_id:
    if user_id != user.genid or (session_auth_hash and not constant_time_compare(session.get(HASH_SESSION_KEY, ''), session_auth_hash)):
      # To avoid reusing another user's session, create a new, empty
      # session if the existing session corresponds to a different
      # authenticated user.

      # session.flush()
      flush(session)

  else:
    pass
    # session.cycle_key()

  session[SESSION_KEY] = user.genid
  session[HASH_SESSION_KEY] = session_auth_hash

  session['user'] = user.serialize(exclude=['_id', 'password'])

  pass
  # rotate_token(request)


def logout(session):
  """
  Remove the authenticated user's ID from the request and flush their session
  data.
  """
  # Dispatch the signal before the user is logged out so the receivers have a
  # chance to find out *who* logged out.
  # user = session.get('user', None)

  # if hasattr(user, 'is_authenticated') and not user.is_authenticated:
  #   user = None

  # remember language choice saved to session
  # language = session.get(LANGUAGE_SESSION_KEY, 'en')

  # pass
  # # session.flush()

  # if language is not None:
  #   session[LANGUAGE_SESSION_KEY] = language

  flush(session)


def get_user(session):
  """
  Return the user model instance associated with the given request session.
  If no user is retrieved, return None.
  """
  user = None
  user_id = session.get(SESSION_KEY, None)

  if user_id:
    try:
      user = Account.find_one({'genid': user_id})

    except ObjectNotFound:
      return None

    # Verify the session
    session_hash = session.get(HASH_SESSION_KEY, None)
    session_hash_verified = session_hash is not None and constant_time_compare(session_hash, user.get_session_auth_hash())

    if not session_hash_verified:
      flush(session)
      user = None

  return user


def flush(session):
  session['user'] = None
  session.pop(SESSION_KEY, None)
  session.pop(HASH_SESSION_KEY, None)


def update_session_auth_hash(session, user):
  """
  Updating a user's password logs out all sessions for the user.

  Take the current request and the updated user object from which the new
  session hash will be derived and update the session hash appropriately to
  prevent a password change from logging out the session from which the
  password was changed.
  """
  session.cycle_key()
  if hasattr(user, 'get_session_auth_hash') and session.get('user', None) == user:

    session[HASH_SESSION_KEY] = user.get_session_auth_hash()
