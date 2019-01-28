"""
Flask settings for IdeaGrapher project.
"""

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'b^gi-f&d1=r^*z&*oac&^)plz@=jx_cb!5&cm@l@c4^8srohge'
CSRF_SECRET_KEY = bytes(''.join(SECRET_KEY[::-1]), encoding='utf-8')  # quick hack

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'US/Eastern'

MONGO_DATABASE = 'ideagrapher'
