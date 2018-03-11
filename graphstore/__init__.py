from pymongo import MongoClient

# Mongo stuff
MONGO_URL = "localhost"
MONGO_PORT = 27017
MONGO_DATABASE = "ideagrapher"

MONGO_CLIENT = MongoClient(MONGO_URL, MONGO_PORT)
