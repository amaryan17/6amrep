import requests

# TEST 1: Simple GCP VM
print("="*60)
print("TEST 1: Simple GCP Compute Instance")
print("="*60)
gcp1 = b'resource "google_compute_instance" "web" {\n  name = "web-server"\n  machine_type = "n1-standard-2"\n  zone = "us-central1-a"\n}'
r1 = requests.post("http://localhost:8000/api/v1/migrate", files={"file": ("vm.tf", gcp1, "text/plain")}, stream=True, timeout=120)
lines1 = [l for l in r1.text.split("\n") if l.strip()]
for l in lines1[-3:]:
    print(l[:300])

print("\n")

# TEST 2: GCP SQL Database
print("="*60)
print("TEST 2: GCP Cloud SQL Database")
print("="*60)
gcp2 = b'resource "google_sql_database_instance" "main" {\n  name = "prod-db"\n  database_version = "POSTGRES_14"\n  region = "us-central1"\n  settings {\n    tier = "db-custom-4-16384"\n  }\n}'
r2 = requests.post("http://localhost:8000/api/v1/migrate", files={"file": ("db.tf", gcp2, "text/plain")}, stream=True, timeout=120)
lines2 = [l for l in r2.text.split("\n") if l.strip()]
for l in lines2[-3:]:
    print(l[:300])

# Compare
print("\n" + "="*60)
if lines1[-1] == lines2[-1]:
    print("SAME OUTPUT = DEMO MODE")
else:
    print("DIFFERENT OUTPUT = REAL BEDROCK API")
print("="*60)
