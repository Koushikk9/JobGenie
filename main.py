from flask import Flask, render_template, request, jsonify, redirect, url_for, session
# from flask_mysqldb import MySQL
from werkzeug.security import generate_password_hash, check_password_hash
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone
from bson import json_util, ObjectId
from functools import wraps
# from flask_cors import CORS

app = Flask(__name__)
load_dotenv()
# CORS(app)

app.secret_key = "supersecretkey"

MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME')
client = MongoClient(MONGO_URI)
db_mongo = client[DB_NAME]
jobs_collection = db_mongo['jobs']
users_collection = db_mongo['users']

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/contact")
def contact():
    return render_template("contact.html")

@app.route("/recruiter")
@login_required
def recruiter():
    if session.get('user_type') != 'recruiter':
        return redirect(url_for('seeker'))
    return render_template("recruiter.html")

@app.route("/seeker")
@login_required
def seeker():
    if session.get('user_type') != 'job_seeker':
        return redirect(url_for('recruiter'))
    return render_template("jobseeker.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        user_type = data.get('user_type')

        if not all([username, email, password, user_type]):
            return jsonify({"message": "All fields are required"}), 400

        existing_user = users_collection.find_one({'email': email})
        if existing_user:
            return jsonify({"message": "User with this email already exists"}), 409

        hashed_password = generate_password_hash(password)

        try:
            user_document = {
                "username": username,
                "email": email,
                "password_hash": hashed_password,
                "user_type": user_type,
                "created_at": datetime.now(timezone.utc)
            }
            result = users_collection.insert_one(user_document)
            session['user_id'] = str(result.inserted_id)
            session['username'] = username
            session['user_type'] = user_type

            redirect_url = url_for('recruiter') if user_type == "recruiter" else url_for('seeker')
            return jsonify({"message": "Registration successful!", "redirect": redirect_url}), 201
        except Exception as e:
            return jsonify({"message": f"Database error: {str(e)}"}), 500

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        try:
            data = request.get_json()
            email = data.get('email')
            password = data.get('password')
            user_type_from_form = data.get("user_type")

            user = users_collection.find_one({'email': email})

            if user and check_password_hash(user['password_hash'], password):
                if user['user_type'] != user_type_from_form:
                    return jsonify({"message": "Incorrect role selected for this account."}), 401

                session['user_id'] = str(user['_id'])
                session['username'] = user['username']
                session['user_type'] = user['user_type']

                redirect_url = url_for('recruiter') if user['user_type'] == "recruiter" else url_for('seeker')
                return jsonify({"message": "Login successful!", "redirect": redirect_url}), 200
            else:
                return jsonify({"message": "Invalid email or password"}), 401

        except Exception as e:
            return jsonify({"message": f"An error occurred: {str(e)}"}), 500

    return render_template("login.html")

@app.route("/logout")
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    session.pop('user_type', None)
    return redirect(url_for("index"))
@app.route('/api/jobs/search', methods=['GET'])
def search_jobs():
    try:
        print("Search endpoint hit!")  # Debug print
        
        what_query = request.args.get('what', '').strip()
        where_query = request.args.get('where', '').strip()
        is_remote = request.args.get('remote', 'false').lower() == 'true'
        job_type = request.args.get('type', 'both').strip()
        
        # print(f"Search params: what={what_query}, where={where_query}, remote={is_remote}, type={job_type}")
        
        if jobs_collection is None:
            return jsonify({"error": "Database not connected"}), 500
        
        query_conditions = []
        
        if what_query:
            query_conditions.append({
                "$or": [
                    {"title": {"$regex": what_query, "$options": "i"}},
                    {"company": {"$regex": what_query, "$options": "i"}},
                    {"category": {"$regex": what_query, "$options": "i"}},
                    {"description": {"$regex": what_query, "$options": "i"}}
                ]
            })
        
        if where_query.lower() == 'remote':
            is_remote = True
        elif where_query:
            query_conditions.append({"location": {"$regex": where_query, "$options": "i"}})  # ✅ corrected
        
        if is_remote:
            query_conditions.append({"remote": True})
        
        if job_type in ['government', 'private']:
            query_conditions.append({"type": job_type})  # ✅ corrected
        
        final_query = {"$and": query_conditions} if query_conditions else {}
        # print(f"MongoDB query: {final_query}")
        
        jobs = list(jobs_collection.find(final_query).sort("posted_date", -1))
        print(f"Found {len(jobs)} jobs")
        
        for job in jobs:
            job['_id'] = str(job['_id'])
        
        return jsonify({
            "jobs": jobs,
            "count": len(jobs),
            "query": final_query
        })
        
    except Exception as e:
        print(f"Search error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/jobs/category/<category_name>")
def get_jobs_by_category(category_name):
    try:
        query = {"category": {"$regex": category_name, "$options": "i"}}
        jobs = list(jobs_collection.find(query).sort("posted_date", -1))
        return json_util.dumps(jobs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/post-job', methods=['GET', 'POST'])
@login_required
def post_job():
    if request.method == 'POST':
        if session.get('user_type') != 'recruiter':
            return jsonify({"message": "Unauthorized: Only recruiters can post jobs."}), 403
        try:
            data = request.get_json()
            if not data:
                return jsonify({"message": "Invalid JSON data"}), 400

            job_title = data.get('job_title')
            company_name = data.get('company_name')
            job_description = data.get('job_description')
            category = data.get('category')

            if not all([job_title, company_name, job_description, category]):
                return jsonify({"message": "Title, Company, Description, and Category are required!"}), 400

            job_document = {
                "recruiter_id": session.get('user_id'),
                "recruiter_username": session.get('username'),
                "job_title": job_title,
                "company_name": company_name,
                "job_description": job_description,
                "job_location": data.get('job_location'),
                "job_type": data.get('job_type'),
                "salary": data.get('salary'),
                "job_requirements": data.get('job_requirements'),
                "category": category.lower(),
                "posted_date": datetime.now(timezone.utc)
            }
            result = jobs_collection.insert_one(job_document)
            if not result.inserted_id:
                return jsonify({"message": "Failed to post job to the database."}), 500

            return jsonify({
    "message": "Job posted successfully!",
    "job_id": str(result.inserted_id),
    "redirect": url_for("recruiter")
}), 201

        except Exception as e:
            return jsonify({"message": f"An error occurred: {str(e)}"}), 500

    return render_template('post-job.html')

@app.route('/api/session-status')
def session_status():
    if 'user_id' in session:
        return jsonify({
            "logged_in": True,
            "username": session.get('username'),
            "user_type": session.get('user_type')
        })
    else:
        return jsonify({"logged_in": False})

if __name__ == "__main__":
    app.run(use_reloader=False)
