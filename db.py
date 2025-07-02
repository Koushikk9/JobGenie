import os
import json
import ssl
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, BulkWriteError
from dotenv import load_dotenv

# --- Configuration ---
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

DB_NAME = "jobportal"
COLLECTION_NAME = "jobs"
JSON_FILE_PATH = "jobs.json"

def main():
    if not MONGO_URI:
        print("Error: MONGO_URI environment variable not set.")
        return

    print("Connecting to MongoDB Atlas...")
    client = None
    try:
        client = MongoClient(MONGO_URI, tls=True, tlsAllowInvalidCertificates=True)
        client.admin.command('ping')
        print("✅ MongoDB connection successful.")

        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]

        print(f"Clearing existing documents from '{COLLECTION_NAME}' collection...")
        delete_result = collection.delete_many({})
        print(f"✅ Deleted {delete_result.deleted_count} documents.")

        print(f"Loading data from '{JSON_FILE_PATH}'...")
        try:
            with open(JSON_FILE_PATH, 'r', encoding='utf-8') as file:
                job_data = json.load(file)
        except FileNotFoundError:
            print(f"Error: The file '{JSON_FILE_PATH}' was not found.")
            return
        except json.JSONDecodeError:
            print(f"Error: Could not decode JSON from the file '{JSON_FILE_PATH}'.")
            return

        if not isinstance(job_data, list):
            print("Error: JSON data must be a list of job objects.")
            return

        print(f"✅ Loaded {len(job_data)} job documents from file.")

        if job_data:
            print("Inserting documents into MongoDB...")
            try:
                result = collection.insert_many(job_data)
                print(f"✅ Successfully inserted {len(result.inserted_ids)} documents.")
            except BulkWriteError as bwe:
                print("Error during bulk insert:")
                print(bwe.details)
        else:
            print("No data to insert.")

    except ConnectionFailure as e:
        print("Error: Could not connect to MongoDB.")
        print("Please check your connection string and network access settings in Atlas.")
        print(f"Details: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        if client:
            client.close()
            print("MongoDB connection closed.")

if __name__ == "__main__":
    main()
