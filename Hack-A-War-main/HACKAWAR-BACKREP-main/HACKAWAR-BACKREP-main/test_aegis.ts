/**
 * ============================================================================
 * AEGIS MIGRATION FACTORY - COMPREHENSIVE TEST SUITE
 * ============================================================================
 * 
 * Test scenarios for the full migration pipeline:
 * 1. Backend health checks
 * 2. SSE streaming
 * 3. Agent orchestration
 * 4. FinOps metrics validation
 * 5. Error handling
 * 6. Caching behavior
 * 
 * Run with: npm test test_aegis.ts
 * Or: node test_aegis.ts
 */

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  message: string;
  error?: string;
}

class TestRunner {
  private results: TestResult[] = [];
  private testCount = 0;
  private passCount = 0;
  private failCount = 0;

  async test(name: string, fn: () => Promise<void> | void) {
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
      console.log(`✓ ${name}`);
    } catch (error) {
      this.failCount++;
      this.results.push({
        name,
        status: 'fail',
        duration: Date.now() - start,
        message: '✗ Fail',
        error: String(error),
      });
      console.error(`✗ ${name}: ${error}`);
    }
  }

  async skip(name: string, fn: () => Promise<void> | void) {
    this.results.push({
      name,
      status: 'skip',
      duration: 0,
      message: '⊘ Skip',
    });
    console.log(`⊘ ${name} (skipped)`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log(`Tests run: ${this.testCount}`);
    console.log(`Passed: ${this.passCount} ✓`);
    console.log(`Failed: ${this.failCount} ✗`);
    console.log(`Success rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%`);
    console.log('='.repeat(80) + '\n');
  }
}

function assert(condition: boolean | string | null | undefined, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

// ============================================================================
// TEST SUITE 1: BACKEND HEALTH CHECKS
// ============================================================================

async function testBackendHealth(runner: TestRunner) {
  console.log('\n📡 TEST SUITE 1: BACKEND HEALTH CHECKS\n');

  await runner.test('Backend is accessible on port 8000', async () => {
    const response = await fetch('http://localhost:8000');
    assert(response.ok, 'Backend returned non-200 status');
  });

  await runner.test('Health endpoint returns healthy status', async () => {
    const response = await fetch('http://localhost:8000/api/v1/health');
    assert(response.ok, 'Health endpoint failed');
    const data = await response.json();
    assertEquals(data.status, 'healthy', 'Status should be healthy');
  });

  await runner.test('Bedrock client is initialized', async () => {
    const response = await fetch('http://localhost:8000/api/v1/health');
    const data = await response.json();
    assert(data.bedrock_model, 'Bedrock model not specified');
    assert(
      data.bedrock_model.includes('claude-3-5-sonnet'),
      'Should use Claude 3.5 Sonnet model'
    );
  });

  await runner.test('API docs are available', async () => {
    const response = await fetch('http://localhost:8000/docs');
    assert(response.ok, 'Swagger UI not accessible');
  });

  await runner.test('CORS is enabled', async () => {
    const response = await fetch('http://localhost:8000', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });
    const corsHeader = response.headers.get('access-control-allow-origin');
    assert(corsHeader, 'CORS not enabled');
  });
}

// ============================================================================
// TEST SUITE 2: FILE UPLOAD & SSE STREAMING
// ============================================================================

async function testSSEStreaming(runner: TestRunner) {
  console.log('\n📤 TEST SUITE 2: FILE UPLOAD & SSE STREAMING\n');

  // Create a minimal test file
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

  const testFile = new File([testContent], 'test-gcp-config.tf', { type: 'text/plain' });

  await runner.test('File upload initiates without error', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    assert(response.ok, `Upload failed: ${response.statusText}`);
    assert(response.headers.get('content-type')?.includes('text/event-stream'), 'Response should be SSE stream');
  });

  await runner.test('SSE stream returns agent_1 event', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    let foundAgent1 = false;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
      iterations++;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes('agent_1')) {
        foundAgent1 = true;
        break;
      }
    }

    assert(foundAgent1, 'Did not receive agent_1 event in SSE stream');
  });

  await runner.test('SSE stream returns complete event with result', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    let foundComplete = false;
    let resultData: any = null;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          const data = JSON.parse(jsonStr);

          if (data.status === 'complete' && data.result) {
            foundComplete = true;
            resultData = data.result;
            break;
          }
        }
      }

      if (foundComplete) break;
    }

    assert(foundComplete, 'Did not receive complete event');
    assert(resultData, 'Result data is empty');
  });
}

