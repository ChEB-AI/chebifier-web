from flask import Flask, request, send_from_directory
from flask_restful import Api, Resource, reqparse
from flask_cors import CORS  # comment this on deployment
import torch.multiprocessing as mp

import json

app = Flask(__name__, static_url_path='', static_folder='../react-app/build')
CORS(app) # comment this on deployment

app.config.from_file("config.template.json", load=json.load)
app.config.from_file("config.json", load=json.load)

api = Api(app)


@app.route("/", defaults={'path': ''})
def serve(path):
    return send_from_directory(app.static_folder, 'index.html')


@app.errorhandler(404)
def serve_client_route(error):
    """Hand unknown paths to the frontend, which routes them itself.

    Without this, opening or reloading a page other than "/" (e.g. /about) hits Flask rather than
    the router and 404s. Static files are served before this runs, so only paths that exist as
    client-side routes reach it - and API paths keep their 404.
    """
    if request.path.startswith("/api/"):
        return {"message": "Not found"}, 404
    return send_from_directory(app.static_folder, 'index.html')


def load_endpoints():
    from api.chemclass import PredictionDetailApiHandler, BatchPrediction, ModelInfoAPI, StatsAPI
    api.add_resource(PredictionDetailApiHandler, '/api/details')
    api.add_resource(BatchPrediction, '/api/classify')
    api.add_resource(ModelInfoAPI, '/api/modelinfo')
    api.add_resource(StatsAPI, '/api/stats')

with app.app_context():
    mp.set_start_method("spawn")
    load_endpoints()
