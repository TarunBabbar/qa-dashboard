import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import { createProject } from '../../lib/api';

const FRAMEWORK_TO_TEST_SUITES: Record<string, string[]> = {
  'Unit Testing': ['Regression', 'Sanity', 'Unit'],
  'UI Testing': ['Regression', 'Sanity', 'Smoke Test'],
  'API Testing': ['Integration', 'Performance'],
  'BDD': ['Integration', 'Sanity'],
  'Performance': ['Performance', 'Load Testing'],
  'Integration': ['Integration', 'Contract Testing'],
  'Security': ['Security', 'DAST']
};

const LANGUAGES = ['JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'Ruby', 'Go', 'PHP', 'Kotlin', 'Scala', 'Rust', 'PowerShell', 'SQL/Data'];
const FRAMEWORK_TYPES = ['UI', 'API', 'Unit', 'E2E', 'Performance', 'BDD', 'Security', 'Contract Testing', 'Mocking', 'Reporting'];
const TOOL_OPTIONS = ['Playwright', 'Cypress', 'Selenium', 'Jest', 'Pytest', 'Mocha', 'JUnit', 'Robot Framework', 'Appium', 'Locust', 'k6', 'OWASP ZAP', 'Pact', 'WireMock', 'Allure'];

const FRAMEWORK_TO_LANGUAGES_AND_TOOLS: Record<string, { languages: string[]; tools: Record<string, string[]> }> = {
  'Unit Testing': {
    languages: ['Java', 'JavaScript', 'TypeScript', 'Python', 'C# / .NET', 'Ruby', 'Go', 'PHP'],
    tools: {
      'Java': ['JUnit 5', 'TestNG'],
      'JavaScript': ['Jest', 'Mocha+Chai', 'Vitest'],
      'TypeScript': ['Jest', 'Mocha+Chai', 'Vitest'],
      'Python': ['pytest', 'unittest'],
      'C# / .NET': ['NUnit', 'xUnit', 'MSTest'],
      'Ruby': ['RSpec', 'Minitest'],
      'Go': ['go test (testing)', 'Ginkgo + Gomega'],
      'PHP': ['PHPUnit', 'PestPHP']
    }
  },
  'UI Testing': {
    languages: ['Java', 'JavaScript', 'TypeScript', 'Python', 'C# / .NET', 'Ruby', 'Go', 'PHP'],
    tools: {
      'Java': ['Selenium WebDriver', 'Playwright for Java', 'Selenide'],
      'JavaScript': ['Playwright', 'Cypress', 'WebdriverIO', 'Puppeteer', 'TestCafe'],
      'TypeScript': ['Playwright', 'Cypress', 'WebdriverIO', 'Puppeteer', 'TestCafe'],
      'Python': ['Playwright for Python', 'Selenium', 'Robot Framework'],
      'C# / .NET': ['Selenium WebDriver', 'Playwright for .NET'],
      'Ruby': ['Capybara + Selenium', 'Watir', 'playwright-ruby-client'],
      'Go': ['chromedp', 'Selenium (Go bindings)'],
      'PHP': ['Codeception (WebDriver)', 'Laravel Dusk']
    }
  },
  'API Testing': {
    languages: ['Java', 'JavaScript', 'TypeScript', 'Python', 'C# / .NET', 'Ruby', 'Go', 'PHP'],
    tools: {
      'Java': ['REST Assured', 'Karate'],
      'JavaScript': ['SuperTest', 'Frisby.js', 'axios + Jest'],
      'TypeScript': ['SuperTest', 'Frisby.js', 'axios + Jest'],
      'Python': ['requests + pytest', 'httpx', 'Tavern', 'Schemathesis'],
      'C# / .NET': ['HttpClient + NUnit/xUnit', 'RestSharp', 'Flurl'],
      'Ruby': ['HTTParty + RSpec', 'Faraday', 'Airborne'],
      'Go': ['httpexpect', 'resty + testing'],
      'PHP': ['Codeception API', 'Guzzle + PHPUnit']
    }
  },
  'BDD': {
    languages: ['Java', 'JavaScript', 'TypeScript', 'Python', 'C# / .NET', 'Ruby', 'Go', 'PHP'],
    tools: {
      'Java': ['Cucumber-JVM', 'JBehave', 'Karate'],
      'JavaScript': ['Cucumber.js'],
      'TypeScript': ['Cucumber.js'],
      'Python': ['Behave', 'pytest-bdd', 'Robot Framework'],
      'C# / .NET': ['SpecFlow'],
      'Ruby': ['Cucumber (Ruby)', 'Turnip'],
      'Go': ['godog (Cucumber for Go)', 'Ginkgo BDD'],
      'PHP': ['Behat + Mink']
    }
  },
  'Performance': {
    languages: ['Java', 'JavaScript', 'TypeScript', 'Python', 'C# / .NET', 'Ruby', 'Go', 'PHP'],
    tools: {
      'Java': ['JMeter (CLI)', 'Gatling (Scala on JVM)', 'k6 (Docker)'],
      'JavaScript': ['k6 (Docker)', 'Artillery'],
      'TypeScript': ['k6 (Docker)', 'Artillery'],
      'Python': ['Locust', 'k6 (Docker)', 'JMeter (Docker)'],
      'C# / .NET': ['NBomber', 'k6 (Docker)', 'JMeter (Docker)'],
      'Ruby': ['k6 (Docker)', 'JMeter (Docker)'],
      'Go': ['Vegeta', 'hey', 'k6'],
      'PHP': ['k6 / JMeter (Docker)']
    }
  },
  'Integration': {
    languages: ['Java', 'JavaScript', 'TypeScript', 'Python', 'C# / .NET', 'Ruby', 'Go', 'PHP'],
    tools: {
      'Java': ['Pact-JVM', 'Spring Cloud Contract', 'WireMock', 'MockServer', 'Testcontainers (Java)'],
      'JavaScript': ['Pact JS', 'Dredd', 'Mountebank', 'WireMock (Docker)', 'MSW (frontend)'],
      'TypeScript': ['Pact JS', 'Dredd', 'Mountebank', 'WireMock (Docker)', 'MSW (frontend)'],
      'Python': ['Pact Python', 'Schemathesis (OpenAPI)', 'WireMock (Docker)', 'Hoverfly', 'MockServer', 'Testcontainers (Python)'],
      'C# / .NET': ['Pact.NET', 'WireMock.Net', 'Testcontainers (DotNet)'],
      'Ruby': ['Pact Ruby', 'VCR', 'WebMock', 'WireMock (Docker)'],
      'Go': ['Pact Go', 'Hoverfly', 'WireMock (Docker)', 'Testcontainers (Go)'],
      'PHP': ['pact-php', 'WireMock (Docker)', 'Mountebank']
    }
  },
  'Security': {
    languages: ['Java', 'JavaScript', 'TypeScript', 'Python', 'C# / .NET', 'Ruby', 'Go', 'PHP'],
    tools: {
      'Java': ['OWASP ZAP (zap2docker)', 'ZAP Automation Framework (ZAP-CLI)'],
      'JavaScript': ['OWASP ZAP (Docker)', 'zap-cli'],
      'TypeScript': ['OWASP ZAP (Docker)', 'zap-cli'],
      'Python': ['OWASP ZAP (Python API)', 'zap2docker'],
      'C# / .NET': ['OWASP ZAP (Docker)'],
      'Ruby': ['OWASP ZAP (Docker)'],
      'Go': ['OWASP ZAP (Docker)'],
      'PHP': ['OWASP ZAP (Docker)']
    }
  }
};

const CreateProject: NextPage = () => {
  const [projectName, setProjectName] = useState<string>('');
  const [testSuite, setTestSuite] = useState<string>('');
  const [customTestSuite, setCustomTestSuite] = useState<string>('');
  const [language, setLanguage] = useState<string>('');
  const [frameworkType, setFrameworkType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [tools, setTools] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFrameworkChange = (framework: string) => {
    setFrameworkType(framework);
    setTestSuite('');
    setLanguage('');
    setTools([]);
  };

  const handleTestSuiteChange = (suite: string) => {
    setTestSuite(suite);
    setLanguage('');
    setTools([]);
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setTools([]);
  };

  const validate = () => {
    if (!projectName.trim()) { setMessage({ type: 'error', text: 'Project name is required.' }); return false; }
    if (testSuite === 'Other' && !customTestSuite.trim()) { setMessage({ type: 'error', text: 'Please provide a name for the test suite.' }); return false; }
    return true;
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage(null);
    if (!validate()) return;
    if (['Integration', 'Security', 'Performance'].includes(frameworkType)) {
      setMessage({ type: 'error', text: 'These services will be available in Version 2. Please select Unit Testing, UI Testing, API Testing, or BDD for now.' });
      return;
    }
    
    // Show Docker limitations warning for C# / .NET
    if (language === 'C# / .NET') {
      setMessage({ type: 'error', text: 'Note: C# / .NET testing works in Docker with Linux containers. Windows-specific features may require Windows containers.' });
      // Allow creation to continue
    }
    setLoading(true);
    const payload = {
      name: projectName.trim(),
      description: description.trim(),
      testSuite: testSuite === 'Other' ? customTestSuite.trim() : testSuite,
      language,
      frameworkType,
      tools,
      createdAt: new Date().toISOString()
    };
    try {
      const res = await createProject(payload);
      if (res?.data) {
        window.location.href = `/ide?projectId=${res.data.id}`;
      } else {
        setMessage({ type: 'error', text: res.error || 'Unexpected response' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to create project.' });
    } finally { setLoading(false); }
  };

  return (
    <>
      <Head><title>Create Project</title></Head>
      <Header />
      <main className="container py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Create New Project</h1>
          <p className="text-center text-slate-500 mb-6">Create a project and associate it with a test suite and framework settings.</p>

          <form className="bg-white border rounded-lg shadow-sm p-6" onSubmit={onSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Project Name</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g., My Awesome Project" className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description of the project" rows={3} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Framework Type</label>
                <select value={frameworkType} onChange={e => handleFrameworkChange(e.target.value)} className="w-full border rounded px-3 py-2">
                  <option value="">Select Framework Type</option>
                  {Object.keys(FRAMEWORK_TO_TEST_SUITES).map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Test Suite</label>
                <select value={testSuite} onChange={e => handleTestSuiteChange(e.target.value)} className="w-full border rounded px-3 py-2">
                  <option value="">Select Test Suite</option>
                  {frameworkType && FRAMEWORK_TO_TEST_SUITES[frameworkType].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {testSuite === 'Other' && (
                  <input value={customTestSuite} onChange={e => setCustomTestSuite(e.target.value)} placeholder="Enter test suite name" className="mt-2 w-full border rounded px-3 py-2" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Programming Language</label>
                <select value={language} onChange={e => handleLanguageChange(e.target.value)} className="w-full border rounded px-3 py-2">
                  <option value="">Select Programming Language</option>
                  {frameworkType && FRAMEWORK_TO_LANGUAGES_AND_TOOLS[frameworkType]?.languages.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Testing Tools</label>
                <select
                  value={tools[0] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTools(val ? [val] : []);
                  }}
                  className="w-full border rounded px-3 py-2 h-10"
                >
                  <option value="">Select a testing tool</option>
                  {language && FRAMEWORK_TO_LANGUAGES_AND_TOOLS[frameworkType]?.tools[language]?.map(tool => (
                    <option key={tool} value={tool}>{tool}</option>
                  ))}
                </select>
              </div>
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.text}</div>
            )}

            <div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60">{loading ? 'Creating...' : 'Create Project'}</button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
};

export default CreateProject;