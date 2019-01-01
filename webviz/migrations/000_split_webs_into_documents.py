""" The 'Web' model had some fields moved into a new 'Document' model.

Usage:
  000_split_webs_into_documents.py [--dry-run]

Options:
  -h --help    Show this help message
  --dry-run    Don't actually do stuff
"""

from docopt import docopt
from pprint import pprint

# from graphstore.models import MongoModel, Node, ObjectNotFound
from webviz.models import Document, Web
# from bson import ObjectId


def run(args):
  docs = list(Document.collection().find({}))
  webs = list(Web.collection().find({}))

  covered_webs = [doc.web.id for doc in docs]
  update_web_query = {'$unset': {'owner': 1, 'visibility': 1, 'rules': 1}}

  for web in webs:
    web_id = str(web['_id'])
    if web_id in covered_webs:
      continue

    # Need to create new Document
    new_doc_data = dict(
      webs=[web_id],
      name=web['name'],
      owner=web['owner'],
      visibility=web['visibility'],
      rules=web['rules'],
    )

    if args['--dry-run']:
      print('new_doc_data:')
      pprint(new_doc_data)
    else:
      doc = Document(**new_doc_data)
      doc.save()

      Web.collection().update({'_id': web['_id']}, update_web_query)


if __name__ == '__main__':
  args = docopt(__doc__)
  run(args)