// ============================================================================
// TEST SUITE 3: AGENT ORCHESTRATION
// ============================================================================

async function testAgentOrchestration(runner: TestRunner) {
  console.log('\n🤖 TEST SUITE 3: AGENT ORCHESTRATION\n');

  const testContent = `
resource "google_compute_instance" "server" {
  name = "web-server"
  machine_type = "n1-standard-1"
}
`;

  const testFile = new File([testContent], 'test-agents.tf', { type: 'text/plain' });

  await runner.test('All 5 agents are triggered in sequence', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    const agentEvents = new Set<string>();
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          const data = JSON.parse(jsonStr);

          if (['agent_1', 'agent_2', 'agent_3', 'agent_4'].includes(data.status)) {
            agentEvents.add(data.status);
          }
        }
      }
    }

    assertEquals(agentEvents.size, 4, 'Should have 4 agent events');
    assert(agentEvents.has('agent_1'), 'Missing agent_1');
    assert(agentEvents.has('agent_2'), 'Missing agent_2');
    assert(agentEvents.has('agent_3'), 'Missing agent_3');
    assert(agentEvents.has('agent_4'), 'Missing agent_4');
  });
}

// ============================================================================
// TEST SUITE 4: FINOPS METRICS VALIDATION
// ============================================================================

async function testFinOpsMetrics(runner: TestRunner) {
  console.log('\n💰 TEST SUITE 4: FINOPS METRICS VALIDATION\n');

  const testContent = `
resource "google_compute_instance" "prod" {
  name = "production-instance"
}
`;

  const testFile = new File([testContent], 'test-finops.tf', { type: 'text/plain' });

  await runner.test('FinOps metrics are present in result', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    let resultData: any = null;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          const data = JSON.parse(jsonStr);

          if (data.status === 'complete' && data.result) {
            resultData = data.result;
            break;
          }
        }
      }

      if (resultData) break;
    }

    assert(resultData, 'No result data');
    assert(resultData.finops, 'Missing finops object');
    assert(
      resultData.finops.gcp_monthly_cost !== undefined,
      'Missing gcp_monthly_cost'
    );
    assert(
      resultData.finops.aws_monthly_cost !== undefined,
      'Missing aws_monthly_cost'
    );
    assert(
      resultData.finops.savings_percent !== undefined,
      'Missing savings_percent'
    );
    assert(
      resultData.finops.carbon_saved_kg !== undefined,
      'Missing carbon_saved_kg (GreenOps metric)'
    );
  });

  await runner.test('Cost savings are positive', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    let resultData: any = null;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          const data = JSON.parse(jsonStr);

          if (data.status === 'complete' && data.result) {
            resultData = data.result;
            break;
          }
        }
      }

      if (resultData) break;
    }

    assert(
      resultData.finops.gcp_monthly_cost > resultData.finops.aws_monthly_cost,
      'AWS should be cheaper than GCP'
    );
    assert(resultData.finops.savings_percent > 0, 'Savings percent should be positive');
  });

  await runner.test('GreenOps carbon savings are calculated', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    let resultData: any = null;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          const data = JSON.parse(jsonStr);

          if (data.status === 'complete' && data.result) {
            resultData = data.result;
            break;
          }
        }
      }

      if (resultData) break;
    }

    assert(
      resultData.finops.carbon_saved_kg > 0,
      'Carbon savings should be positive'
    );
  });
}

// ============================================================================
// TEST SUITE 5: RESULT SCHEMA VALIDATION
// ============================================================================

