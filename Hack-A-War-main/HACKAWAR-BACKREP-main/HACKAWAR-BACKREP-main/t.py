import requests
r = requests.post("http://localhost:8000/api/v1/migrate", files={"file": ("t.tf", b'resource "google_compute_instance" "x" {name="vm"}', "text/plain")}, stream=True, timeout=90)
for line in r.text.split("\n"):
    print(line[:200])
