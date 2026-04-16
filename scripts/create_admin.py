"""
scripts/create_admin.py — Create or reset the admin user.

Usage:
    python scripts/create_admin.py
    python scripts/create_admin.py --username praulitis --password mypassword
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import init_db
from app.auth import create_user

def main():
    parser = argparse.ArgumentParser(description="Create/reset Praulitis admin user.")
    parser.add_argument("--username", default="praulitis")
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    init_db()

    password = args.password
    if not password:
        import getpass
        password = getpass.getpass(f"Password for '{args.username}': ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match.")
            sys.exit(1)

    create_user(args.username, password, role="admin", display_name="Praulītis Admin")
    print(f"Admin user '{args.username}' created/updated successfully.")

if __name__ == "__main__":
    main()