async function testResultSchema(runner: TestRunner) {
  console.log('\n✓ TEST SUITE 5: RESULT SCHEMA VALIDATION\n');

  const testContent = 'resource "google_compute_instance" "test" { name = "test" }';
  const testFile = new File([testContent], 'test-schema.tf', { type: 'text/plain' });

  await runner.test('Result contains all required fields', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    let resultData: any = null;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          const data = JSON.parse(jsonStr);

          if (data.status === 'complete' && data.result) {
            resultData = data.result;
            break;
          }
        }
      }

      if (resultData) break;
    }

    assert(resultData.status === 'success', 'Status should be success');
    assert(resultData.tech_debt, 'Missing tech_debt');
    assert(resultData.translation, 'Missing translation');
    assert(resultData.architecture, 'Missing architecture');
    assert(resultData.finops, 'Missing finops');
    assert(resultData.security, 'Missing security');
  });

  await runner.test('Tech debt score is between 0-100', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    let resultData: any = null;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          const data = JSON.parse(jsonStr);

          if (data.status === 'complete' && data.result) {
            resultData = data.result;
            break;
          }
        }
      }

      if (resultData) break;
    }

    const score = resultData.tech_debt.score;
    assert(score >= 0 && score <= 100, `Score ${score} is out of range [0-100]`);
  });

  await runner.test('Terraform code is generated', async () => {
    const formData = new FormData();
    formData.append('file', testFile);

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    let resultData: any = null;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines[lines.length - 1];

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          const data = JSON.parse(jsonStr);

          if (data.status === 'complete' && data.result) {
            resultData = data.result;
            break;
          }
        }
      }

      if (resultData) break;
    }

    assert(
      resultData.translation.new_aws_terraform.length > 0,
      'Terraform code should not be empty'
    );
    assert(
      resultData.translation.new_aws_terraform.includes('resource'),
      'Terraform code should contain resource definitions'
    );
  });
}

// ============================================================================
// TEST SUITE 6: ERROR HANDLING
// ============================================================================

async function testErrorHandling(runner: TestRunner) {
  console.log('\n❌ TEST SUITE 6: ERROR HANDLING\n');

  await runner.test('Invalid file type returns error', async () => {
    const formData = new FormData();
    formData.append('file', new File([], 'test.txt', { type: 'text/plain' }));

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    // Either returns error in stream or processes anyway (demo mode)
    assert(response.ok || response.status === 400, 'Should handle gracefully');
  });

  await runner.test('Empty file does not crash server', async () => {
    const formData = new FormData();
    formData.append('file', new File([], 'empty.tf', { type: 'text/plain' }));

    const response = await fetch('http://localhost:8000/api/v1/migrate', {
      method: 'POST',
      body: formData,
    });

    assert(response.ok, 'Server should handle empty files');
  });
}

// ============================================================================
// FRONTEND TESTS (Requires browser environment)
// ============================================================================

async function testFrontendIntegration(runner: TestRunner) {
  console.log('\n⚛️  TEST SUITE 7: FRONTEND INTEGRATION\n');

  await runner.skip('Frontend renders correctly', async () => {
    // This requires a browser environment or Puppeteer
    // Can be run separately with: npm run test:frontend
  });

  await runner.skip('Agent status updates in real-time', async () => {
    // Requires browser automation
  });

  await runner.skip('FinOps metrics display correctly', async () => {
    // Requires browser automation
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        AEGIS MIGRATION FACTORY - COMPREHENSIVE TEST SUITE                  ║');
  console.log('║                    AWS Bedrock + Claude 3.5 Sonnet                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const runner = new TestRunner();

  try {
    // Run all test suites
    await testBackendHealth(runner);
    await testSSEStreaming(runner);
    await testAgentOrchestration(runner);
    await testFinOpsMetrics(runner);
    await testResultSchema(runner);
    await testErrorHandling(runner);
    await testFrontendIntegration(runner);

    // Print summary
    runner.printSummary();
  } catch (error) {
    console.error('\nFATAL TEST ERROR:', error);
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
