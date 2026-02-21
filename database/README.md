Initializing the database schema

Install PostgreSQL client (if not installed)
sudo apt update
sudo apt install postgresql-client-16

1. cd into this folder

2. Enter PSQL CLI
Copy the URL from the database credentials
psql + paste

3. Initialize the database schema
\i schema.sql
