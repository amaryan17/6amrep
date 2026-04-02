"""Quick test: verify different files produce different outputs."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from main import generate_demo_response

# Two completely different GCP files
file1 = '''
resource "google_compute_instance" "web" {
  machine_type = "n1-standard-8"
  zone = "us-central1-a"
  boot_disk { initialize_params { image = "debian-cloud/debian-11" } }
}
resource "google_sql_database_instance" "db" {
  database_version = "POSTGRES_15"
  settings { tier = "db-custom-4-16384" }
}
resource "google_storage_bucket" "assets" {
  name = "my-app-assets"
  location = "US"
}
'''

file2 = '''
resource "google_container_cluster" "primary" {
  name     = "gke-prod"
  location = "us-east1"
  initial_node_count = 3
  node_config { machine_type = "n2-standard-16" }
}
resource "google_cloud_run_service" "api" {
  name     = "api-service"
  location = "us-east1"
}
resource "google_pubsub_topic" "events" {
  name = "event-stream"
}
'''

file3 = '''
apiVersion: v1
kind: Service
metadata:
  name: web-api
spec:
  ports:
    - port: 80
      targetPort: 8080
'''

r1 = generate_demo_response(file1)
r2 = generate_demo_response(file2)
r3 = generate_demo_response(file3)

print("=" * 60)
print("FILE 1 (Compute+SQL+Storage):")
print(f"  Cost: GCP ${r1['finops']['gcp_monthly_cost']:,.2f} -> AWS ${r1['finops']['aws_monthly_cost']:,.2f}")
print(f"  Score: {r1['tech_debt']['score']}")
print(f"  Strategy: {r1['architecture']['migration_strategy'][:80]}")
print(f"  Issues: {len(r1['tech_debt']['issues_fixed'])}")
print(f"  TF lines: {len(r1['translation']['new_aws_terraform'].split(chr(10)))}")

print()
print("FILE 2 (GKE+CloudRun+PubSub):")
print(f"  Cost: GCP ${r2['finops']['gcp_monthly_cost']:,.2f} -> AWS ${r2['finops']['aws_monthly_cost']:,.2f}")
print(f"  Score: {r2['tech_debt']['score']}")
print(f"  Strategy: {r2['architecture']['migration_strategy'][:80]}")
print(f"  Issues: {len(r2['tech_debt']['issues_fixed'])}")
print(f"  TF lines: {len(r2['translation']['new_aws_terraform'].split(chr(10)))}")

print()
print("FILE 3 (K8s YAML - no Terraform):")
print(f"  Cost: GCP ${r3['finops']['gcp_monthly_cost']:,.2f} -> AWS ${r3['finops']['aws_monthly_cost']:,.2f}")
print(f"  Score: {r3['tech_debt']['score']}")
print(f"  Strategy: {r3['architecture']['migration_strategy'][:80]}")
print(f"  Issues: {len(r3['tech_debt']['issues_fixed'])}")

print()
print("=" * 60)
all_different = (
    r1['finops']['gcp_monthly_cost'] != r2['finops']['gcp_monthly_cost'] and
    r1['finops']['gcp_monthly_cost'] != r3['finops']['gcp_monthly_cost'] and
    r1['tech_debt']['score'] != r2['tech_debt']['score']
)
print(f"ALL OUTPUTS UNIQUE: {all_different}")
print(f"File1 issues: {r1['tech_debt']['issues_fixed'][:2]}")
print(f"File2 issues: {r2['tech_debt']['issues_fixed'][:2]}")
