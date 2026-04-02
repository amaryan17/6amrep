import requests, json

gcp1 = b'resource "google_compute_instance" "web" { name="web" machine_type="n1-standard-2" }'
gcp2 = b'resource "google_sql_database_instance" "db" { name="prod-db" database_version="POSTGRES_14" }'

r1 = requests.post("http://localhost:8000/api/v1/migrate", files={"file": ("vm.tf", gcp1, "text/plain")}, timeout=120)
r2 = requests.post("http://localhost:8000/api/v1/migrate", files={"file": ("db.tf", gcp2, "text/plain")}, timeout=120)

# Extract the last SSE data line (the result)
def get_result(text):
    for line in reversed(text.split("\n")):
        if line.startswith("data:") and "complete" in line:
            return line[6:100]
    return "NO RESULT"

res1 = get_result(r1.text)
res2 = get_result(r2.text)

with open("d:/HACKAWAR-BACKREP-main/HACKAWAR-BACKREP-main/out.txt", "w") as f:
    f.write("TEST 1 (VM): " + res1 + "\n")
    f.write("TEST 2 (DB): " + res2 + "\n")
    f.write("SAME? " + str(res1 == res2) + "\n")
    if res1 == res2:
        f.write("VERDICT: DEMO MODE\n")
    else:
        f.write("VERDICT: REAL BEDROCK API\n")
