#!/usr/bin/env node

/**
 * ============================================================================
 * AEGIS MIGRATION FACTORY - SIMPLE TEST RUNNER
 * ============================================================================
 * 
 * Run with: node test_simple.js
 * 
 * Tests:
 * 1. Backend health
 * 2. SSE streaming
 * 3. Agent orchestration
 * 4. FinOps metrics
 * 5. Result validation
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// TEST UTILITIES
// ============================================================================

class TestRunner {
  constructor() {
    this.results = [];
    this.testCount = 0;
    this.passCount = 0;
    this.failCount = 0;
  }

  async test(name, fn) {
    this.testCount++;
    const start = Date.now();

    try {
      await Promise.resolve(fn());
      this.passCount++;
      this.results.push({
        name,
        status: 'pass',
        duration: Date.now() - start,
        message: '✓ Pass',
      });
      console.log(`  ✓ ${name}`);
    } catch (error) {
      this.failCount++;
      this.results.push({
        name,
        status: 'fail',
        duration: Date.now() - start,
        message: '✗ Fail',
        error: String(error),
      });
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error.message}`);
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log(`\nTest Summary:`);
    console.log(`  Total: ${this.testCount}`);
    console.log(`  Passed: ${this.passCount} ✓`);
    console.log(`  Failed: ${this.failCount} ✗`);
    console.log(`  Success Rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%\n`);
    console.log('='.repeat(80));
  }
}

// ============================================================================
// TEST SUITE 1: BACKEND HEALTH
// ============================================================================

async function testBackendHealth(runner) {
  console.log('\n📡 TEST SUITE 1: BACKEND HEALTH CHECKS\n');

  await runner.test('Backend is accessible on port 8000', async () => {
    const response = await fetch('http://localhost:8000');
    if (!response.ok) throw new Error(`Status ${response.status}`);
  });

  await runner.test('Health endpoint returns healthy status', async () => {
    const response = await fetch('http://localhost:8000/api/v1/health');
    if (!response.ok) throw new Error('Health check failed');
    const data = await response.json();
    if (data.status !== 'healthy') throw new Error(`Status: ${data.status}`);
  });

  await runner.test('Bedrock model is Claude 3.5 Sonnet', async () => {
    const response = await fetch('http://localhost:8000/api/v1/health');
    const data = await response.json();
    if (!data.bedrock?.model_id?.includes('claude-3-5-sonnet')) {
      throw new Error(`Wrong model: ${data.bedrock?.model_id}`);
    }
  });

  await runner.test('API documentation is available', async () => {
    const response = await fetch('http://localhost:8000/docs');
    if (!response.ok) throw new Error('Swagger UI not accessible');
  });

  await runner.test('CORS headers are present', async () => {
    const response = await fetch('http://localhost:8000', {
      method: 'OPTIONS',
      headers: { 'Origin': 'http://localhost:3000' },
    });
    const corsHeader = response.headers.get('access-control-allow-origin');
    if (!corsHeader) throw new Error('CORS not enabled');
  });
}

// ============================================================================
// TEST SUITE 2: FILE UPLOAD & SSE STREAMING
// ============================================================================

async function testSSEStreaming(runner) {
  console.log('\n📤 TEST SUITE 2: FILE UPLOAD & SSE STREAMING\n');

  const testContent = `
provider "google" {
  project = "my-project"
  region  = "us-central1"
}

resource "google_compute_instance" "default" {
  name         = "test-instance"
  machine_type = "e2-medium"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = "default"
  }
}
`;

  // Create test file
  const testFilePath = '/tmp/test-gcp-config.tf';
  fs.writeFileSync(testFilePath, testContent);

  await runner.test('File upload initiates without error', async () => {
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-gcp-config.tf');

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/event-stream')) {
      throw new Error(`Wrong content type: ${contentType}`);
    }
  });

  await runner.test('SSE stream contains agent events', async () => {
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-gcp-config.tf');

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let foundEvent = false;

    for (let i = 0; i < 200; i++) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes('data:') && (buffer.includes('agent') || buffer.includes('complete'))) {
        foundEvent = true;
        reader.cancel();
        break;
      }
    }

    if (!foundEvent) throw new Error('No SSE events found');
  });

  await runner.test('SSE stream returns complete event', async () => {
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-gcp-config.tf');

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let foundComplete = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const data = JSON.parse(jsonStr);

            if (data.status === 'complete' && data.result) {
              foundComplete = true;
              reader.cancel();
              break;
            }
          } catch (e) {
            // Parsing error, continue
          }
        }
      }

      if (foundComplete) break;
    }

    if (!foundComplete) throw new Error('complete event not found');
  });

  // Cleanup
  try {
    fs.unlinkSync(testFilePath);
  } catch (e) {
    // Ignore
  }
}

// ============================================================================
// TEST SUITE 3: AGENT ORCHESTRATION
// ============================================================================

async function testAgentOrchestration(runner) {
  console.log('\n🤖 TEST SUITE 3: AGENT ORCHESTRATION\n');

  const testContent = 'resource "google_compute_instance" "server" { name = "web-server" }';

  await runner.test('SSE stream returns structured events', async () => {
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-agents.tf');

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const data = JSON.parse(jsonStr);
            if (data.status) eventCount++;
          } catch (e) {
            // Parsing error, continue
          }
        }
      }
    }

    if (eventCount < 2) {
      throw new Error(`Only ${eventCount} events received, expected at least 2`);
    }
  });
}

// ============================================================================
// TEST SUITE 4: FINOPS METRICS
// ============================================================================

async function testFinOpsMetrics(runner) {
  console.log('\n💰 TEST SUITE 4: FINOPS METRICS\n');

  const testContent = 'resource "google_compute_instance" "prod" { name = "production-instance" }';

  await runner.test('FinOps metrics are present', async () => {
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-finops.tf');

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resultData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const data = JSON.parse(jsonStr);

            if (data.status === 'complete' && data.result) {
              resultData = data.result;
              reader.cancel();
              break;
            }
          } catch (e) {
            // Parsing error, continue
          }
        }
      }

      if (resultData) break;
    }

    if (!resultData) throw new Error('No result data');
    if (!resultData.finops) throw new Error('Missing finops object');
    if (resultData.finops.gcp_monthly_cost === undefined) throw new Error('Missing gcp_monthly_cost');
    if (resultData.finops.aws_monthly_cost === undefined) throw new Error('Missing aws_monthly_cost');
    if (resultData.finops.savings_percent === undefined) throw new Error('Missing savings_percent');
    if (resultData.finops.carbon_saved_kg === undefined) throw new Error('Missing carbon_saved_kg (GreenOps)');
  });

  await runner.test('Cost savings are positive', async () => {
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-finops.tf');

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resultData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const data = JSON.parse(jsonStr);

            if (data.status === 'complete' && data.result) {
              resultData = data.result;
              reader.cancel();
              break;
            }
          } catch (e) {
            // Parsing error, continue
          }
        }
      }

      if (resultData) break;
    }

    if (resultData.finops.gcp_monthly_cost <= resultData.finops.aws_monthly_cost) {
      throw new Error('AWS should be cheaper than GCP');
    }
    if (resultData.finops.savings_percent <= 0) {
      throw new Error('Savings percent should be positive');
    }
    if (resultData.finops.carbon_saved_kg <= 0) {
      throw new Error('Carbon savings should be positive');
    }
  });
}

// ============================================================================
// TEST SUITE 5: RESULT SCHEMA
// ============================================================================

async function testResultSchema(runner) {
  console.log('\n✓ TEST SUITE 5: RESULT SCHEMA VALIDATION\n');

  const testContent = 'resource "google_compute_instance" "test" { name = "test" }';

  await runner.test('Result contains all required fields', async () => {
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-schema.tf');

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resultData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const data = JSON.parse(jsonStr);

            if (data.status === 'complete' && data.result) {
              resultData = data.result;
              reader.cancel();
              break;
            }
          } catch (e) {
            // Parsing error, continue
          }
        }
      }

      if (resultData) break;
    }

    if (!resultData) throw new Error('No result');
    if (resultData.status !== 'success') throw new Error('Status should be success');
    if (!resultData.tech_debt) throw new Error('Missing tech_debt');
    if (!resultData.translation) throw new Error('Missing translation');
    if (!resultData.architecture) throw new Error('Missing architecture');
    if (!resultData.finops) throw new Error('Missing finops');
    if (!resultData.security) throw new Error('Missing security');
  });

  await runner.test('Tech debt score is valid (0-100)', async () => {
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-schema.tf');

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resultData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const data = JSON.parse(jsonStr);

            if (data.status === 'complete' && data.result) {
              resultData = data.result;
              reader.cancel();
              break;
            }
          } catch (e) {
            // Parsing error, continue
          }
        }
      }

      if (resultData) break;
    }

    const score = resultData.tech_debt.score;
    if (score < 0 || score > 100) throw new Error(`Score ${score} out of range`);
  });

  await runner.test('Terraform code is generated', async () => {
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'text/plain' });
    formData.append('file', blob, 'test-schema.tf');

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resultData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const data = JSON.parse(jsonStr);

            if (data.status === 'complete' && data.result) {
              resultData = data.result;
              reader.cancel();
              break;
            }
          } catch (e) {
            // Parsing error, continue
          }
        }
      }

      if (resultData) break;
    }

    if (!resultData.translation.new_aws_terraform) throw new Error('No Terraform code');
    if (!resultData.translation.new_aws_terraform.includes('resource')) {
      throw new Error('Terraform code should contain resources');
    }
  });
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        AEGIS MIGRATION FACTORY - COMPREHENSIVE TEST SUITE                  ║');
  console.log('║                  AWS Bedrock + Claude 3.5 Sonnet v2                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const runner = new TestRunner();

  try {
    await testBackendHealth(runner);
    await testSSEStreaming(runner);
    await testAgentOrchestration(runner);
    await testFinOpsMetrics(runner);
    await testResultSchema(runner);

    runner.printSummary();

    if (runner.failCount === 0) {
      console.log('✅ ALL TESTS PASSED! System is ready for production.\n');
      process.exit(0);
    } else {
      console.log(`❌ ${runner.failCount} test(s) failed.\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ TEST RUNNER ERROR:', error.message);
    process.exit(1);
  }
}

main();
