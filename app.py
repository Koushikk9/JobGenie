import os
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import json_util, ObjectId # ObjectId is needed to query by _id

# --- Load Environment Variables ---
load_dotenv()

# --- App Configuration ---
app = Flask(__name__)
# A secret key is required for session management
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a-default-fallback-secret-key') 
# Configure the SQLite database path for user authentication
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'instance', 'site.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- MongoDB Setup (for Job Data) ---
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME')
client = MongoClient(MONGO_URI)
db_mongo = client[DB_NAME]
jobs_collection = db_mongo['jobs']


# --- SQLite Database Setup (for Users) ---
db = SQLAlchemy(app)

# User model for storing user credentials
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# Create the database and the 'instance' folder if they don't exist
with app.app_context():
    if not os.path.exists(os.path.join(basedir, 'instance')):
        os.makedirs(os.path.join(basedir, 'instance'))
    db.create_all()

# --- Main Routes ---

@app.route('/')
def home():
    """Renders the main homepage."""
    return render_template('index.html')

# --- API Routes (for fetching data with JavaScript) ---

@app.route('/api/jobs/category/<category_name>')
def get_jobs_by_category(category_name):
    """API endpoint to fetch jobs based on a category."""
    try:
        query = {"category": category_name}
        job_list = list(jobs_collection.find(query))
        return json_util.dumps(job_list)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/jobs/search')
def search_jobs_api():
    """API endpoint for the main search bar."""
    what = request.args.get('what', '')
    where = request.args.get('where', '')
    return jsonify([])

# --- User Authentication Routes ---
@app.route('/register', methods=['GET', 'POST'])
def register():
    """Handles user registration."""
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'danger')
            return redirect(url_for('register'))
        if User.query.filter_by(email=email).first():
            flash('Email address already registered.', 'danger')
            return redirect(url_for('register'))

        new_user = User(username=username, email=email)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        
        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))
        
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handles user login."""
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            flash(f'Welcome back, {user.username}!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid email or password.', 'danger')
            return redirect(url_for('login'))
            
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    """Displays the user dashboard. Requires login."""
    if 'user_id' not in session:
        flash('You need to be logged in to view the dashboard.', 'warning')
        return redirect(url_for('login'))
    
    return render_template('index.html', initial_page='dashboard')

@app.route('/logout')
def logout():
    """Logs the user out by clearing the session."""
    session.pop('user_id', None)
    session.pop('username', None)
    flash('You have been successfully logged out.', 'info')
    return redirect(url_for('home'))

@app.route('/about')
def about():
    """Displays the About Us page."""
    return render_template('about.html')

@app.route('/contact')
def contact():
    """Displays the Contact Us page."""
    return render_template('contact.html')


if __name__ == '__main__':
    app.run(debug=True)
    